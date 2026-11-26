#ifndef CONFIG_H
#define CONFIG_H

#include <Arduino.h>

// =========================================================================
// MODO DE PRUEBA (TESTABILITY)
// Descomenta la siguiente línea para probar lógica y JSON sin mover servos
// =========================================================================
// #define MOCK_ACTUATORS

// =========================================================================
// IDENTIDAD DEL NODO M2M
// =========================================================================
#define DEVICE_ID           "SMART_PET_FEEDER_V1"
#define SERIAL_BAUDRATE     115200
#define SERIAL_BUF_SIZE     64

// =========================================================================
// ASIGNACIÓN DE PINES (MAPEO DEFINITIVO CON BOTONES INTERCAMBIADOS)
// =========================================================================
constexpr uint8_t PIN_POT_NIVEL       = A0;

// Botones con Interrupción por Hardware (Lógica INPUT_PULLUP -> LOW activo)
constexpr uint8_t PIN_BTN_DISPENSAR   = 2;   // INT0  (Botón 1 físico)
constexpr uint8_t PIN_BTN_REINICIAR   = 3;   // INT1  (Botón 2 físico)
constexpr uint8_t PIN_BTN_CABEZA      = 4;   // PCINT20 (Botón 3 físico - Prioridad Crítica)
constexpr uint8_t PIN_BTN_ESCOTILLA   = 5;   // PCINT21 (Botón 4 físico - Paro Emergencia)

// Indicadores Visuales LED (Resistencia 220 Ohm a GND)
constexpr uint8_t PIN_LED_VERDE       = 6;
constexpr uint8_t PIN_LED_AMARILLO    = 7;
constexpr uint8_t PIN_LED_ROJO        = 8;

// Actuadores PWM y Etapas de Potencia PN2222
constexpr uint8_t PIN_SERVO_DISP      = 9;   // PWM Dispensador
constexpr uint8_t PIN_SERVO_ESC       = 10;  // PWM Escotilla
constexpr uint8_t PIN_BEEPER_PASIVO   = 11;  // PWM Beeper Pasivo (100 Ohm)
constexpr uint8_t PIN_TRANS_BEEPER    = 12;  // Base PN2222 Beeper Activo (1 kOhm)
constexpr uint8_t PIN_TRANS_DISP      = A1;  // Base PN2222 Servo Dispensador (330 Ohm)
constexpr uint8_t PIN_TRANS_ESC       = A2;  // Base PN2222 Servo Escotilla (330 Ohm)

// =========================================================================
// PARÁMETROS OPERATIVOS Y DE TEMPORIZACIÓN (NO BLOQUEANTES)
// =========================================================================
constexpr uint8_t  NIVEL_UMBRAL_VACIO       = 5;    // <= 5% se considera "Sin comida"
constexpr uint8_t  NIVEL_HISTERESIS         = 2;    // Variación mínima (%) para emitir evento
constexpr uint8_t  ANGULO_DEFECTO_PCT       = 50;   // Apertura dispensador por defecto (50% = 90°)
constexpr uint8_t  ANGULO_MIN_PCT           = 10;
constexpr uint8_t  ANGULO_MAX_PCT           = 100;
constexpr uint8_t  ESCOTILLA_DISP_PCT       = 50;   // Apertura escotilla al dispensar (50% = 90°)
constexpr uint8_t  ESCOTILLA_EMERG_PCT      = 100;  // Apertura máxima escotilla en emergencia (100% = 180°)

constexpr uint16_t DEBOUNCE_MS              = 220;  // Antirrebote por software tras ISR
constexpr uint16_t SERVO_STAGGER_MS         = 35;   // Desfase normal de arranque paralelo
constexpr uint16_t SERVO_EMERG_STAGGER_MS   = 120;  // Desfase en emergencia (garantiza torque completo a 180°)
constexpr uint16_t SERVO_ENERGIZE_MS        = 15;   // Estabilización de transistor PN2222
constexpr uint16_t SERVO_TRAVEL_MS          = 800;  // Tiempo suficiente para recorrido completo 0° <-> 180°
constexpr uint16_t DISPENSE_HOLD_MS         = 450;  // Tiempo que ambos permanecen abiertos
constexpr uint16_t ESCOTILLA_CLOSE_DELAY_MS = 600;  // Espera configurable tras cerrar dispensador antes de cerrar escotilla
constexpr uint16_t RED_BLINK_MS             = 350;  // Periodo de parpadeo LED Rojo en Paro/Emergencia

#endif
