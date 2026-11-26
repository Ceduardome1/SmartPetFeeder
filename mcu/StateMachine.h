#ifndef STATE_MACHINE_H
#define STATE_MACHINE_H

#include <Arduino.h>
#include "ActuatorHAL.h"

enum SystemState {
  STATE_OPERATIVO,
  STATE_SIN_COMIDA,
  STATE_PARO_EMERGENCIA,
  STATE_CABEZA_ATORADA
};

typedef void (*EventCallback)(const char* eventName, SystemState state, uint8_t level, uint8_t angle, bool hatchOpen);

class StateMachine {
public:
  void init(ActuatorHAL* hal, uint8_t initialLevel, EventCallback onEvent);
  void update(unsigned long nowMs);

  void onCabezaAtorada();
  void onToggleEscotilla();
  void onRequestDispensar();
  void onRequestReiniciar();
  void onRemoteParoEmergencia();
  void onSetAngulo(int newAngle);
  void onLevelChanged(uint8_t newLevel);
  void onUnhandledException();

  SystemState getState() const { return _state; }
  uint8_t getLevel() const { return _levelPct; }
  uint8_t getAngulo() const { return _anguloDisp; }
  bool isEscotillaAbierta() const { return _escotillaAbierta; }

private:
  enum DispensePhase {
    DISP_IDLE,
    DISP_OPENING,
    DISP_HOLDING,
    DISP_CLOSING_DISP,
    DISP_WAIT_ESCOTILLA,
    DISP_CLOSING_ESC
  };

  ActuatorHAL*  _hal;
  EventCallback _emit;
  SystemState   _state;
  DispensePhase _dispPhase;
  unsigned long _phaseDeadline;

  uint8_t _levelPct;
  uint8_t _anguloDisp;
  bool    _escotillaAbierta;

  void enterParoEmergencia(bool isCabezaAtorada);
  void emitCurrent(const char* eventName);
};

#endif
