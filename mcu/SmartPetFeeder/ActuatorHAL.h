#ifndef ACTUATOR_HAL_H
#define ACTUATOR_HAL_H

#include <Arduino.h>
#include <Servo.h>
#include "Config.h"

enum LedMode {
  LED_MODE_OPERATIVO,     // Verde fijo
  LED_MODE_SIN_COMIDA,    // Amarillo fijo
  LED_MODE_EMERGENCIA     // Rojo parpadeante
};

class ActuatorHAL {
public:
  void init();
  void update(unsigned long nowMs);

  void moveDispensador(uint8_t pct);
  void moveEscotilla(uint8_t pct);
  void moveBothParallel(uint8_t pctDisp, uint8_t pctEsc, uint16_t staggerMs = SERVO_STAGGER_MS);
  bool isDispensadorBusy() const;
  bool isEscotillaBusy() const;

  void setLedMode(LedMode mode);
  void setActiveAlarm(bool enabled);
  void playTone(uint16_t freqHz, uint16_t durationMs);

private:
  enum ChannelState {
    CH_IDLE,
    CH_WAIT_STAGGER,
    CH_ENERGIZING,
    CH_MOVING
  };

  struct ServoChannel {
    Servo servo;
    uint8_t pinPWM;
    uint8_t pinTransistor;
    uint8_t targetPct;
    ChannelState state;
    unsigned long deadlineMs;
  };

  ServoChannel _dispChannel;
  ServoChannel _escChannel;

  LedMode _ledMode;
  unsigned long _lastBlinkMs;
  bool _redLedState;

  void initChannel(ServoChannel &ch, uint8_t pinPWM, uint8_t pinTrans);
  void commandChannel(ServoChannel &ch, uint8_t pct, uint16_t staggerMs);
  void updateChannel(ServoChannel &ch, unsigned long nowMs);
};

#endif
