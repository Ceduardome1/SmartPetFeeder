const uint8_t PINES_BOTONES[4] = {2, 3, 4, 5};
const char* NOMBRES_BOTONES[4] = {
  "Boton 1 (D2 - Cabeza Atorada)",
  "Boton 2 (D3 - Escotilla)",
  "Boton 3 (D4 - Dispensar)",
  "Boton 4 (D5 - Reiniciar)"
};

bool estadoAnterior[4];

void setup() {
  Serial.begin(115200);
  pinMode(LED_BUILTIN, OUTPUT); // LED integrado en la placa del Nano (D13)

  Serial.println(F("=== PRUEBA DE BOTONES (D2 - D5) ==="));

  for (int i = 0; i < 4; i++) {
    pinMode(PINES_BOTONES[i], INPUT_PULLUP);
    estadoAnterior[i] = digitalRead(PINES_BOTONES[i]);

    Serial.print(NOMBRES_BOTONES[i]);
    Serial.print(F(" -> Estado inicial: "));
    Serial.println(estadoAnterior[i] == LOW ? F("PRESIONADO (LOW - revisar giro de patas)") : F("LIBRE (HIGH)"));
  }
  Serial.println(F("-----------------------------------"));
}

void loop() {
  bool algunoPresionado = false;

  for (int i = 0; i < 4; i++) {
    bool lecturaActual = digitalRead(PINES_BOTONES[i]);

    if (lecturaActual == LOW) {
      algunoPresionado = true;
    }

    // Detectar cambio de estado
    if (lecturaActual != estadoAnterior[i]) {
      delay(30); // Antirrebote simple
      lecturaActual = digitalRead(PINES_BOTONES[i]);

      if (lecturaActual != estadoAnterior[i]) {
        estadoAnterior[i] = lecturaActual;
        Serial.print(NOMBRES_BOTONES[i]);
        Serial.println(lecturaActual == LOW ? F(" -> PRESIONADO") : F(" -> SOLTADO"));
      }
    }
  }

  // Enciende el LED integrado del Arduino mientras mantengas pulsado cualquier boton
  digitalWrite(LED_BUILTIN, algunoPresionado ? HIGH : LOW);
}