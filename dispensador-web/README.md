# Dispensador inteligente de alimento: app web

Interfaz web (HMI remota y bitácora) del proyecto final de Sistemas Programables. Se conecta por USB al Arduino Nano, muestra el estado en tiempo real y permite mandar los comandos manuales del documento de especificación.

```text
Arduino Nano ──USB (UART, JSON)──▶ servidor Node.js (MVC) ──SSE──▶ navegador
Arduino Nano ◀──CMD_*─────────────  servidor Node.js (MVC) ◀──POST── navegador
```

## Qué necesitas

- Node.js 18 o más nuevo (https://nodejs.org, versión LTS).
- El Arduino Nano con el firmware cargado (`mcu/SmartPetFeeder.ino`), conectado con **cable Mini-USB de datos (4 hilos)** a la computadora.
- Internet solo para el `npm install` inicial. Después todo funciona sin internet.

## Cómo usarlo

```bash
npm install        # una sola vez
npm start          # arranca el servidor
```

Abre http://localhost:3000 en el navegador. El servidor busca automáticamente el puerto del Arduino (sin depender de `COMx` o `/dev/ttyUSBx`), valida el handshake `CMD_PING`/`PONG` y reconecta automáticamente si el cable USB se desconecta.

Antes de arrancar, cierra el **Monitor Serie** del IDE de Arduino: si está abierto, el puerto queda ocupado (`Device or resource busy`) y la app no puede abrirlo.

### Probar sin Arduino

```bash
npm run demo
```

Arranca un firmware virtual (`SimuladorService`) que replica el mismo protocolo y máquina de estados de `mcu/StateMachine.cpp`. En la pantalla aparece un panel "Simulador de hardware" con el potenciómetro y los pulsadores del prototipo.

### Otras opciones

| Comando | Para qué sirve |
|---|---|
| `npm run puertos` | Lista los puertos USB-UART detectados y marca los compatibles |
| `npm start -- --puerto=/dev/ttyUSB0` | Fuerza un puerto específico (en Windows: `--puerto=COM5`) |
| `npm start -- --lan` | Permite abrir el panel desde otros dispositivos en la misma red local |
| `npm start -- --http=3001` | Cambia el puerto HTTP (por defecto 3000) |
| `CMD_PARO=CMD_PARO_EMERGENCIA npm start` | Cambia el comando enviado para paro de emergencia |

## Arquitectura modular (MVC)

```text
server.js                              Punto de entrada ligero y cierre limpio (SIGINT/SIGTERM)
src/
├── config/
│   └── config.js                      Parámetros CLI, variables de entorno, UART y bitácora
├── models/                            Capa Modelo (dominio, estado y persistencia)
│   ├── protocolo.js                   Contrato M2M puro (tramas JSON y comandos CMD_*)
│   ├── dispensadorModel.js            Estado reactivo sincronizado con la FSM del MCU
│   └── bitacoraModel.js               Persistencia JSONL en data/bitacora.jsonl y exportación CSV
├── services/                          Capa Servicios (transporte e infraestructura)
│   ├── serialService.js               Autodescubrimiento USB-UART, PING/PONG y autoreconexión
│   ├── simuladorService.js            Firmware virtual fiel a mcu/StateMachine.cpp
│   └── sseService.js                  Empuje en tiempo real (Server-Sent Events, canal evento_hardware)
├── controllers/                       Capa Controlador (orquestación HTTP y hardware)
│   ├── hardwareController.js          Enlaza Serial/Simulador ↔ Modelos ↔ SSE
│   ├── apiController.js               Controladores REST/SSE (/api/*)
│   └── staticController.js            Servido seguro de la Vista (public/)
└── routes/
    └── router.js                      Enrutador HTTP declarativo
public/                                Capa Vista (HMI Web, sin librerías externas)
├── index.html                         Vista HTML semántica
├── styles.css                         Estilos
└── js/                                Cliente modular (ES Modules nativos)
    ├── state.js                       Estado cliente
    ├── api.js                         Cliente SSE y peticiones POST
    ├── view.js                        Renderizado DOM
    └── main.js                        Bootstrap y eventos de usuario
```

## Si algo no conecta

- **No aparece ningún puerto en `npm run puertos`:** asegúrate de usar un **cable Mini-USB de datos (4 hilos)** y no uno de solo carga.
- **`Device or resource busy` / `Access denied`:** cierra el Monitor Serie del IDE de Arduino u otra instancia del servidor.
- **"Ningún puerto respondió como SMART_PET_FEEDER_V1":** confirma que el firmware de `mcu/` esté cargado en el Arduino Nano a `115200` baudios.
- **Linux (permisos y conflictos):** tu usuario debe estar en `dialout` (`sudo usermod -aG dialout $USER`). En distribuciones con `brltty` instalado, si un CH340 se desconecta inmediatamente al enchufarlo, deshabilita las reglas udev de `brltty`.
