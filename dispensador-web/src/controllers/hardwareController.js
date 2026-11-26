'use strict';

const P = require('../models/protocolo');

/**
 * Controlador de Hardware.
 * Coordina el enlace M2M (SerialService o SimuladorService), actualiza los modelos
 * (DispensadorModel y BitacoraModel) y empuja notificaciones por SseService.
 */
class HardwareController {
  constructor({ config, enlace, dispensadorModel, bitacoraModel, sseService }) {
    this.config = config;
    this.enlace = enlace;
    this.dispensador = dispensadorModel;
    this.bitacora = bitacoraModel;
    this.sse = sseService;
  }

  esSimulador() {
    return Boolean(this.enlace.simulador);
  }

  obtenerInstantanea() {
    return {
      estado: this.dispensador.obtenerEstado(),
      bitacora: this.bitacora.recientes(200),
      simulador: this.esSimulador(),
    };
  }

  _registrar(tipo, severidad, evento, descripcion) {
    return this.bitacora.agregar({ tipo, severidad, evento, descripcion });
  }

  iniciar() {
    this.dispensador.actualizarMensajeEnlace(
      this.esSimulador() ? 'Iniciando el simulador…' : 'Buscando el Arduino Nano por USB…'
    );

    this.enlace.on('info', (mensaje) => {
      const estado = this.dispensador.actualizarMensajeEnlace(mensaje);
      console.log(`[enlace] ${mensaje}`);
      this.sse.difundir('ENLACE_INFO', estado);
    });

    this.enlace.on('conectado', ({ path: puerto, firma }) => {
      const estado = this.dispensador.marcarConectado(puerto);
      const texto = this.esSimulador()
        ? 'Simulador del firmware activo (sin hardware real).'
        : `Hardware ${firma} conectado en ${puerto} (115200 baudios, 8N1).`;
      console.log(`[enlace] ${texto}`);
      const entrada = this._registrar('sistema', 'ok', 'ENLACE_CONECTADO', texto);
      this.sse.difundir('ENLACE_CONECTADO', estado, entrada);
    });

    this.enlace.on('desconectado', (motivo) => {
      const estado = this.dispensador.marcarDesconectado(motivo);
      console.log(`[enlace] desconectado: ${motivo}`);
      const entrada = this._registrar(
        'sistema',
        'aviso',
        'ENLACE_PERDIDO',
        `Se perdió la conexión con el hardware: ${motivo}.`
      );
      this.sse.difundir('ENLACE_PERDIDO', estado, entrada);
    });

    this.enlace.on('trama', (trama) => this._manejarTrama(trama));
    this.enlace.on('trama-invalida', (texto) => console.log(`[serial] línea ignorada: ${texto}`));

    this.enlace.iniciar();
  }

  async detener() {
    if (typeof this.enlace.detener === 'function') {
      await this.enlace.detener();
    }
  }

  _manejarTrama(trama) {
    const resultado = this.dispensador.aplicarTrama(trama);
    if (!resultado.valido) {
      console.log('[serial] trama sin campo "evento": ignorada');
      return;
    }

    if (trama.evento !== 'ESTADO_NIVEL') {
      console.log(`[hardware] ${JSON.stringify(trama)}`);
    }

    let entrada = null;
    if (resultado.infoBitacora) {
      entrada = this._registrar(
        'hardware',
        resultado.infoBitacora.severidad,
        trama.evento,
        resultado.infoBitacora.descripcion
      );
    }

    this.sse.difundir(trama.evento, resultado.estado, entrada);
  }

  async ejecutarComando(comando, valor) {
    let cmd;
    try {
      cmd = P.construirComando(comando, valor, this.config.comandoParo);
    } catch (err) {
      const entrada = this._registrar('web', 'aviso', 'CMD_RECHAZADO', `Comando rechazado: ${err.message}`);
      this.sse.difundir('CMD_RECHAZADO', this.dispensador.obtenerEstado(), entrada);
      const error = new Error(err.message);
      error.statusCode = 400;
      throw error;
    }

    try {
      await this.enlace.enviar(cmd.linea + '\n');
    } catch (err) {
      const motivo = `Comando ${cmd.linea} rechazado: ${err.message}`;
      const entrada = this._registrar('web', 'aviso', 'CMD_RECHAZADO', motivo);
      this.sse.difundir('CMD_RECHAZADO', this.dispensador.obtenerEstado(), entrada);
      const error = new Error(err.message);
      error.statusCode = 503;
      throw error;
    }

    const nombre = cmd.linea.split(':')[0];
    const entrada = this._registrar('web', 'info', nombre, cmd.descripcion);
    this.sse.difundir(nombre, this.dispensador.obtenerEstado(), entrada);
    console.log(`[web] ${cmd.linea}`);
    return { enviado: cmd.linea };
  }

  ejecutarSimulacion(accion, valor) {
    if (!this.esSimulador()) {
      const error = new Error('Solo disponible en modo simulador.');
      error.statusCode = 404;
      throw error;
    }
    this.enlace.simular(accion, valor);
  }
}

module.exports = HardwareController;
