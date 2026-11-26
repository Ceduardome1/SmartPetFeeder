# Dispensador inteligente de alimento: app web

Interfaz web (HMI remota y bitácora) del proyecto final de Sistemas Programables. Se conecta por USB al Arduino Nano, muestra el estado en tiempo real y permite mandar los comandos manuales del documento de especificación.

```
Arduino Nano ──USB (UART, JSON)──▶ servidor Node.js ──SSE──▶ navegador
Arduino Nano ◀──CMD_*─────────────  servidor Node.js ◀──POST── navegador
```

## Qué necesitas

- Node.js 18 o más nuevo (https://nodejs.org, versión LTS).
- El Arduino Nano con el firmware cargado, conectado por USB a la laptop.
- Internet solo para el `npm install` inicial. Después todo funciona sin internet.

## Cómo usarlo

```bash
npm install        # una sola vez
npm start          # arranca el servidor
```

Abre http://localhost:3000 en el navegador. El servidor busca solo el puerto del Arduino (no hay que saber si es COM3 o COM5) y la esquina superior derecha muestra el estado de la conexión.

Antes de arrancar, cierra el Monitor Serie del IDE de Arduino: si está abierto, el puerto queda ocupado y la app no puede conectarse.

### Probar sin Arduino

```bash
npm run demo
```

Arranca un firmware virtual que habla el mismo protocolo. En la pantalla aparece un panel "Simulador de hardware" con el potenciómetro y los pulsadores del prototipo (cabeza atorada, escotilla, etc.). Sirve para ensayar la exposición o desarrollar la interfaz mientras el hardware no está disponible.

### Otras opciones

| Comando | Para qué sirve |
|---|---|
| `npm run puertos` | Lista los puertos serie y marca cuáles son compatibles |
| `npm start -- --puerto=COM5` | Fuerza un puerto si el autodescubrimiento no lo encuentra |
| `npm start -- --lan` | Deja abrir el panel desde otros dispositivos de la misma red (por ejemplo, el celular) |
| `npm start -- --http=3001` | Cambia el puerto web (por defecto 3000) |
| `CMD_PARO=CMD_PARO_EMERGENCIA npm start` | Cambia el nombre del comando de paro (ver notas) |

En Windows (cmd), la variable se define antes: `set CMD_PARO=CMD_PARO_EMERGENCIA` y luego `npm start`.

## Qué hace la interfaz

- **Estado en vivo:** semáforo (Normal, Sin comida, Crítico) que replica los LEDs del prototipo, nivel de comida, apertura configurada del dispensador y posición de la escotilla.
- **Banner de alerta:** aparece en cabeza atorada, paro de emergencia y sin comida. En paro, el botón Dispensar queda bloqueado.
- **Controles manuales:** apertura del dispensador (10 a 100 %), dispensar, paro de emergencia (abre la escotilla) y reiniciar flujo.
- **Bitácora:** fecha, hora, origen y descripción de cada dispensación, cambio de nivel, rechazo y alerta. Se guarda en `data/bitacora.jsonl` (sobrevive a reinicios) y se puede descargar en CSV.

Los cambios de nivel del potenciómetro se anotan en la bitácora cuando cambian al menos 10 % (se puede ajustar en `src/config.js`); el panel en vivo se actualiza con todos.

## Cómo está organizado

```
server.js            Servidor HTTP, canal SSE y API
src/config.js        Parámetros (baudios, VID de los chips USB, umbrales)
src/serial.js        Autodescubrimiento y enlace con el Arduino (PING/PONG)
src/simulador.js     Firmware virtual para el modo demo
src/protocolo.js     Contrato M2M: interpretar tramas y construir comandos
src/bitacora.js      Bitácora persistente y exportación a CSV
public/              Interfaz (HTML, CSS y JS, sin librerías externas)
```

El servidor no consulta al hardware cada cierto tiempo: solo reacciona cuando llega una línea completa (`\n`) por el puerto serial y la empuja al navegador por Server-Sent Events, en el canal `evento_hardware`. Los comandos del usuario salen por `POST /api/comando` y el servidor los traduce a las cadenas `CMD_*`.

## Si algo no conecta

- **"Buscando el Arduino Nano…" y no avanza:** revisa que el cable USB sea de datos (no solo de carga) y que Windows muestre el puerto en el Administrador de dispositivos. Las placas con chip CH340 necesitan su driver.
- **"No se pudo abrir COM…":** otro programa tiene el puerto (Monitor Serie del IDE, otra ventana del servidor). Ciérralo.
- **"Ningún puerto respondió como SMART_PET_FEEDER_V1":** el firmware no está cargado o no responde `CMD_PING` con `{"evento":"PONG","dispositivo":"SMART_PET_FEEDER_V1"}`.
- **La placa no aparece como compatible en `npm run puertos`:** usa `npm start -- --puerto=COM5` con el puerto que veas.
- **Linux:** el usuario debe estar en el grupo `dialout` (`sudo usermod -aG dialout $USER` y volver a iniciar sesión).

## Notas sobre el documento de especificación

El documento tiene dos inconsistencias que conviene acordar con quien hace el firmware:

1. **Comando de paro:** la sección 3.2 lo llama `CMD_PARO_EMERGENCIA` y el diccionario de mensajes lo llama `CMD_ESCOTILLA`. La app usa `CMD_ESCOTILLA` (el diccionario es el contrato exacto). Si el firmware usa el otro nombre, se cambia con la variable `CMD_PARO` o en `src/config.js`.
2. **Rango del ángulo:** la matriz de entradas habla de 0 a 100 %, pero el diccionario de `CMD_ANGULO` acepta de 10 a 100. La app usa 10 a 100.
