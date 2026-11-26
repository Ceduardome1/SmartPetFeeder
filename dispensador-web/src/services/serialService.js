'use strict';

const { EventEmitter } = require('events');
const { FIRMA_DISPOSITIVO, esTramaValida } = require('../models/protocolo');

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const REGEX_PUERTO_INTERNO_LINUX = /^\/dev\/ttyS\d+$/;
const REGEX_PUERTO_USB_FALLBACK = /^\/dev\/(ttyUSB\d+|ttyACM\d+|cu\.usb.+)$/;

function normalizarVid(vid) {
  if (!vid) return null;
  return String(vid).trim().toLowerCase().replace(/^0x/, '').padStart(4, '0');
}

function esPuertoCompatible(puerto, vendorIds) {
  const vid = normalizarVid(puerto.vendorId);
  return Boolean(vid && vendorIds.includes(vid));
}

function esPuertoUsbSinVid(puerto) {
  return !puerto.vendorId && REGEX_PUERTO_USB_FALLBACK.test(String(puerto.path || ''));
}

/**
 * Servicio de enlace UART con el Arduino Nano.
 *
 * Secuencia de descubrimiento (README sección 1.2):
 *   1. Enumerar puertos y filtrar por VID USB-UART compatibles (CH340, FTDI, Arduino, CP210x),
 *      con fallback para puertos /dev/ttyUSB* o /dev/ttyACM* si el SO no expone VID.
 *   2. Abrir a 115200 8N1 (sin control de flujo) y aguardar estabilización del bootloader (~2000 ms),
 *      capturando cualquier trama inicial emitida durante setup().
 *   3. Enviar CMD_PING\n y verificar respuesta PONG con firma SMART_PET_FEEDER_V1 (máx. 500 ms).
 *   4. Adoptar enlace, retransmitir trama inicial si existió y mantener escucha asíncrona por '\n'.
 *
 * Si el cable se desconecta o falla una escritura, el servicio limpia el puerto y reconecta automáticamente.
 *
 * Eventos: 'info' (texto), 'conectado' ({path, firma}), 'desconectado' (motivo),
 *          'trama' (objeto JSON), 'trama-invalida' (texto).
 */
class SerialService extends EventEmitter {
  constructor(config) {
    super();
    this.cfg = config;
    this.simulador = false;
    this.conectado = false;
    this.puerto = null;
    this._port = null;
    this._parser = null;
    this._buscando = false;
    this._detenido = false;
    this._timerReintento = null;
    this._ultimoMensaje = '';

    // Carga perezosa: así "npm run demo" funciona aunque no se haya instalado serialport.
    const sp = require('serialport');
    this.SerialPort = sp.SerialPort;
    this.ReadlineParser = sp.ReadlineParser;
  }

  static async listarPuertos(config) {
    const { SerialPort } = require('serialport');
    const todos = await SerialPort.list();
    return todos.map((p) => {
      const vid = normalizarVid(p.vendorId);
      const compatible = esPuertoCompatible(p, config.serial.vendorIds);
      const usbFallback = !compatible && esPuertoUsbSinVid(p);
      const internoLinux = REGEX_PUERTO_INTERNO_LINUX.test(String(p.path || ''));
      return {
        path: p.path,
        vendorId: vid,
        productId: p.productId ? normalizarVid(p.productId) : null,
        manufacturer: p.manufacturer || '',
        compatible,
        usbFallback,
        internoLinux,
      };
    });
  }

  _info(mensaje) {
    if (mensaje === this._ultimoMensaje) return;
    this._ultimoMensaje = mensaje;
    this.emit('info', mensaje);
  }

  _cancelarReintento() {
    if (this._timerReintento) {
      clearTimeout(this._timerReintento);
      this._timerReintento = null;
    }
  }

  _programarReintento() {
    if (this._detenido || this.conectado || this._buscando || this._timerReintento) return;
    this._timerReintento = setTimeout(() => {
      this._timerReintento = null;
      this.iniciar();
    }, this.cfg.serial.reintentoBusquedaMs);
  }

  async iniciar() {
    if (this._detenido || this._buscando || this.conectado) return;
    this._cancelarReintento();
    this._buscando = true;
    try {
      this._info('Buscando el Arduino Nano por USB…');
      while (!this._detenido && !this.conectado) {
        const encontrado = await this._descubrir();
        if (encontrado || this._detenido || this.conectado) break;
        await esperar(this.cfg.serial.reintentoBusquedaMs);
      }
    } finally {
      this._buscando = false;
    }
  }

  async detener() {
    this._detenido = true;
    this._cancelarReintento();
    const port = this._port;
    this._port = null;
    this._parser = null;
    this.conectado = false;
    this.puerto = null;
    await this._cerrar(port);
  }

  async _descubrir() {
    let candidatos = [];
    try {
      const todos = await this.SerialPort.list();
      if (this.cfg.puertoForzado) {
        candidatos = [{ path: this.cfg.puertoForzado }];
      } else {
        const porVid = todos.filter((p) => esPuertoCompatible(p, this.cfg.serial.vendorIds));
        const usbSinVid = todos.filter((p) => !esPuertoCompatible(p, this.cfg.serial.vendorIds) && esPuertoUsbSinVid(p));
        candidatos = [...porVid, ...usbSinVid];

        if (candidatos.length === 0) {
          const visibles = todos
            .filter((p) => !REGEX_PUERTO_INTERNO_LINUX.test(String(p.path || '')))
            .map((p) => p.path);
          const detalle = visibles.length > 0 ? `puertos vistos: ${visibles.join(', ')}` : 'ningún dispositivo USB-UART detectado';
          this._info(`Sin Arduino Nano detectado (${detalle}). Verifica el cable USB de datos.`);
          return false;
        }
      }
    } catch (err) {
      this._info(`No se pudieron listar los puertos serie: ${err.message}`);
      return false;
    }

    let ultimoErrorApertura = null;
    for (const candidato of candidatos) {
      if (this._detenido) return false;
      const resultado = await this._sondear(candidato.path);
      if (resultado.sesion) {
        if (this._adoptar(candidato.path, resultado.sesion)) return true;
      } else if (resultado.errorApertura) {
        ultimoErrorApertura = resultado.errorApertura;
      }
    }

    if (ultimoErrorApertura) {
      this._info(ultimoErrorApertura);
    } else {
      this._info(
        `Ningún puerto respondió como ${FIRMA_DISPOSITIVO}. Cierra el Monitor Serie del IDE de Arduino y revisa el firmware.`
      );
    }
    return false;
  }

  /** Abre el puerto y ejecuta el handshake PING/PONG capturando tramas iniciales. */
  async _sondear(portPath) {
    const {
      baudRate,
      esperaArranqueMs,
      pingTimeoutMs,
      pingIntentos,
      pingPausaEntreIntentosMs = 250,
    } = this.cfg.serial;

    const port = new this.SerialPort({
      path: portPath,
      baudRate,
      dataBits: 8,
      parity: 'none',
      stopBits: 1,
      rtscts: false,
      xon: false,
      xoff: false,
      autoOpen: false,
    });

    let cerradoEnSondeo = false;
    const onErrorSondeo = () => {
      cerradoEnSondeo = true;
    };
    const onCloseSondeo = () => {
      cerradoEnSondeo = true;
    };
    port.on('error', onErrorSondeo);
    port.on('close', onCloseSondeo);

    try {
      await new Promise((resolve, reject) => port.open((err) => (err ? reject(err) : resolve())));
    } catch (err) {
      const ocupado = /busy|access denied|in use|locked/i.test(err.message);
      const sugerencia = ocupado
        ? 'Otro programa tiene el puerto abierto (cierra el Monitor Serie del IDE de Arduino).'
        : 'Verifica permisos del puerto serial.';
      return {
        sesion: null,
        errorApertura: `No se pudo abrir ${portPath}: ${err.message}. ${sugerencia}`,
      };
    }

    const parser = port.pipe(new this.ReadlineParser({ delimiter: '\n' }));

    // Capturamos cualquier trama válida recibida durante arranque/handshake (ej. ESTADO_NIVEL inicial)
    const tramasCapturadas = [];
    const capturarDuranteSondeo = (linea) => {
      const texto = String(linea).trim();
      if (!texto) return;
      try {
        const obj = JSON.parse(texto);
        if (esTramaValida(obj) && obj.evento !== 'PONG') {
          tramasCapturadas.push(obj);
        }
      } catch {
        // Ignorar ruido de bootloader durante el arranque
      }
    };
    parser.on('data', capturarDuranteSondeo);

    await this._esperarConCorte(esperaArranqueMs, () => this._detenido || cerradoEnSondeo || !port.isOpen);

    if (this._detenido || cerradoEnSondeo || !port.isOpen) {
      parser.off('data', capturarDuranteSondeo);
      await this._cerrar(port);
      return { sesion: null, errorApertura: null };
    }

    // Descarta bytes pendientes de arranque antes de enviar CMD_PING
    await new Promise((resolve) => port.flush(() => resolve()));

    for (let intento = 0; intento < pingIntentos; intento++) {
      if (this._detenido || cerradoEnSondeo || !port.isOpen) break;
      const payload = intento === 0 ? '\nCMD_PING\n' : 'CMD_PING\n';
      const ok = await this._ping(port, parser, pingTimeoutMs, payload);
      if (ok) {
        parser.off('data', capturarDuranteSondeo);
        port.off('error', onErrorSondeo);
        port.off('close', onCloseSondeo);
        // Breve margen para recibir ESTADO_NIVEL que el MCU emite justo tras PONG (Fase 4)
        return {
          sesion: { port, parser, tramasCapturadas },
          errorApertura: null,
        };
      }
      if (intento < pingIntentos - 1) {
        await this._esperarConCorte(pingPausaEntreIntentosMs, () => this._detenido || cerradoEnSondeo || !port.isOpen);
      }
    }

    parser.off('data', capturarDuranteSondeo);
    await this._cerrar(port);
    return { sesion: null, errorApertura: null };
  }

  async _esperarConCorte(ms, debeCortar) {
    const fin = Date.now() + ms;
    while (Date.now() < fin) {
      if (debeCortar()) return;
      await esperar(Math.min(100, fin - Date.now()));
    }
  }

  _ping(port, parser, timeoutMs, payload) {
    return new Promise((resolve) => {
      let finalizado = false;
      let temporizador = null;

      const terminar = (ok) => {
        if (finalizado) return;
        finalizado = true;
        clearTimeout(temporizador);
        parser.off('data', alRecibir);
        port.off('close', alCerrar);
        resolve(ok);
      };

      const alCerrar = () => terminar(false);

      const alRecibir = (linea) => {
        try {
          const t = JSON.parse(String(linea).trim());
          if (t.evento === 'PONG' && t.dispositivo === FIRMA_DISPOSITIVO) {
            terminar(true);
          }
        } catch {
          // Otra línea no-JSON durante el sondeo: se ignora
        }
      };

      temporizador = setTimeout(() => terminar(false), timeoutMs);
      parser.on('data', alRecibir);
      port.once('close', alCerrar);
      port.write(payload, (err) => {
        if (err) terminar(false);
      });
    });
  }

  _adoptar(portPath, { port, parser, tramasCapturadas }) {
    if (this._detenido || !port.isOpen) {
      this._cerrar(port);
      return false;
    }

    this._port = port;
    this._parser = parser;
    this.puerto = portPath;
    this.conectado = true;
    this._ultimoMensaje = '';

    parser.removeAllListeners('data');
    port.removeAllListeners('error');
    port.removeAllListeners('close');

    parser.on('data', (linea) => this._alRecibir(linea));
    parser.on('error', (err) => this._perder(port, err.message));
    port.on('error', (err) => this._perder(port, err.message));
    port.on('close', () => this._perder(port, 'el puerto se cerró; ¿se desconectó el cable USB?'));

    this.emit('conectado', { path: portPath, firma: FIRMA_DISPOSITIVO });

    // Reproducimos la última trama de estado capturada durante el arranque/sondeo si existió
    if (tramasCapturadas.length > 0) {
      const ultima = tramasCapturadas[tramasCapturadas.length - 1];
      setImmediate(() => {
        if (this.conectado && this._port === port) {
          this.emit('trama', ultima);
        }
      });
    }

    return true;
  }

  _alRecibir(linea) {
    const texto = String(linea).trim();
    if (!texto) return;
    try {
      this.emit('trama', JSON.parse(texto));
    } catch {
      this.emit('trama-invalida', texto);
    }
  }

  _perder(port, motivo) {
    if (this._port !== port) return; // aviso obsoleto de un puerto anterior
    this._port = null;
    this._parser = null;
    this.conectado = false;
    this.puerto = null;

    port.removeAllListeners('error');
    port.removeAllListeners('close');
    port.on('error', () => {});

    this.emit('desconectado', motivo);
    this._cerrar(port);

    if (!this._detenido) {
      this._programarReintento();
    }
  }

  _cerrar(port) {
    return new Promise((resolve) => {
      if (!port) return resolve();
      port.removeAllListeners('close');
      port.removeAllListeners('error');
      port.on('error', () => {});
      if (port.isOpen) {
        port.close(() => resolve());
      } else {
        resolve();
      }
    });
  }

  enviar(linea) {
    return new Promise((resolve, reject) => {
      const port = this._port;
      if (!this.conectado || !port || !port.isOpen) {
        if (port) this._perder(port, 'el puerto serial dejó de estar disponible');
        return reject(new Error('El hardware no está conectado.'));
      }
      port.write(linea, (err) => {
        if (err) {
          this._perder(port, `error de escritura serial (${err.message})`);
          return reject(err);
        }
        resolve();
      });
    });
  }
}

module.exports = { SerialService, normalizarVid };
