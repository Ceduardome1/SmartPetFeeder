#include "InterruptManager.h"
#include "Config.h"

static volatile bool s_irqDispensar = false;
static volatile bool s_irqReiniciar = false;
static volatile bool s_irqCabeza    = false;
static volatile bool s_irqEscotilla = false;
static volatile uint8_t s_lastPortD = 0xFF;

unsigned long InterruptManager::_lastDebounceDisp      = 0;
unsigned long InterruptManager::_lastDebounceReset     = 0;
unsigned long InterruptManager::_lastDebounceCabeza    = 0;
unsigned long InterruptManager::_lastDebounceEscotilla = 0;

static void isrBtnDispensar() {
  s_irqDispensar = true;
}

static void isrBtnReiniciar() {
  s_irqReiniciar = true;
}

ISR(PCINT2_vect) {
  uint8_t currentPortD = PIND;
  uint8_t changed = currentPortD ^ s_lastPortD;
  s_lastPortD = currentPortD;

  if ((changed & (1 << PD4)) && !(currentPortD & (1 << PD4))) {
    s_irqCabeza = true;
  }
  if ((changed & (1 << PD5)) && !(currentPortD & (1 << PD5))) {
    s_irqEscotilla = true;
  }
}

void InterruptManager::init() {
  pinMode(PIN_BTN_DISPENSAR, INPUT_PULLUP);
  pinMode(PIN_BTN_REINICIAR, INPUT_PULLUP);
  pinMode(PIN_BTN_CABEZA,    INPUT_PULLUP);
  pinMode(PIN_BTN_ESCOTILLA, INPUT_PULLUP);

  attachInterrupt(digitalPinToInterrupt(PIN_BTN_DISPENSAR), isrBtnDispensar, FALLING);
  attachInterrupt(digitalPinToInterrupt(PIN_BTN_REINICIAR), isrBtnReiniciar, FALLING);

  noInterrupts();
  s_lastPortD = PIND;
  PCICR  |= (1 << PCIE2);
  PCMSK2 |= (1 << PCINT20) | (1 << PCINT21);
  interrupts();
}

HardwareEvent InterruptManager::pollEvent(unsigned long nowMs) {
  bool fCabeza, fEscotilla, fReset, fDisp;

  noInterrupts();
  fCabeza    = s_irqCabeza;    s_irqCabeza    = false;
  fEscotilla = s_irqEscotilla; s_irqEscotilla = false;
  fReset     = s_irqReiniciar; s_irqReiniciar = false;
  fDisp      = s_irqDispensar; s_irqDispensar = false;
  interrupts();

  if (fCabeza && (nowMs - _lastDebounceCabeza >= DEBOUNCE_MS)) {
    _lastDebounceCabeza = nowMs;
    return EVT_CABEZA_ATORADA;
  }

  if (fEscotilla && (nowMs - _lastDebounceEscotilla >= DEBOUNCE_MS)) {
    _lastDebounceEscotilla = nowMs;
    return EVT_ALTERNAR_ESCOTILLA;
  }

  if (fReset && (nowMs - _lastDebounceReset >= DEBOUNCE_MS)) {
    _lastDebounceReset = nowMs;
    return EVT_REINICIAR;
  }

  if (fDisp && (nowMs - _lastDebounceDisp >= DEBOUNCE_MS)) {
    _lastDebounceDisp = nowMs;
    return EVT_DISPENSAR;
  }

  return EVT_NONE;
}
