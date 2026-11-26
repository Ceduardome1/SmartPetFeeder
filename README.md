**TECNOLÓGICO NACIONAL DE MÉXICO.**

**INSTITUTO TECNOLÓGICO DE CULIACÁN.**

**CARRERA:** INGENIERÍA EN SISTEMAS COMPUTACIONALES.

**ASUNTO:** PROYECTO FINAL \- DISPENSADOR DE COMIDA PARA MASCOTAS.

**MATERIA:** SISTEMAS PROGRAMABLES.

 

**EQUIPO 1:**

* Ayala Rodriguez José Ernesto.

* Madrid Alvarez Juan Emilio.

* Meza Escobar César Eduardo.

* Medrano Urias Vanessa Guadalupe.

**DOCENTE:** JUAN MANUEL FERREIRO TORRES.

**FECHA ENTREGA:** 01-12-26.

# 

# 

# 

# 

# 

# 

# 

## 

## **DOCUMENTO DE ESPECIFICACIÓN DE REQUERIMIENTOS DEL SISTEMA**

## ***ESPECIFICACIÓN DE REQUERIMIENTOS DEL SISTEMA***

**Proyecto:** Prototipo de Dispensador Inteligente de Alimento para Mascotas  
**Enfoque:** Arquitectura HMI (Tangible \+ Web), Comunicación M2M y Contrato de Interfaz

### **1\. Alcance y Propósito del Prototipo**

### **1.1 Propósito**

Definir de forma clara y estructurada el comportamiento funcional, el alcance y la matriz de entradas/salidas de la **Interfaz Hombre-Máquina (HMI)** y **Máquina-Máquina (M2M)** del prototipo, sirviendo como especificación base para el equipo encargado de desarrollar la interfaz web.

### **1.2 Alcance del Sistema**

El sistema es un **prototipo funcional de demostración** (no un producto comercial terminado) dividido en dos nodos acoplados mediante comunicación serial orientada a eventos (M2M):

1. **Nodo Físico (HMI Tangible y Control):** Unidad embebida que lee el nivel simulado de alimento, atiende botones físicos de operación/emergencia y gobierna dos servomotores (dispensador y escotilla), señalización luminosa por severidad y alarmas acústicas diferenciadas.  
2. **Nodo Web (HMI Remota y Bitácora):** Aplicación web que visualiza en tiempo real el estado del hardware, registra una bitácora cronológica de eventos, despliega alertas críticas y permite al usuario enviar comandos remotos de dispensación, ajuste de apertura y reinicio de flujo.  
   

### **1.3 Nicho de Mercado Competitivo**

* **Segmento objetivo:** Dueños de mascotas domésticas que pasan jornadas prolongadas fuera de casa y requieren control estricto de porciones (mascotas con sobrepeso, ansiedad alimentaria o dietas veterinarias).  
* **Diferenciador competitivo:** Frente a dispensadores genéricos de temporizador ciego, el sistema incorpora **control de apertura variable**, **validación de disponibilidad de alimento**, **escotilla de acceso independiente con apertura de emergencia anti-atrapamiento** y **monitoreo remoto en tiempo real**.

## 

## 

## 


  


  


  

  ### **1.4 Glosario**


* **Cabeza Atorada (Obstrucción Crítica):** Evento de seguridad de máxima prioridad (simulado mediante el botón físico homónimo) que representa la presencia física o atrapamiento de la mascota en el área de acceso al tazón. Dispara de inmediato la rutina de *Paro de Emergencia* (apertura total de escotilla al `100%`, cierre total del dispensador al `0%`, parpadeo del LED rojo y bloqueo operativo) **acompañada de la alarma sonora crítica continua (Beeper Activo)**.  
    
* **Paro de Emergencia:** Estado de protección general del sistema ante cualquier excepción no manejada, falla operativa o apertura manual de la escotilla (`CMD_ESCOTILLA`). Ejecuta la rutina de seguridad estándar: cierre total del dispensador (`0%`), apertura total de la escotilla (`100%`), parpadeo continuo del LED rojo y bloqueo de dispensaciones hasta ejecutar `Reiniciar` (**sin** activar la alarma sonora crítica, reservada exclusivamente para *Cabeza atorada*).  
* **Rutina de Ejecución en Hardware (Comportamiento Estándar):**  
  * **Servo Dispensador:** Se cierra totalmente (`0%`).  
  * **Servo Escotilla:** Se abre a tope (`100%`).  
  * **LED Rojo:** Parpadea de forma continua mientras persista el estado.  
  * **Bloqueo Lógico:** Se inhabilita cualquier orden de dispensación (física o remota) hasta que el usuario ejecute la acción **`Reiniciar`**.  
* **Niveles de Disparadores:**  
  * **Eventos Críticos Generales / Fallas / Apertura de Escotilla (`CMD_ESCOTILLA`):** Activan la rutina estándar de *Paro de Emergencia* descrita arriba (**sin** activar la alarma sonora continua).  
  * **Evento Crítico `Cabeza Atorada` (Excepción de Máxima Prioridad):** Ejecuta la rutina completa de *Paro de Emergencia* **más** la activación simultánea de la **alarma sonora crítica (Beeper Activo)**.


* **Dispensador (Servo Dispensador):** Actuador mecánico encargado de liberar la porción de alimento desde el depósito. Inicia normalmente cerrado (`0%`) y su ángulo de apertura es configurable desde la interfaz web (`50%` por defecto).  
    
* **Escotilla (Servo Escotilla):** Actuador mecánico binario (Abierto `100%` / Cerrado `0%`) que regula el acceso físico de la mascota al tazón. Inicia normalmente cerrada (`0%`) y no es configurable por ángulo intermedio.  
    
* **Sin Comida (Agotamiento de Reserva):** Condición operativa detectada cuando la lectura analógica del potenciómetro desciende al umbral mínimo (`0%`). Enciende el LED amarillo, emite una advertencia sonora breve en el beeper pasivo e impide cualquier ciclo de dispensación hasta que se restablezca el nivel.  
    
* **Reinicio Lógico (`Reiniciar` / `CMD_REINICIAR`):** Acción de recuperación ejecutada por el usuario (vía botón físico o interfaz web) para sacar al sistema de un *Paro de Emergencia* o estado de alerta. Restablece las banderas internas del programa, apaga las alertas visuales/sonoras, devuelve ambos actuadores a cerrado (`0%`) y retorna al estado operativo normal (LED verde) **sin reiniciar eléctricamente el microcontrolador**.  
    
* **HMI (*Human-Machine Interface* / Interfaz Hombre-Máquina):** Conjunto de elementos de interacción entre el usuario y el sistema, dividida en **HMI Física/Tangible** (potenciómetro, botones pulsadores, LEDs y beepers en el prototipo) y **HMI Remota/Gráfica** (aplicación web de monitoreo, configuración y bitácora).  
    
* **M2M (*Machine-to-Machine* / Comunicación Máquina-Máquina):** Intercambio autónomo y bidireccional de mensajes estructurados (eventos y comandos) entre la unidad de control embebida y el servidor de la interfaz web a través de enlace serial orientado a eventos.  
    
* **Bitácora de Eventos:** Registro cronológico persistente en la interfaz web que documenta con fecha, hora y descripción cada acción ejecutada, solicitud rechazada, cambio de estado o evento crítico ocurrido en el hardware.

## 


  


  


  


  


  


  


  


  


  


  


  


  

### **2\. Especificación de Entradas y Salidas**

Para que el equipo de desarrollo web conozca exactamente qué señales genera el hardware y qué acciones puede controlar desde la pantalla, el sistema se define bajo la siguiente matriz:

### 

| 2.1 Entradas del Sistema |  |  |  |
| :---- | :---- | :---- | :---- |
| **Origen** | **Elemento** | **Tipo de Señal** | **Descripción Funcional** |
| **Físico** | **Potenciómetro** | Analógica contínua (0% – 100%) | Simula el nivel de comida disponible en el depósito. Define si hay reserva suficiente o estado *"Sin comida"*. |
| **Físico** | **Botón** Alerta Cabeza Atorada | Digital (Prioridad Crítica) | Simula la obstrucción de la mascota. Interrumpe el flujo normal, fuerza apertura total de escotilla, cierra el dispensador y dispara alarma crítica. |
| **Físico** | **Botón** Dispensar | Digital (Operativa) | Solicita una dispensación manual local (si el sistema está operativo y hay comida). Si no hay comida, rechaza la acción y activa advertencia leve. |
| **Físico** | **Botón** Reiniciar | Digital (Recuperación) | Restablece el flujo lógico del programa tras un evento crítico o paro de escotilla (sin reiniciar el MCU) y devuelve ambos actuadores a cerrado. |
| **Web (GUI)** | **Control** Ángulo Dispensador | Parámetro numérico (0° – 180° / 0% – 100%) | Define cuánto abrirá el servo dispensador en cada porción. **Valor por defecto: 50% (mitad)**. |
| **Web (GUI)** | **Interruptor** Paro de emergencia | Comando remoto | Alterna la escotilla entre cerrada y abierta. Al abrirse, fuerza un **Paro de Emergencia** (dispensador a `0%`, escotilla a `100%`, LED rojo parpadeando) hasta que se ejecute `Reiniciar`. |
| **Web (GUI)** | **Botón Web** Dispensar | Comando remoto | Ejecuta la misma solicitud de dispensación que el botón físico, sujeta a las reglas de seguridad y nivel de comida. |
| **Web (GUI)** | **Botón Web** Reiniciar Flujo | Comando remoto | Restablece el estado de alarma/bloqueo de forma remota equivalente al botón físico Reiniciar. |

### 

### 

| 2.2 Salidas del Sistema |  |  |  |
| :---- | :---- | :---- | :---- |
| **Destino** | **Elemento** | **Tipo de Salida** | **Comportamiento Esperado** |
| **Físico** | **Servo Dispensador** | Actuador angular (con etapa de corte) | Abre al ángulo configurado por la web (50% por defecto) para dosificar y vuelve a cerrar. Se cierra al 0% en emergencia. |
| **Físico** | **Servo Escotilla** | Actuador binario (Abierto / Cerrado) | Controla el acceso al tazón. Abre/cierra totalmente en operación normal; se **abre a tope (100%)** ante *"Cabeza atorada"*. |
| **Físico** | **LED Verde** | Indicador visual | Encendido cuando el sistema está operativo y listo para funcionar. |
| **Físico** | **LED Amarillo** | Indicador visual | Encendido cuando el nivel de comida es nulo/insuficiente o se intenta dispensar sin comida. |
| **Físico** | **LED Rojo** | Indicador visual | **Parpadea** ante cualquier *Paro de Emergencia* (fallas, excepciones no manejadas, apertura de escotilla o *Cabeza atorada*). |
| **Físico** | **Beeper Activo** | Alarma sonora crítica | Emite tono continuo de alta prioridad **únicamente** ante el evento de *Cabeza atorada* (sumándose a la rutina de *Paro de Emergencia*). |
| **Físico** | **Beeper Pasivo** | Retroalimentación sonora leve | Emite pitidos breves de confirmación al pulsar botones, al reiniciar el flujo o al quedarse sin comida. |
| **Web (GUI)** | **Panel de Estado en Vivo** | Visualización dinámica | Muestra porcentaje actual de comida (potenciómetro), ángulo configurado, estado de escotilla y semáforo de estado (Normal / Sin comida / Crítico). |
| **Web (GUI)** | **Banner de Alerta Crítica** | Notificación prioritaria | Aviso visual destacado en pantalla cuando el sistema entra en *Paro de Emergencia* (por *Cabeza atorada*, falla/excepción o apertura de escotilla) o ante *Agotamiento de comida*. |
| **Web (GUI)** | **Bitácora de Eventos** | Registro cronológico | Historial con fecha, hora y descripción de cada dispensación, cambio de nivel, rechazo o alerta crítica. |

## 

## **3\. Contrato de Interfaz M2M**

La interfaz web no consulta continuamente al hardware (*polling*), sino que reacciona a **eventos asíncronos** emitidos por el controlador y envía **comandos puntuales**:

### **3.1 Eventos que la Web / Backend Recibe del Hardware**

* **PONG**: Respuesta de identificación inmediata al recibir CMD\_PING ({"evento":"PONG","dispositivo":"SMART\_PET\_FEEDER\_V1"}). Confirma el puerto serial activo durante el descubrimiento automático de sesión.  
* **ESTADO\_NIVEL**: Actualiza en tiempo real el porcentaje leído del potenciómetro y cambia el estado a *"Sin comida"* si cae al umbral mínimo.  
* **DISPENSACION\_EXITOSA**: Confirma que el servo dispensador abrió al ángulo configurado y completó su ciclo de dosificación. Registra en bitácora.  
* **SIN\_COMIDA**: Notifica que el depósito alcanzó el umbral vacío o se intentó dispensar sin comida (LED amarillo \+ aviso leve activo). Registra en bitácora.  
* **PARO\_EMERGENCIA**: Notifica que ocurrió una falla, excepción no manejada, apertura manual de escotilla o solicitud remota de paro (dispensador cerrado a 0%, escotilla abierta a 100%, LED rojo parpadeando, sin alarma sonora). Bloquea el sistema hasta recibir CMD\_REINICIAR. Registra en bitácora.  
* **ALERTA\_CABEZA\_ATORADA**: Subtipo de *Paro de Emergencia* de máxima prioridad. Informa que se ejecutó la rutina de paro (escotilla 100%, dispensador 0%, LED rojo parpadeando) **más** la activación del **Beeper Activo**. Registra en bitácora.  
* **FLUJO\_REINICIADO**: Confirma que el sistema salió del estado de bloqueo/emergencia, cerró ambos actuadores (0%) y volvió a operación normal (LED verde). Registra en bitácora.

### **3.2 Comandos que la Web / Backend Envía al Hardware**

* **CMD\_PING**: Verifica identidad y disponibilidad del nodo embebido durante el inicio de sesión (*handshake*) para enlazar el puerto serial automáticamente.  
* **CMD\_DISPENSAR**: Solicita iniciar un ciclo de dispensación.  
* **CMD\_PARO\_EMERGENCIA**: Solicita activar la rutina de *Paro de Emergencia* (cierra dispensador a 0%, abre escotilla a 100% y activa parpadeo de LED rojo) hasta recibir CMD\_REINICIAR.  
* **CMD\_ANGULO:\<valor\>**: Actualiza el ángulo de apertura del servo dispensador (por defecto inicializado en 50%).  
* **CMD\_REINICIAR**: Restablece el flujo lógico del programa tras un *Paro de Emergencia* o alerta crítica.  
* 

## 


  ## **4\. Requerimientos Funcionales y No Funcionales**

  ### **4.1 Requerimientos Funcionales**

* **RF-01 (Estado Inicial Seguro):** Al energizarse, el sistema debe posicionar tanto el servo dispensador como el servo escotilla en estado **cerrado (`0%`)** y encender el LED verde (si hay alimento).  
* **RF-02 (Monitoreo de Nivel):** Leer continuamente el potenciómetro, reflejar el porcentaje en la web y activar advertencia (LED amarillo \+ beeper pasivo) al agotarse la comida.  
* **RF-03 (Dispensación Configurable):** Permitir ajustar desde la web el ángulo del servo dispensador (`50%` por defecto) y ejecutar la dosificación siempre que exista alimento y no haya paros ni fallas activas.  
* **RF-04 (Enclavamiento por Apertura de Escotilla):** Al accionarse el botón `Alternar Escotilla` hacia posición abierta, el sistema debe forzar un **paro general del flujo**, impidiendo cualquier dispensación (física o remota) y notificando a la web hasta que se ejecute `Reiniciar`.  
* **RF-05 (Protocolo de Emergencia por Obstrucción):** Ante `Cabeza Atorada`, abrir a tope la escotilla (`100%`), cerrar totalmente el dispensador (`0%`), activar LED rojo \+ beeper activo y bloquear el sistema hasta recibir `Reiniciar`.  
* **RF-06 (Reinicio Lógico sin Reset de Hardware):** El botón o comando `Reiniciar` debe cerrar ambos actuadores, limpiar banderas de paro/emergencia, emitir confirmación en el beeper pasivo y devolver el sistema a estado operativo sin reiniciar el microcontrolador.  
* **RF-07 (Bitácora Cronológica):** Registrar en la interfaz web todas las acciones, rechazos, paros y alertas críticas con marca de tiempo.

  ### **4.2 Requerimientos No Funcionales**

* **RNF-01 (Prioridad de Seguridad):** La detección de `Cabeza Atorada` y el paro por apertura de escotilla deben prevalecer sobre cualquier orden de dispensación en curso.  
* **RNF-02 (Aislamiento y Conmutación de Potencia):** Los dos servomotores y la alarma crítica deben operar mediante etapas de conmutación discreta (transistores NPN) y fuente dedicada de `5V` para garantizar estabilidad eléctrica.  
* **RNF-03 (Coherencia Visual HMI):** La interfaz web debe mantener correspondencia directa con los estados físicos del prototipo (Verde: operativo, Amarillo: sin comida / paro preventivo, Rojo: emergencia crítica).

## 

## 

| 5\. Casos de Uso Esenciales |  |  |  |
| :---- | :---- | :---- | :---- |
| **ID** | **Caso de Uso** | **Disparador** | **Flujo Principal Resumido** |
| **CU-01** | **Configurar y Dispensar** | Usuario en Web o Botón Dispensar | El usuario ajusta el ángulo (ej. 50%) y pulsa *Dispensar*. Con nivel disponible y sin fallas, el dispensador abre al ángulo indicado, opera la escotilla, emite confirmación y registra en bitácora. |
| **CU-02** | **Intento sin Comida** | Botón Dispensar (Físico/Web) con potenciómetro en 0% | El sistema detecta nivel vacío, impide abrir el dispensador, enciende LED amarillo, emite aviso breve en beeper pasivo y notifica *"Sin comida"* en la web. |
| **CU-03** | **Paro por Escotilla Abierta** | Botón `Alternar Escotilla` (al abrir) | La escotilla se abre, el sistema entra en **paro preventivo**, bloquea dispensaciones, emite aviso leve, notifica *"Paro: Escotilla abierta"* en la web y espera `Reiniciar`. |
| **CU-04** | **Emergencia: Cabeza Atorada** | Botón físico Cabeza Atorada | El sistema aborta operaciones, abre a tope la escotilla, cierra totalmente el dispensador, enciende LED rojo \+ beeper activo y lanza una **Alerta Crítica** en la web. |
| **CU-05** | **Reinicio de Flujo** | Botón Reiniciar  (Físico o Web) | Tras liberar una obstrucción, el usuario pulsa *Reiniciar*. Suena confirmación leve en beeper pasivo, se apaga la alarma crítica, enciende LED verde y se registra el restablecimiento en bitácora. |

## 

## 

## 

## 

## 

## 

## 

## 

## 


  

## **Especificación de Sesión M2M y Protocolo de Comunicación** 

## 

## **Hardware $\leftrightarrow$ Backend $\leftrightarrow$ Web**

## ***Esta sección define los parámetros de enlace físico/lógico, la secuencia de inicialización de sesión, el diccionario exacto de mensajes y el flujo de propagación orientada a eventos entre el microcontrolador Arduino Nano y la aplicación web.***

### **1\. Parámetros de Configuración de Sesión UART**

El enlace Máquina-Máquina (M2M) opera sobre interfaz serial UART-USB bajo los siguientes parámetros fijos:

| Parámetro | Valor Especificado | Justificación Técnica |
| :---- | :---- | :---- |
| **Velocidad (*Baud Rate*)** | 115200 bps | Minimiza la latencia de transmisión de tramas JSON tras interrupciones críticas ($<2ms$ por trama). |
| **Formato de Trama** | 8N1 (8 bits de datos, sin paridad, 1 bit de parada) | Configuración estándar UART para interoperabilidad directa en cualquier sistema operativo o navegador. |
| **Codificación de Caracteres** | UTF-8 / ASCII | Compatibilidad nativa con serialización JSON y comandos de texto plano. |
| **Delimitador de Mensaje** | Salto de línea (\\n / 0x0A) | Permite al receptor segmentar cada mensaje completo de forma asíncrona mediante lectura por línea (*Line-Buffered*). |
| **Control de Flujo** | Ninguno (*None*) | Evita bloqueos por señales RTS/DTR adicionales durante la operación continua. |
| **Tiempo de Espera de Arranque** | 1500 ms – 2000 ms tras apertura | Tiempo requerido por el *bootloader* del Arduino Nano tras el pulso DTR de apertura de puerto antes de aceptar el *handshake*. |

### **1.2 Secuencia de Descubrimiento Automático e Inicio de Sesión (*Handshake*)**

Para garantizar que el backend establezca conexión sin depender de un puerto COM o /dev/ttyUSBx estático, la sesión sigue una secuencia determinista de 4 fases:

1. **Enumeración y Filtrado por Identificador de Hardware (VID/PID):**  
   * El backend consulta los puertos seriales activos del sistema operativo y filtra únicamente los interfaces correspondientes a controladores USB-UART compatibles con Arduino Nano:  
     * **WCH CH340:** VID: 0x1A86  
     * **FTDI FT232R:** VID: 0x0403  
     * **Arduino Oficial:** VID: 0x2341  
     * **Silicon Labs CP210x:** VID: 0x10C4  
2. **Apertura y Estabilización de Enlace:**  
   * Se abre el puerto candidato a 115200 baudios y se aguarda 1800 ms para permitir que el microcontrolador finalice su rutina de arranque (setup()) y posicione ambos actuadores en estado cerrado (0%).  
3. **Intercambio de Verificación (*Handshake*** PING / PONG**):**  
   * El backend transmite la trama de identificación: CMD\_PING\\n.  
   * El microcontrolador responde dentro de una ventana máxima de 500 ms con su firma de dispositivo:  
     * {"evento":"PONG","dispositivo":"SMART\_PET\_FEEDER\_V1"}  
   * Si el puerto no responde o devuelve otra firma, se cierra inmediatamente y se evalúa el siguiente candidato.  
4. **Sincronización de Estado Inicial:**  
   * Confirmado el enlace, el microcontrolador emite una trama ESTADO\_NIVEL con la lectura actual del potenciómetro (A0), el ángulo configurado (50% por defecto) y el estado cerrado de la escotilla para inicializar la interfaz web.

### 

### 

### 

### 

### 

### 

### 

### 

### 

### 

### 

### 

### 

### 

### 

### 

### 

### 

### 

### 

### 

### 

### 

### 

### 

### 

### 

## **Diccionario de Mensajes del Protocolo M2M**

| EVENTOS WEB DE SALIDA |  |  |  |
| :---- | :---- | :---- | :---- |
| **Comando Exacto** | **Parámetros** | **Acción en el Microcontrolador** | **Evento de Respuesta Esperado** |
| CMD\_PING\\n | Ninguno | Verifica identidad y disponibilidad del nodo embebido. | PONG |
| CMD\_DISPENSAR\\n | Ninguno | Evalúa si no hay paro activo y si hay comida (\> 5%). Ejecuta ciclo de dispensación o rechaza. | DISPENSACION\_EXITOSA o SIN\_COMIDA |
| CMD\_ANGULO:\<valor\>\\n | \<valor\>: entero 10 a 100 (%) | Actualiza el porcentaje de apertura del servo dispensador (50 por defecto). | ESTADO\_NIVEL |
| CMD\_ESCOTILLA\\n | Ninguno | Abre la escotilla a tope (100%), cierra dispensador (0%) y activa estado de **Paro de Emergencia**. | PARO\_EMERGENCIA |
| CMD\_REINICIAR\\n | Ninguno | Apaga alarmas/paros, cierra ambos servos (0%), limpia banderas y retorna a flujo normal. | FLUJO\_REINICIADO |

* ***`Cadenas de texto plano terminadas en \n enviadas únicamente ante acciones del usuario en la interfaz web.`***

| EVENTOS WEB DE ENTRADA |  |  |  |
| :---- | :---- | :---- | :---- |
| **Código de evento** | **Disparador en Hardware / Lógica** | **Valor de estado** | **Efecto Obligatorio en la Interfaz Web** |
| ESTADO\_NIVEL | Cambio \$\\ge \\pm 2\\%\$ en potenciómetro (A0) o ajuste de ángulo. | OPERATIVO / SIN\_COMIDA | Actualiza barra/medidor de nivel de comida y ángulo en vivo. |
| DISPENSACION\_EXITOSA | Ciclo completo del servo dispensador tras botón D4 o CMD\_DISPENSAR. | OPERATIVO | Notifica éxito y registra la porción en la bitácora cronológica. |
| SIN\_COMIDA | Nivel cae a \$\\le 5\\%\$ o se intenta dispensar sin reserva. | SIN\_COMIDA | Activa indicador amarillo y registra advertencia en bitácora. |
| PARO\_EMERGENCIA | Apertura de escotilla (D3 / CMD\_ESCOTILLA) o excepción no manejada. | PARO\_EMERGENCIA | Despliega banner de paro crítico, bloquea botón *Dispensar* y registra en bitácora. |
| ALERTA\_CABEZA\_ATORADA | Interrupción externa en D2 (INT0). | CABEZA\_ATORADA | Despliega alerta roja de máxima prioridad (con alarma acústica activa en hardware) y registra en bitácora. |
| FLUJO\_REINICIADO | Botón D5 (PCINT21) o comando CMD\_REINICIAR. | OPERATIVO / SIN\_COMIDA | Limpia banners de bloqueo, rehabilita controles y registra restablecimiento en bitácora. |

### 


* ***Objetos JSON de una sola línea terminados en \\n emitidos de forma autónoma por el hardware.*** 


* ## ***Todos comparten un esquema uniforme:***


  `{`

    `"evento": "<CODIGO_EVENTO>",`

    `"estado": "<ESTADO_GLOBAL>",`

    `"nivel": 75,`

    `"angulo": 50,`

    `"escotilla": false`

  `}`

  ### 

  ### 

### 

### 

### 

### 

### 

### 

### 

### 

### 


  


### 

### **Arquitectura de Interfaz de Eventos hacia el Servidor Web**

El sistema elimina cualquier consulta periódica (*polling*) en todas sus capas, operando mediante propagación reactiva de eventos en tres etapas:

1. **Nivel Hardware (Captura Determinista en ATmega328P):**  
   * Los eventos de seguridad (Cabeza Atorada en D2 y Alternar Escotilla en D3) se capturan mediante **Interrupciones Externas Dedicadas (**INT0 **/** INT1**)**.  
   * Los eventos operativos (Dispensar en D4 y Reiniciar en D5) se capturan mediante **Interrupciones por Cambio de Pin (**PCINT2**)**.  
   * Las rutinas de servicio (ISR) únicamente activan banderas volatile, delegando al bucle principal la ejecución secuencial de actuadores y la serialización de la trama JSON hacia el puerto UART.  
       
2. **Nivel Backend (Escucha Asíncrona Orientada a Eventos):**  
   * El servidor mantiene un *listener* pasivo sobre el flujo de lectura del puerto serial (parser.on('data') en Node.js o hilo bloqueante en readline() en Python). El sistema operativo despierta el proceso únicamente cuando recibe el carácter delimitador \\n.  
   * Cada trama JSON recibida se valida, se persiste con marca de tiempo (*timestamp*) en el almacenamiento de bitácora y se retransmite de inmediato.

3. **Nivel Presentación Web (Empuje en Tiempo Real / *Server Push*):**  
   * El backend empujará cada evento al cliente navegador mediante **WebSockets** (ej. Socket.IO) o **Server-Sent Events (SSE)** bajo el canal evento\_hardware.  
   * En sentido inverso, las acciones del usuario en la interfaz web emiten mensajes por el mismo canal hacia el backend, el cual los traduce directamente a las cadenas CMD\_\* del puerto serial.

   

   

   

   

   

   

   

   

   

   

   

   

   

   

   

   

   

   

   

   

   

   

   

   

   

   

   

   

   

## 

## 

## 

## 

## **Especificación de Implementación en Hardware**

## ***Esta sección documenta la arquitectura física definitiva, la distribución de energía, la asignación de terminales del microcontrolador y las etapas de conmutación discreta del prototipo.***

### 

| Lista de Materiales |  |  |  |
| :---- | :---- | :---- | :---- |
| **Cant.** | **Componente** | **Especificación** | **Rol en el Prototipo** |
| **1** | Microcontrolador | Arduino Nano (ATmega328P) | Procesamiento lógico, lectura ADC, control PWM y comunicación Serial M2M. |
| **1** | Módulo de Alimentación | Fuente para protoboard HW-131 (5 V) | Suministro dedicado de potencia para servomotores y cargas externas. |
| **2** | Servomotores | SG90 / MG90S (5 V) | 1× Servo Dispensador (apertura configurable) y 1× Servo Escotilla (binario). |
| **1** | Potenciómetro | 10 kΩ lineal | Sensor analógico contínuo para simular nível de comida (0% – 100%). |
| **4** | Pulsadores | *Push-buttons* de 4 pines | Entradas digitales: Cabeza Atorada, Alternar Escotilla, Dispensar y Reiniciar. |
| **3** | Diodos LED | 1 Verde, 1 Amarillo, 1 Rojo | Señalización luminosa local por nivel de estado y alerta. |
| **1** | Zumbador Activo | 5 V DC | Alarma sonora continua de emergencia (exclusiva para *Cabeza Atorada*). |
| **1** | Zumbador Pasivo | Piezoeléctrico | Retroalimentación acústica leve (confirmaciones, reinicio y falta de comida). |
| **3** | Transistores NPN | PN2222 | Conmutación de potencia por lado bajo (*Low-Side*): 2× Servos, 1× Beeper activo. |
| **2** | Diodos Rectificadores | 1N4007 | Protección contra picos inductivos (*flyback*) en las etapas de los servomotores. |
| **1** | Capacitor Electrolítico | 100 µF / 50 V | Estabilización y filtrado de picos de arranque en el riel de potencia de \+5 V.  |
| **3** | Resistencias (LEDs) | 220 Ω | Limitación de corriente para los indicadores LED ($\approx 13.6mA$). |
| **2** | Resistencias (Servos) | 330 Ω | Saturación de base de los transistores PN2222 de los servomotores ($\approx 13mA$). |
| **1** | Resistencia (Beeper Act.) | 1 kΩ | Saturación de base del transistor PN2222 del zumbador activo ($\approx 4.3mA$). |
| **1** | Resistencia (Beeper Pas.) | 100 Ω | Limitación de corriente transitoria en la salida PWM del zumbador pasivo. |

### 

### **Arquitectura de Alimentación Eléctrica**

* **Aislamiento de Potencia:** El microcontrolador Arduino Nano se alimenta de forma independiente a 5 V a través de su puerto Mini-USB de datos (4 hilos) conectado a la PC, mientras que los dos servomotores y el zumbador activo reciben energía desde el módulo de alimentación **HW-131** configurado en 5 V.

* **Referencia Común (**GND**):** El riel negativo (GND) del módulo HW-131 se interconecta directamente con un pin GND del Arduino Nano. Los rieles positivos (\+5 V) de ambas fuentes permanecen separados para evitar conflictos de regulación.  
    
* **Desacoplo Capacitivo:** Se instala un capacitor electrolítico de **100 µF / 50 V** entre \+5 V y GND en el riel de potencia para amortiguar caídas de tensión durante la activación de los servomotores.  
    
* **Secuenciación de Carga:** Para mantenerse dentro del límite de corriente del regulador ($\approx 700mA$), el firmware acciona los servomotores de forma secuencial y nunca simultánea.  
    
    
    
  


| Asignación de Pines del Microcontrolador |  |  |  |  |
| :---- | :---- | :---- | :---- | :---- |
| **Pin Arduino** | **Modo** | **Componente Conectado** | **Acondicionamiento** | **Función** |
| **A0** | Entrada Analógica | Potenciómetro (10 kΩ) | Extremos a \+5 V y GND, cursor a A0 | Lectura continua del nivel de comida (0% – 100%). |
| **D2 (INT0)** | INPUT\_PULLUP | Botón Cabeza Atorada | Conectado directamente a GND  | Interrupción prioritaria: dispara rutina crítica \+ alarma sonora. |
| **D3** | INPUT\_PULLUP | Botón Alternar Escotilla | Conectado directamente a GND  | Alterna escotilla; al abrirse dispara PARO\_EMERGENCIA. |
| **D4** | INPUT\_PULLUP | Botón Dispensar | Conectado directamente a GND  | Solicitud manual de dispensado local. |
| **D5** | INPUT\_PULLUP | Botón Reiniciar | Conectado directamente a GND  | Restablece el flujo lógico sin resetear el microcontrolador. |
| **D6** | Salida Digital | LED Verde | Serie con resistencia **220 Ω** a GND | Indica sistema operativo listo. |
| **D7** | Salida Digital | LED Amarillo | Serie con resistencia **220 Ω** a GND | Indica nivel *"Sin comida"* o rechazo por falta de reserva. |
| **D8** | Salida Digital | LED Rojo | Serie con resistencia **220 Ω** a GND | Parpadea ante cualquier estado de *Paro de Emergencia*. |
| **D9 (PWM)** | Salida PWM | Servo Dispensador (Señal) | Conexión directa a línea de control | Posiciona apertura (0% inicial, 50% por defecto al dispensar). |
| **D10 (PWM)** | Salida PWM | Servo Escotilla (Señal) | Conexión directa a línea de control | Control binario de escotilla (0% cerrado, 100% abierto). |
| **D11 (PWM)** | Salida PWM | Beeper Pasivo | Serie con resistencia **100 Ω** a GND | Genera tonos breves de retroalimentación leve. |
| **D12** | Salida Digital | Transistor Beeper Activo | Serie con resistencia **1 kΩ** a Base | Habilita el tono continuo crítico en *Cabeza Atorada*. |
| **A1** | Salida Digital | Transistor Servo Disp. | Serie con resistencia **330 Ω** a Base | Habilita/corta energía del Servo Dispensador. |
| **A2** | Salida Digital | Transistor Servo Escotilla | Serie con resistencia **330 Ω** a Base | Habilita/corta energía del Servo Escotilla. |
| **USB (TX/RX)** | UART Serial | PC (Servidor Web) | Cable Mini-USB de datos (4 hilos)  | Enlace bidireccional M2M orientado a eventos.  |

### 


  


  


  


  


  


  


### **Etapas de Conmutación Discreta**

Todas las etapas de potencia emplean transistores bipolares NPN **PN2222** en configuración de interruptor de lado bajo (*Low-Side Switch*), con distribución de terminales.

1. **Etapas de Control de Servomotores:**  
     
   * **Alimentación:** El terminal positivo (\+5 V) de cada servo se conecta directo al riel de potencia de \+5 V; su terminal negativo (GND) se conecta al **Colector (Pin 3\)** del PN2222.  
       
   * **Disparo:** El **Emisor** va a GND común y la **Base** recibe la señal del Arduino a través de una resistencia de **330 Ω**.  
       
   * **Protección Inductiva:** Se coloca un diodo **1N4007** en antiparalelo entre el Colector y el riel de \+5 V (cátodo) para suprimir transitorios de voltaje al desenergizar el motor.  
       
   * **Secuencia Segura en Firmware:** Antes de desactivar el transistor de un servomotor, el controlador libera la señal PWM ( detach() y nivel bajo ) para evitar corrientes parásitas a través del pin de datos.  
       
2. **Etapa de Alarma Sonora Crítica:**  
   * **Alimentación:** El terminal positivo (\+) del zumbador activo se conecta al riel de \+5 V y su terminal negativo (\-) al **Colector (Pin 3\)** del PN2222.  
   * **Disparo:** El **Emisor (Pin 1\)** va a GND común y la **Base (Pin 2\)** se excita desde el pin **D12** mediante una resistencia de **1 kΩ**.  
       
3. **Acondicionamiento de Entradas Digitales (Pulsadores):**  
   * Los cuatro pulsadores se conectan en diagonal entre su pin digital asignado (D2–D5) y GND, habilitando las resistencias internas *pull-up* del microcontrolador (INPUT\_PULLUP) con lógica activa en nivel bajo (LOW).

### **Memoria de Cálculo y Justificación Eléctrica de Componentes**

#### **A. Parámetros Base de Diseño**

* **Tensión lógica de control (${V}_{OH}$):** $5.0V$ (pines digitales del Arduino Nano).  
* **Tensión de potencia (${V}_{CC}$):** $5.0V$ regulados (módulo HW-131).  
* **Transistor de conmutación:** BJT NPN **PN2222** (${I}_{C(máx)}=600mA$, ${V}_{BE(sat)}\approx 0.7V$, ${V}_{CE(sat)}\approx 0.2V$).  
* **Ganancia de corriente ($\beta$):** Aunque la ganancia lineal mínima del PN2222 es ${\beta }_{mín}\approx 75–100$ (y en diseños conservadores se toma $\beta =50$), para conmutación en **saturación profunda** se aplica un **factor de sobreexcitación ($k$)** de $3$ a $4$ (equivalente a trabajar con una ${\beta }_{forzada}\approx 15–25$) para garantizar mínimo calentamiento y caída de tensión mínima en la carga.


| Tabla de Justificación Eléctrica |  |  |  |  |
| :---- | :---- | :---- | :---- | :---- |
| **Componente** | **Tensión de Operación** | **Corriente de Trabajo** | **Factor β** | **Cálculo y Justificación del Valor Comercial** |
| **Transistor PN2222 (Servomotor Dispensador y Escotilla)** *(×2 etapas)* | ${V}_{in}=5.0V$  ${V}_{BE}=0.7V$  ${V}_{CE(sat)}\approx 0.2V$ | Pico de arranque/giro:  ${I}_{C}\approx 200mA-250mA$  ${I}_{B(mín)}=\frac{0.2A}{50}=4mA$ | ${\beta }_{conserv.}=50$ Factor sobreexcitación:  $k\approx 3.25$ (${\beta }_{forzada}\approx 15.4$) | ${I}_{B}=3.25\times 4mA=13mA$  ${R}_{B}=\frac{5.0V-0.7V}{0.013A}=330.7\Omega {\ }$ **Valor usado:** **$330\Omega {\ }$** (protege el pin del MCU $<20mA$ y asegura saturación dura). |
| **Transistor PN2222 (Beeper Activo)** *(×1 etapa)* | ${V}_{in}=5.0V$  ${V}_{BE}=0.7V$  ${V}_{CE(sat)}\approx 0.15V$ | Consumo continuo:  ${I}_{C}\approx 30mA$  ${I}_{B(mín)}=\frac{0.03A}{50}=0.6mA$ | ${\beta }_{conserv.}=50$ Factor sobreexcitación:  $k\approx 7.1$ (${\beta }_{forzada}\approx 7$) | ${I}_{B}=\frac{5.0V-0.7V}{1000\Omega \ }=4.3mA$  ${R}_{B}=\frac{4.3V}{0.0043A}=1000\Omega {\ }$ **Valor usado:** **$1k\Omega$** (sobrado para saturar $30mA$ con mínimo consumo en pin D12). |
| **LEDs Indicadores (Verde, Amarillo, Rojo)** *(×3 circuitos)* | ${V}_{OH}=5.0V$  ${V}_{F}\approx 2.0V$ (Rojo/Amarillo)  ${V}_{F}\approx 2.2V$ (Verde) | Corriente segura de brillo óptimo:  ${I}_{LED}\approx 12.7mA-13.6mA$ | N/A (Carga directa en pin digital) |  ${R}_{LED}=\frac{5.0V-2.0V}{0.0136A}=220.5\Omega {\ }$ **Valor usado:** **$220\Omega {\ }$** (limita corriente por debajo de los $20mA$ máximos por pin). |
| **Beeper Pasivo (Piezoeléctrico PWM)** | ${V}_{PWM}=5.0{V}_{pp}$ | Corriente media $\approx 15mA$ (picos capacitivos en flancos) | N/A (Carga capacitiva directa) |  ${R}_{prot}=\frac{5.0V}{0.050{A}_{pico}}=100\Omega {\ }$ **Valor usado:** **$100\Omega {\ }$** (amortigua picos transitorios en pin D11 sin atenuar volumen). |
| **Diodos 1N4007 (*Flyback*)** *(×2 en servos)* | ${V}_{inv(máx)}=1000V$  ${V}_{F}\approx 0.7V$ | Soporta picos transitorios de hasta $1A$ continuo ($30A$ pico) | N/A (Protección inductiva) | **Justificación:** Absorbe la fuerza contraelectromotriz ($L\frac{di}{dt}$) de las bobinas internas al cortar el transistor PN2222. |
| **Capacitor Electrolítico de Desacoplo** | Tensión nominal: **$50V$** (operando a $5.0V$, margen $10\times$) | Entrega picos instantáneos de corriente ($\Delta I\approx 400mA$) durante $\Delta t\approx 1ms$ | N/A (Reserva capacitiva) |  $\Delta V=\frac{I\cdot \Delta t}{C}=\frac{0.4A\cdot 0.001s}{100\times 1{0}^{-6}F}=4.0{V}_{máx}$ **Valor usado:** **\$100\\ \\mu\\text{F} / 50\\text{ V}\$** en paralelo entre \+5 V y GND para estabilizar el riel de potencia. |
| **Potenciómetro (Sensor de Nivel)** | ${V}_{CC}=5.0V$ (alimentado desde pin 5V del MCU) | Corriente constante:  $I=\frac{5.0V}{10k\Omega }=0.5mA$ | Resolución ADC 10 bits:  $\frac{5.0V}{1024}\approx 4.88mV/paso$ | **Valor usado:** **$10k\Omega$ lineal** (consumo despreciable de $0.5mA$ y lectura ratiométrica libre de ruido de motores). |
| **Pulsadores (*Push-buttons*)** *(×4 entradas)* | ${V}_{reposo}=5.0V$ (HIGH)  ${V}_{activo}=0.0V$ (LOW) | Corriente de cierre:  $I=\frac{5.0V}{35k\Omega }\approx 0.14mA$ | Resistencia *pull-up* interna ATmega328P:  ${R}_{PU}\approx 20k\Omega -50k\Omega$ | **Justificación:** Uso de INPUT\_PULLUP interno evita resistencias externas y garantiza inmunidad ante estados flotantes. |

### **Notas Clave de Integridad Eléctrica**

* **Separación de retornos (GND):** Los retornos de señal limpia (LEDs, potenciómetro, 4 pulsadores y beeper pasivo) se conectan directamente al GND del Arduino Nano, mientras que los retornos de potencia (emisores de los 3 transistores PN2222) se conectan al GND del módulo HW-131, uniéndose ambos puntos con un único puente para evitar rebote de tierra sobre los indicadores luminosos.

