#include "ActuatorHAL.h"

void ActuatorHAL::init() {
  pinMode(PIN_LED_VERDE,    OUTPUT);
  pinMode(PIN_LED_AMARILLO, OUTPUT);
  pinMode(PIN_LED_ROJO,     OUTPUT);
  pinMode(PIN_BEEPER_PASIVO,OUTPUT);
  pinMode(PIN_TRANS_BEEPER, OUTPUT);

  digitalWrite(PIN_LED_VERDE,    LOW);
  digitalWrite(PIN_LED_AMARILLO, LOW);
  digitalWrite(PIN_LED_ROJO,     LOW);
  digitalWrite(PIN_TRANS_BEEPER, LOW);

  initChannel(_dispChannel, PIN_SERVO_DISP, PIN_TRANS_DISP);
  initChannel(_escChannel,  PIN_SERVO_ESC,  PIN_TRANS_ESC);

  _ledMode     = LED_MODE_OPERATIVO;
  _lastBlinkMs = 0;
  _redLedState = false;

  moveBothParallel(0, 0);
}

void ActuatorHAL::initChannel(ServoChannel &ch, uint8_t pinPWM, uint8_t pinTrans) {
  ch.pinPWM        = pinPWM;
  ch.pinTransistor = pinTrans;
  ch.targetPct     = 0;
  ch.state         = CH_IDLE;
  ch.deadlineMs    = 0;

  pinMode(pinPWM, OUTPUT);
  pinMode(pinTrans, OUTPUT);
  digitalWrite(pinPWM, LOW);
  digitalWrite(pinTrans, LOW);
}

void ActuatorHAL::commandChannel(ServoChannel &ch, uint8_t pct, uint16_t staggerMs) {
  ch.targetPct = constrain(pct, 0, 100);
  unsigned long now = millis();

#ifdef MOCK_ACTUATORS
  ch.state = CH_IDLE;
  return;
#endif

  if (ch.state == CH_MOVING) {
    int degrees = map(ch.targetPct, 0, 100, 0, 180);
    ch.servo.write(degrees);
    ch.deadlineMs = now + SERVO_TRAVEL_MS;
    return;
  }

  if (staggerMs > 0) {
    ch.state      = CH_WAIT_STAGGER;
    ch.deadlineMs = now + staggerMs;
  } else {
    digitalWrite(ch.pinTransistor, HIGH);
    ch.state      = CH_ENERGIZING;
    ch.deadlineMs = now + SERVO_ENERGIZE_MS;
  }
}

void ActuatorHAL::updateChannel(ServoChannel &ch, unsigned long nowMs) {
  if (ch.state == CH_IDLE) return;
  if ((long)(nowMs - ch.deadlineMs) < 0) return;

  switch (ch.state) {
    case CH_WAIT_STAGGER:
      digitalWrite(ch.pinTransistor, HIGH);
      ch.state      = CH_ENERGIZING;
      ch.deadlineMs = nowMs + SERVO_ENERGIZE_MS;
      break;

    case CH_ENERGIZING: {
      int degrees = map(ch.targetPct, 0, 100, 0, 180);
      ch.servo.attach(ch.pinPWM); // Pulso estándar 544-2400 us compatible con SG90
      ch.servo.write(degrees);
      ch.state      = CH_MOVING;
      ch.deadlineMs = nowMs + SERVO_TRAVEL_MS;
      break;
    }

    case CH_MOVING:
      ch.servo.detach();
      digitalWrite(ch.pinPWM, LOW);
      digitalWrite(ch.pinTransistor, LOW);
      ch.state = CH_IDLE;
      break;

    default:
      ch.state = CH_IDLE;
      break;
  }
}

void ActuatorHAL::moveDispensador(uint8_t pct) {
  commandChannel(_dispChannel, pct, 0);
}

void ActuatorHAL::moveEscotilla(uint8_t pct) {
  commandChannel(_escChannel, pct, 0);
}

void ActuatorHAL::moveBothParallel(uint8_t pctDisp, uint8_t pctEsc, uint16_t staggerMs) {
  commandChannel(_dispChannel, pctDisp, 0);
  commandChannel(_escChannel,  pctEsc,  staggerMs);
}

bool ActuatorHAL::isDispensadorBusy() const {
  return _dispChannel.state != CH_IDLE;
}

bool ActuatorHAL::isEscotillaBusy() const {
  return _escChannel.state != CH_IDLE;
}

void ActuatorHAL::setLedMode(LedMode mode) {
  _ledMode = mode;
  if (mode == LED_MODE_OPERATIVO) {
    digitalWrite(PIN_LED_VERDE, HIGH);
    digitalWrite(PIN_LED_AMARILLO, LOW);
    digitalWrite(PIN_LED_ROJO, LOW);
  } else if (mode == LED_MODE_SIN_COMIDA) {
    digitalWrite(PIN_LED_VERDE, LOW);
    digitalWrite(PIN_LED_AMARILLO, HIGH);
    digitalWrite(PIN_LED_ROJO, LOW);
  } else {
    digitalWrite(PIN_LED_VERDE, LOW);
    digitalWrite(PIN_LED_AMARILLO, LOW);
    _redLedState = true;
    _lastBlinkMs = millis();
    digitalWrite(PIN_LED_ROJO, HIGH);
  }
}

void ActuatorHAL::setActiveAlarm(bool enabled) {
  digitalWrite(PIN_TRANS_BEEPER, enabled ? HIGH : LOW);
}

void ActuatorHAL::playTone(uint16_t freqHz, uint16_t durationMs) {
  tone(PIN_BEEPER_PASIVO, freqHz, durationMs);
}

void ActuatorHAL::update(unsigned long nowMs) {
  updateChannel(_dispChannel, nowMs);
  updateChannel(_escChannel,  nowMs);

  if (_ledMode == LED_MODE_EMERGENCIA) {
    if (nowMs - _lastBlinkMs >= RED_BLINK_MS) {
      _lastBlinkMs = nowMs;
      _redLedState = !_redLedState;
      digitalWrite(PIN_LED_ROJO, _redLedState ? HIGH : LOW);
    }
  }
}
