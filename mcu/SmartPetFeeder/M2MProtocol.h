#ifndef M2M_PROTOCOL_H
#define M2M_PROTOCOL_H

#include <Arduino.h>
#include "StateMachine.h"
#include "Config.h"

class M2MProtocol {
public:
  void init(StateMachine* sm);
  void pollSerial();
  static void emitEvent(const char* eventName, SystemState state, uint8_t level, uint8_t angle, bool hatchOpen);

private:
  StateMachine* _sm;
  char    _rxBuffer[SERIAL_BUF_SIZE];
  uint8_t _rxIndex;
  bool    _overflowFlag;

  void parseLine(const char* line);
};

#endif
