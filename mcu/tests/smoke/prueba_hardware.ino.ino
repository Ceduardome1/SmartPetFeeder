#include <Arduino.h>
#include <Servo.h>

// =========================================================================
// MAPA DE PINES DEL HARDWARE
// =========================================================================
const uint8_t PIN_POT          = A0;
const uint8_t PIN_BTN_1        = 2;   // INT0: +10 grados a ambos servos
const uint8_t PIN_BTN_2        = 3;   // INT1: Reiniciar servos a 0 grados
const uint8_t PIN_BTN_3        = 4;   // PCINT20: Alternar LEDs ON / OFF
const uint8_t PIN_BTN_4        = 5;   // PCINT21: Pitido en Zumbador Activo

const uint8_t PIN_LED_VERDE    = 6;
const uint8_t PIN_LED_AMARILLO = 7;
const uint8_t PIN_LED_ROJO     = 8;

const uint8_t PIN_SERVO_DISP   = 9;   // PWM Servo Dispensador
const uint8_t PIN_SERVO_ESC    = 10;  // PWM Servo Escotilla
const uint8_t PIN_BEEPER_PAS   = 11;  // PWM Zumbador Pasivo (100 Ohm)
const uint8_t PIN_TRANS_BEEPER = 12;  // Base PN2222 Zumbador Activo (1 kOhm)
const uint8_t PIN_TRANS_DISP   = A1;  // Base PN2222 Servo Dispensador (330 Ohm)
const uint8_t PIN_TRANS_ESC    = A2;  // Base PN2222 Servo Escotilla (330 Ohm)

// =========================================================================
// BANDERAS DE INTERRUPCIÓN (VOLATILE)
// =========================================================================
volatile bool irqBtn1 = false;
volatile bool irqBtn2 = false;
volatile bool irqBtn3 = false;
volatile bool irqBtn4 = false;
volatile uint8_t ultimoPuertoD = 0xFF;

// =========================================================================
// VARIABLES DE ESTADO DE DEPURACIÓN
// =========================================================================
Servo servoDispensador;
Servo servoEscotilla;

int anguloActual       = 0;     // Posición actual de ambos servos (0° - 180°)
bool ledsHabilitados   = true;  // Alternado por Botón 3
bool estadoParpadeo    = false;
int nivelPct           = 0;
int ultimoNivelLog     = -10;
uint8_t ultimaZona     = 255;   // 0 = Bajo, 1 = Medio, 2 = Alto

// Temporizadores no bloqueantes (millis)
unsigned long tDeb1 = 0, tDeb2 = 0, tDeb3 = 0, tDeb4 = 0;
unsigned long tParpadeoLed     = 0;
unsigned long tFinBeeperActivo = 0;

// =========================================================================
// RUTINAS DE SERVICIO DE INTERRUPCIÓN (ISR)
// =========================================================================
void isrBoton1() { irqBtn1 = true; }
void isrBoton2() { irqBtn2 = true; }

ISR(PCINT2_vect) {
  uint8_t lectura = PIND;
  uint8_t cambios = lectura ^ ultimoPuertoD;
  ultimoPuertoD = lectura;

  // Flanco de bajada (1 -> 0) en D4 (PD4)
  if ((cambios & (1 << PD4)) && !(lectura & (1 << PD4))) {
    irqBtn3 = true;
  }
  // Flanco de bajada (1 -> 0) en D5 (PD5)
  if ((cambios & (1 << PD5)) && !(lectura & (1 << PD5))) {
    irqBtn4 = true;
  }
}

// =========================================================================
// CONTROL SEGURO DE SERVOMOTORES CON TRANSISTORES PN2222
// =========================================================================
void moverServoSeguro(Servo &servo, uint8_t pinPWM, uint8_t pinTransistor, int grados) {
  grados = constrain(grados, 0, 180);

  // 1. Saturar transistor PN2222 (energizar servo)
  digitalWrite(pinTransistor, HIGH);
  delay(15);

  // 2. Enviar señal PWM y esperar movimiento
  servo.attach(pinPWM);
  servo.write(grados);
  delay(300);

  // 3. Liberar PWM antes de apagar transistor (evita fuga por pin de señal)
  servo.detach();
  digitalWrite(pinPWM, LOW);
  digitalWrite(pinTransistor, LOW);
}

void moverAmbosServosSecuencial(int grados) {
  moverServoSeguro(servoDispensador, PIN_SERVO_DISP, PIN_TRANS_DISP, grados);
  moverServoSeguro(servoEscotilla, PIN_SERVO_ESC, PIN_TRANS_ESC, grados);
}

// =========================================================================
// RETROALIMENTACIÓN SONORA (ZUMBADOR PASIVO)
// =========================================================================
void pitidoConfirmacion(uint16_t frecuencia) {
  // Nota: tone() usa Timer2, por lo que no interfiere con Servo.h (Timer1)
  tone(PIN_BEEPER_PAS, frecuencia, 65);
}

// =========================================================================
// REPORTE DE ESTADO EN CONSOLA SERIAL
// =========================================================================
void imprimirEstadoConsola(const char* evento) {
  const char* textoNivel = (nivelPct <= 33) ? "BAJO (LED Rojo)" :
                           (nivelPct <= 66) ? "MEDIO (LED Amarillo)" :
                                              "ALTO (LED Verde)";

  Serial.print(F("[EVENTO: "));
  Serial.print(evento);
  Serial.print(F("] | Potenciometro: "));
  Serial.print(nivelPct);
  Serial.print(F("% - "));
  Serial.print(textoNivel);
  Serial.print(F(" | Servos: "));
  Serial.print(anguloActual);
  Serial.print(F(" deg | LEDs: "));
  Serial.println(ledsHabilitados ? F("ENCENDIDOS (Parpadeando)") : F("APAGADOS"));
}

// =========================================================================
// CONFIGURACIÓN INICIAL (SETUP)
// =========================================================================
void setup() {
  Serial.begin(115200);

  pinMode(PIN_BTN_1, INPUT_PULLUP);
  pinMode(PIN_BTN_2, INPUT_PULLUP);
  pinMode(PIN_BTN_3, INPUT_PULLUP);
  pinMode(PIN_BTN_4, INPUT_PULLUP);

  pinMode(PIN_LED_VERDE,    OUTPUT);
  pinMode(PIN_LED_AMARILLO, OUTPUT);
  pinMode(PIN_LED_ROJO,     OUTPUT);
  pinMode(PIN_BEEPER_PAS,   OUTPUT);
  pinMode(PIN_TRANS_BEEPER, OUTPUT);
  pinMode(PIN_TRANS_DISP,   OUTPUT);
  pinMode(PIN_TRANS_ESC,    OUTPUT);

  digitalWrite(PIN_TRANS_BEEPER, LOW);
  digitalWrite(PIN_TRANS_DISP,   LOW);
  digitalWrite(PIN_TRANS_ESC,    LOW);

  Servo servoDispensador;
  Servo servoEscotilla;
  
  // Posicionar ambos servos en 0° al arrancar
  moverAmbosServosSecuencial(0);

  // Habilitar interrupciones externas D2 (INT0) y D3 (INT1)
  attachInterrupt(digitalPinToInterrupt(PIN_BTN_1), isrBoton1, FALLING);
  attachInterrupt(digitalPinToInterrupt(PIN_BTN_2), isrBoton2, FALLING);

  // Habilitar interrupciones por cambio de pin en D4 (PCINT20) y D5 (PCINT21)
  ultimoPuertoD = PIND;
  PCICR  |= (1 << PCIE2);
  PCMSK2 |= (1 << PCINT20) | (1 << PCINT21);

  Serial.println(F("========================================================="));
  Serial.println(F("   PILOTO DE DEPURACION DE HARDWARE - INICIADO (115200)  "));
  Serial.println(F("========================================================="));
  Serial.println(F("Btn 1 (D2): +10 deg Servos | Btn 2 (D3): Reset Servos 0 deg"));
  Serial.println(F("Btn 3 (D4): LEDs ON/OFF    | Btn 4 (D5): Pitido Beeper Activo"));
  Serial.println(F("---------------------------------------------------------"));

  nivelPct = map(analogRead(PIN_POT), 0, 1023, 0, 100);
  ultimoNivelLog = nivelPct;
  imprimirEstadoConsola("ARRANQUE_SISTEMA");
}

// =========================================================================
// BUCLE PRINCIPAL (LOOP)
// =========================================================================
void loop() {
  unsigned long ahora = millis();

  // --- BOTÓN 1 (D2): Mover ambos servos +10 grados ---
  if (irqBtn1) {
    irqBtn1 = false;
    if (ahora - tDeb1 > 220) {
      tDeb1 = ahora;
      pitidoConfirmacion(1000);
      anguloActual = min(180, anguloActual + 10);
      moverAmbosServosSecuencial(anguloActual);
      imprimirEstadoConsola("BTN1_SERVOS_+10");
    }
  }

  // --- BOTÓN 2 (D3): Reiniciar ambos servos a 0 grados ---
  if (irqBtn2) {
    irqBtn2 = false;
    if (ahora - tDeb2 > 220) {
      tDeb2 = ahora;
      pitidoConfirmacion(750);
      anguloActual = 0;
      moverAmbosServosSecuencial(anguloActual);
      imprimirEstadoConsola("BTN2_SERVOS_RESET_0");
    }
  }

  // --- BOTÓN 3 (D4): Alternar LEDs entre Encendido y Apagado ---
  if (irqBtn3) {
    irqBtn3 = false;
    if (ahora - tDeb3 > 220) {
      tDeb3 = ahora;
      pitidoConfirmacion(1250);
      ledsHabilitados = !ledsHabilitados;
      if (!ledsHabilitados) {
        digitalWrite(PIN_LED_VERDE, LOW);
        digitalWrite(PIN_LED_AMARILLO, LOW);
        digitalWrite(PIN_LED_ROJO, LOW);
      }
      imprimirEstadoConsola("BTN3_ALTERNAR_LEDS");
    }
  }

  // --- BOTÓN 4 (D5): Pitido breve en Zumbador Activo ---
  if (irqBtn4) {
    irqBtn4 = false;
    if (ahora - tDeb4 > 220) {
      tDeb4 = ahora;
      pitidoConfirmacion(1500);
      digitalWrite(PIN_TRANS_BEEPER, HIGH);
      tFinBeeperActivo = ahora + 200; // Duración de 200 ms sin bloquear
      imprimirEstadoConsola("BTN4_BEEPER_ACTIVO");
    }
  }

  // Apagar Zumbador Activo cuando expire su tiempo
  if (tFinBeeperActivo > 0 && ahora >= tFinBeeperActivo) {
    digitalWrite(PIN_TRANS_BEEPER, LOW);
    tFinBeeperActivo = 0;
  }

  // --- LECTURA DEL POTENCIÓMETRO Y SELECCIÓN DE LED ---
  nivelPct = map(analogRead(PIN_POT), 0, 1023, 0, 100);
  uint8_t zonaActual = (nivelPct <= 33) ? 0 : (nivelPct <= 66) ? 1 : 2;

  // Reportar en consola si cambia la zona o varía >= 5%
  if (zonaActual != ultimaZona || abs(nivelPct - ultimoNivelLog) >= 5) {
    ultimaZona = zonaActual;
    ultimoNivelLog = nivelPct;
    imprimirEstadoConsola("CAMBIO_POTENCIOMETRO");
  }

  // --- PARPADEO NO BLOQUEANTE DEL LED CORRESPONDIENTE ---
  if (ledsHabilitados && (ahora - tParpadeoLed >= 300)) {
    tParpadeoLed = ahora;
    estadoParpadeo = !estadoParpadeo;

    // Apagar todos primero para asegurar que solo parpadee 1
    digitalWrite(PIN_LED_ROJO, LOW);
    digitalWrite(PIN_LED_AMARILLO, LOW);
    digitalWrite(PIN_LED_VERDE, LOW);

    if (estadoParpadeo) {
      if (zonaActual == 0)      digitalWrite(PIN_LED_ROJO, HIGH);     // Bajo (0% - 33%)
      else if (zonaActual == 1) digitalWrite(PIN_LED_AMARILLO, HIGH); // Medio (34% - 66%)
      else                      digitalWrite(PIN_LED_VERDE, HIGH);    // Alto (67% - 100%)
    }
  }
}