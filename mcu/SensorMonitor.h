#ifndef SENSOR_MONITOR_H
#define SENSOR_MONITOR_H

#include <Arduino.h>

class SensorMonitor {
public:
  void init();
  bool update();
  uint8_t getLevelPct() const { return _currentPct; }

private:
  uint8_t _currentPct;
  int16_t _lastReportedPct;
  uint8_t readFilteredPct();
};

#endif
