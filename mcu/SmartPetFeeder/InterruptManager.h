#ifndef INTERRUPT_MANAGER_H
#define INTERRUPT_MANAGER_H

#include <Arduino.h>

enum HardwareEvent {
  EVT_NONE = 0,
  EVT_CABEZA_ATORADA,     // Máxima prioridad (D4 / PCINT20)
  EVT_ALTERNAR_ESCOTILLA, // Alta prioridad (D5 / PCINT21)
  EVT_REINICIAR,          // Recuperación (D3 / INT1)
  EVT_DISPENSAR           // Operativa (D2 / INT0)
};

class InterruptManager {
public:
  static void init();
  static HardwareEvent pollEvent(unsigned long nowMs);

private:
  static unsigned long _lastDebounceDisp;
  static unsigned long _lastDebounceReset;
  static unsigned long _lastDebounceCabeza;
  static unsigned long _lastDebounceEscotilla;
};

#endif
