#include "M2MProtocol.h"
#include <string.h>
#include <stdlib.h>

void M2MProtocol::init(StateMachine* sm) {
  _sm           = sm;
  _rxIndex      = 0;
  _overflowFlag = false;
  memset(_rxBuffer, 0, sizeof(_rxBuffer));
}

void M2MProtocol::pollSerial() {
  while (Serial.available() > 0) {
    char c = (char)Serial.read();

    if (c == '\r') continue;

    if (c == '\n') {
      if (_overflowFlag) {
        _overflowFlag = false;
        _rxIndex = 0;
      } else if (_rxIndex > 0) {
        _rxBuffer[_rxIndex] = '\0';
        parseLine(_rxBuffer);
        _rxIndex = 0;
      }
      continue;
    }

    if (!_overflowFlag) {
      if (_rxIndex < (SERIAL_BUF_SIZE - 1)) {
        _rxBuffer[_rxIndex++] = c;
      } else {
        _overflowFlag = true;
      }
    }
  }
}

void M2MProtocol::parseLine(const char* line) {
  if (strcmp(line, "CMD_PING") == 0) {
    Serial.print(F("{\"evento\":\"PONG\",\"dispositivo\":\""));
    Serial.print(F(DEVICE_ID));
    Serial.println(F("\"}"));
    // Fase 4 (README 1.2): sincronización inmediata de estado inicial tras handshake
    if (_sm) {
      _sm->onSyncState();
    }
  }
  else if (strcmp(line, "CMD_DISPENSAR") == 0) {
    _sm->onRequestDispensar();
  }
  else if (strcmp(line, "CMD_PARO_EMERGENCIA") == 0 || strcmp(line, "CMD_ESCOTILLA") == 0) {
    _sm->onRemoteParoEmergencia();
  }
  else if (strcmp(line, "CMD_REINICIAR") == 0) {
    _sm->onRequestReiniciar();
  }
  else if (strncmp(line, "CMD_ANGULO:", 11) == 0) {
    const char* arg = line + 11;
    if (*arg != '\0') {
      int val = atoi(arg);
      if (val >= ANGULO_MIN_PCT && val <= ANGULO_MAX_PCT) {
        _sm->onSetAngulo(val);
      }
    }
  }
}

void M2MProtocol::emitEvent(const char* eventName, SystemState state, uint8_t level, uint8_t angle, bool hatchOpen) {
  const char* stateStr = "OPERATIVO";
  switch (state) {
    case STATE_OPERATIVO:       stateStr = "OPERATIVO";       break;
    case STATE_SIN_COMIDA:      stateStr = "SIN_COMIDA";      break;
    case STATE_PARO_EMERGENCIA: stateStr = "PARO_EMERGENCIA"; break;
    case STATE_CABEZA_ATORADA:  stateStr = "CABEZA_ATORADA";  break;
  }

  char jsonOut[128];
  snprintf(
    jsonOut,
    sizeof(jsonOut),
    "{\"evento\":\"%s\",\"estado\":\"%s\",\"nivel\":%u,\"angulo\":%u,\"escotilla\":%s}",
    eventName,
    stateStr,
    level,
    angle,
    hatchOpen ? "true" : "false"
  );

  Serial.println(jsonOut);

  if (state == STATE_CABEZA_ATORADA || state == STATE_PARO_EMERGENCIA) {
    Serial.flush();
  }
}
