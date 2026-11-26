'use strict';

const { EventEmitter } = require('events');
const { FIRMA_DISPOSITIVO } = require('./protocolo');

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Enlace UART con el Arduino Nano.
 *
 * Secuencia (documento, sección 1.2):
 *   1. Enumerar puertos y filtrar por VID de USB-UART compatibles.
 *   2. Abrir a 115200 8N1 y esperar ~1.8 s a que el bootloader termine.
 *   3. Enviar CMD_PING y esperar el PONG con la firma SMART_PET_FEEDER_V1 (máx. 500 ms).
 *   4. Si responde, el puerto queda enlazado; si no, se cierra y se prueba el siguiente.
 *
 * Si el cable se desconecta, el enlace se recupera solo.
 *
 * Eventos: 'info' (texto), 'conectado' ({path, firma}), 'desconectado' (motivo),
 *          'trama' (objeto JSON del hardware), 'trama-invalida' (texto).
 */
class EnlaceSerial extends EventEmitter {
  constructor(config) {
    super();
    this.cfg = config; // { serial, puertoForzado }
    this.simulador = false;
    this.conectado = false;
    this.puerto = null;
    this._port = null;
    this._buscando = false;
    this._ultimoMensaje = '';
    // Carga perezosa: así "npm run demo" funciona aunque no se haya instalado serialport.
    const sp = require('serialport');
    this.SerialPort = sp.SerialPort;
    this.ReadlineParser = sp.ReadlineParser;
  }

  _info(mensaje) {
    if (mensaje === this._ultimoMensaje) return;
    this._ultimoMensaje = mensaje;
    this.emit('info', mensaje);
  }

  async iniciar() {
    if (this._buscando || this.conectado) return;
    this._buscando = true;
    try {
      this._info('Buscando el Arduino Nano por USB…');
      while (!this.conectado) {
        if (await this._descubrir()) break;
        await esperar(this.cfg.serial.reintentoBusquedaMs);
      }
    } finally {
      this._buscando = false;
    }
  }

  async _descubrir() {
    let candidatos;
    try {
      const todos = await this.SerialPort.list();
      if (this.cfg.puertoForzado) {
        candidatos = [{ path: this.cfg.puertoForzado }];
      } else {
        candidatos = todos.filter(
          (p) => p.vendorId && this.cfg.serial.vendorIds.includes(String(p.vendorId).toLowerCase())
        );
        if (candidatos.length === 0) {
          const vistos = todos.map((p) => p.path).join(', ') || 'ninguno';
          this._info(`No hay ningún USB-UART compatible conectado (puertos vistos: ${vistos}). Conecta el cable USB del Arduino.`);
          return false;
        }
      }
    } catch (err) {
      this._info(`No se pudieron listar los puertos serie: ${err.message}`);
      return false;
    }

    for (const candidato of candidatos) {
      const sesion = await this._sondear(candidato.path);
      if (sesion) {
        this._adoptar(candidato.path, sesion);
        return true;
      }
    }
    this._info(
      `Ningún puerto respondió como ${FIRMA_DISPOSITIVO}. Cierra el Monitor Serie del IDE de Arduino y revisa que el firmware esté cargado.`
    );
    return false;
  }

  /** Abre el puerto y hace el handshake PING/PONG. Devuelve {port, parser} o null. */
  async _sondear(path) {
    const { baudRate, esperaArranqueMs, pingTimeoutMs, pingIntentos } = this.cfg.serial;
    const port = new this.SerialPort({
      path,
      baudRate,
      dataBits: 8,
      parity: 'none',
      stopBits: 1,
      rtscts: false,
      xon: false,
      xoff: false,
      autoOpen: false,
    });
    port.on('error', () => {}); // durante el sondeo los errores solo descartan el candidato

    try {
      await new Promise((resolve, reject) => port.open((err) => (err ? reject(err) : resolve())));
    } catch (err) {
      this._info(`No se pudo abrir ${path}: ${err.message}. ¿Otro programa está usando el puerto?`);
      return null;
    }

    const parser = port.pipe(new this.ReadlineParser({ delimiter: '\n' }));
    await esperar(esperaArranqueMs);

    for (let i = 0; i < pingIntentos; i++) {
      if (await this._ping(port, parser, pingTimeoutMs)) return { port, parser };
    }
    await this._cerrar(port);
    return null;
  }

  _ping(port, parser, timeoutMs) {
    return new Promise((resolve) => {
      let temporizador = null;
      const terminar = (ok) => {
        clearTimeout(temporizador);
        parser.off('data', alRecibir);
        resolve(ok);
      };
      const alRecibir = (linea) => {
        try {
          const t = JSON.parse(String(linea).trim());
          if (t.evento === 'PONG' && t.dispositivo === FIRMA_DISPOSITIVO) terminar(true);
        } catch {
          /* otra línea (p. ej. texto de depuración): se ignora */
        }
      };
      temporizador = setTimeout(() => terminar(false), timeoutMs);
      parser.on('data', alRecibir);
      port.write('CMD_PING\n', (err) => {
        if (err) terminar(false);
      });
    });
  }

  _adoptar(path, { port, parser }) {
    this._port = port;
    this.puerto = path;
    this.conectado = true;
    this._ultimoMensaje = '';
    parser.on('data', (linea) => this._alRecibir(linea));
    port.on('error', (err) => this._perder(port, err.message));
    port.on('close', () => this._perder(port, 'el puerto se cerró; ¿se desconectó el cable USB?'));
    this.emit('conectado', { path, firma: FIRMA_DISPOSITIVO });
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
    if (this._port !== port) return; // aviso de un puerto anterior
    this._port = null;
    this.conectado = false;
    this.puerto = null;
    this.emit('desconectado', motivo);
    this._cerrar(port);
    setTimeout(() => this.iniciar(), this.cfg.serial.reintentoBusquedaMs); // reconexión automática
  }

  _cerrar(port) {
    return new Promise((resolve) => {
      if (port && port.isOpen) port.close(() => resolve());
      else resolve();
    });
  }

  enviar(linea) {
    return new Promise((resolve, reject) => {
      if (!this.conectado || !this._port) return reject(new Error('El hardware no está conectado.'));
      this._port.write(linea, (err) => (err ? reject(err) : resolve()));
    });
  }
}

module.exports = { EnlaceSerial };
