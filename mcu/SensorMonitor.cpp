#include "SensorMonitor.h"
#include "Config.h"

void SensorMonitor::init() {
  _currentPct      = readFilteredPct();
  _lastReportedPct = _currentPct;
}

uint8_t SensorMonitor::readFilteredPct() {
  uint16_t sum = 0;
  for (uint8_t i = 0; i < 4; i++) {
    sum += analogRead(PIN_POT_NIVEL);
  }
  uint16_t avg = sum >> 2;
  return (uint8_t)map(avg, 0, 1023, 0, 100);
}

bool SensorMonitor::update() {
  _currentPct = readFilteredPct();
  if (abs((int16_t)_currentPct - _lastReportedPct) >= NIVEL_HISTERESIS) {
    _lastReportedPct = _currentPct;
    return true;
  }
  return false;
}
