#include <Arduino.h>
#include <avr/wdt.h>
#include "Config.h"
#include "InterruptManager.h"
#include "ActuatorHAL.h"
#include "SensorMonitor.h"
#include "StateMachine.h"
#include "M2MProtocol.h"

ActuatorHAL   g_hal;
SensorMonitor g_sensor;
StateMachine  g_stateMachine;
M2MProtocol   g_protocol;

void setup() {
  wdt_disable();

  Serial.begin(SERIAL_BAUDRATE);

  g_hal.init();
  g_sensor.init();
  g_protocol.init(&g_stateMachine);
  g_stateMachine.init(&g_hal, g_sensor.getLevelPct(), M2MProtocol::emitEvent);

  InterruptManager::init();

  wdt_enable(WDTO_2S);
}

void loop() {
  wdt_reset();

  unsigned long now = millis();

  HardwareEvent hwEvt = InterruptManager::pollEvent(now);
  switch (hwEvt) {
    case EVT_CABEZA_ATORADA:
      g_stateMachine.onCabezaAtorada();
      break;
    case EVT_ALTERNAR_ESCOTILLA:
      g_stateMachine.onToggleEscotilla();
      break;
    case EVT_REINICIAR:
      g_stateMachine.onRequestReiniciar();
      break;
    case EVT_DISPENSAR:
      g_stateMachine.onRequestDispensar();
      break;
    case EVT_NONE:
    default:
      break;
  }

  if (g_sensor.update()) {
    g_stateMachine.onLevelChanged(g_sensor.getLevelPct());
  }

  g_protocol.pollSerial();

  g_stateMachine.update(now);
  g_hal.update(now);
}
