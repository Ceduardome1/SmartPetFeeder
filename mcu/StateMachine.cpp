#include "StateMachine.h"
#include "Config.h"

void StateMachine::init(ActuatorHAL* hal, uint8_t initialLevel, EventCallback onEvent) {
  _hal              = hal;
  _emit             = onEvent;
  _levelPct         = initialLevel;
  _anguloDisp       = ANGULO_DEFECTO_PCT;
  _escotillaAbierta = false;
  _dispPhase        = DISP_IDLE;
  _phaseDeadline    = 0;

  _state = (_levelPct <= NIVEL_UMBRAL_VACIO) ? STATE_SIN_COMIDA : STATE_OPERATIVO;
  _hal->setActiveAlarm(false);
  _hal->setLedMode(_state == STATE_SIN_COMIDA ? LED_MODE_SIN_COMIDA : LED_MODE_OPERATIVO);

  emitCurrent("ESTADO_NIVEL");
}

void StateMachine::emitCurrent(const char* eventName) {
  if (_emit) {
    _emit(eventName, _state, _levelPct, _anguloDisp, _escotillaAbierta);
  }
}

void StateMachine::enterParoEmergencia(bool isCabezaAtorada) {
  _dispPhase = DISP_IDLE;

  _state = isCabezaAtorada ? STATE_CABEZA_ATORADA : STATE_PARO_EMERGENCIA;
  _hal->setLedMode(LED_MODE_EMERGENCIA);
  _hal->setActiveAlarm(isCabezaAtorada);

  // Cierra dispensador (0%) y abre escotilla a tope (100%) con desfase de potencia seguro
  _hal->moveBothParallel(0, ESCOTILLA_EMERG_PCT, SERVO_EMERG_STAGGER_MS);
  _escotillaAbierta = true;

  if (isCabezaAtorada) {
    emitCurrent("ALERTA_CABEZA_ATORADA");
  } else {
    _hal->playTone(600, 150);
    emitCurrent("PARO_EMERGENCIA");
  }
}

void StateMachine::onCabezaAtorada() {
  enterParoEmergencia(true);
}

void StateMachine::onRemoteParoEmergencia() {
  if (_state == STATE_CABEZA_ATORADA) return;
  enterParoEmergencia(false);
}

void StateMachine::onUnhandledException() {
  if (_state == STATE_CABEZA_ATORADA) return;
  enterParoEmergencia(false);
}

void StateMachine::onToggleEscotilla() {
  if (_state == STATE_CABEZA_ATORADA) {
    _hal->playTone(300, 150);
    return;
  }

  if (_dispPhase != DISP_IDLE || !_escotillaAbierta) {
    enterParoEmergencia(false);
  } else {
    _hal->moveEscotilla(0);
    _escotillaAbierta = false;
    _hal->playTone(800, 100);
    emitCurrent("PARO_EMERGENCIA");
  }
}

void StateMachine::onRequestDispensar() {
  if (_state == STATE_PARO_EMERGENCIA || _state == STATE_CABEZA_ATORADA) {
    _hal->playTone(300, 200);
    return;
  }

  if (_levelPct <= NIVEL_UMBRAL_VACIO) {
    _state = STATE_SIN_COMIDA;
    _hal->setLedMode(LED_MODE_SIN_COMIDA);
    _hal->playTone(450, 180);
    emitCurrent("SIN_COMIDA");
    return;
  }

  if (_dispPhase != DISP_IDLE) return;

  _hal->playTone(1200, 80);
  _hal->moveBothParallel(_anguloDisp, ESCOTILLA_DISP_PCT);
  _escotillaAbierta = true;
  _dispPhase = DISP_OPENING;
}

void StateMachine::onRequestReiniciar() {
  _dispPhase = DISP_IDLE;
  _hal->setActiveAlarm(false);

  _hal->moveBothParallel(0, 0);
  _escotillaAbierta = false;

  _state = (_levelPct <= NIVEL_UMBRAL_VACIO) ? STATE_SIN_COMIDA : STATE_OPERATIVO;
  _hal->setLedMode(_state == STATE_SIN_COMIDA ? LED_MODE_SIN_COMIDA : LED_MODE_OPERATIVO);

  _hal->playTone(1500, 100);
  emitCurrent("FLUJO_REINICIADO");
}

void StateMachine::onSetAngulo(int newAngle) {
  _anguloDisp = (uint8_t)constrain(newAngle, ANGULO_MIN_PCT, ANGULO_MAX_PCT);
  _hal->playTone(1000, 60);
  emitCurrent("ESTADO_NIVEL");
}

void StateMachine::onLevelChanged(uint8_t newLevel) {
  _levelPct = newLevel;

  if (_state != STATE_PARO_EMERGENCIA && _state != STATE_CABEZA_ATORADA) {
    SystemState nextState = (_levelPct <= NIVEL_UMBRAL_VACIO) ? STATE_SIN_COMIDA : STATE_OPERATIVO;
    if (nextState != _state) {
      _state = nextState;
      _hal->setLedMode(_state == STATE_SIN_COMIDA ? LED_MODE_SIN_COMIDA : LED_MODE_OPERATIVO);
      if (_state == STATE_SIN_COMIDA) {
        _hal->playTone(450, 180);
        emitCurrent("SIN_COMIDA");
        return;
      }
    }
  }

  emitCurrent("ESTADO_NIVEL");
}

void StateMachine::update(unsigned long nowMs) {
  if (_dispPhase == DISP_IDLE) return;

  switch (_dispPhase) {
    case DISP_OPENING:
      if (!_hal->isDispensadorBusy() && !_hal->isEscotillaBusy()) {
        _phaseDeadline = nowMs + DISPENSE_HOLD_MS;
        _dispPhase     = DISP_HOLDING;
      }
      break;

    case DISP_HOLDING:
      if ((long)(nowMs - _phaseDeadline) >= 0) {
        _hal->moveDispensador(0);
        _dispPhase = DISP_CLOSING_DISP;
      }
      break;

    case DISP_CLOSING_DISP:
      if (!_hal->isDispensadorBusy()) {
        _phaseDeadline = nowMs + ESCOTILLA_CLOSE_DELAY_MS;
        _dispPhase     = DISP_WAIT_ESCOTILLA;
      }
      break;

    case DISP_WAIT_ESCOTILLA:
      if ((long)(nowMs - _phaseDeadline) >= 0) {
        _hal->moveEscotilla(0);
        _dispPhase = DISP_CLOSING_ESC;
      }
      break;

    case DISP_CLOSING_ESC:
      if (!_hal->isEscotillaBusy()) {
        _escotillaAbierta = false;
        _dispPhase        = DISP_IDLE;
        emitCurrent("DISPENSACION_EXITOSA");
      }
      break;

    default:
      _dispPhase = DISP_IDLE;
      break;
  }
}
