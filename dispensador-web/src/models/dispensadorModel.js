'use strict';

const P = require('./protocolo');

/**
 * Modelo del estado en vivo del dispensador.
 * Mantiene el estado sincronizado con la máquina de estados del MCU y determina
 * qué eventos de telemetría deben persistirse en la bitácora.
 */
class DispensadorModel {
  constructor({ umbralNivelPct = 10 } = {}) {
    this.umbralNivelPct = umbralNivelPct;
    this.estado = P.estadoInicial();
    this._ultimoRegistrado = { nivel: null, angulo: null };
  }

  obtenerEstado() {
    return { ...this.estado };
  }

  actualizarMensajeEnlace(mensaje) {
    this.estado = { ...this.estado, mensajeEnlace: mensaje };
    return this.obtenerEstado();
  }

  marcarConectado(puerto) {
    this.estado = {
      ...P.estadoInicial(),
      conectado: true,
      puerto,
      mensajeEnlace: `Conectado en ${puerto}`,
    };
    this._ultimoRegistrado = { nivel: null, angulo: null };
    return this.obtenerEstado();
  }

  marcarDesconectado(motivo) {
    this.estado = {
      ...this.estado,
      conectado: false,
      puerto: null,
      mensajeEnlace: `Se perdió la conexión: ${motivo}. Reintentando…`,
    };
    return this.obtenerEstado();
  }

  _debeRegistrar(trama) {
    if (trama.evento !== 'ESTADO_NIVEL') return true;
    const cambioNivel =
      this.estado.nivel !== null &&
      (this._ultimoRegistrado.nivel === null ||
        Math.abs(this.estado.nivel - this._ultimoRegistrado.nivel) >= this.umbralNivelPct);
    const cambioAngulo = this.estado.angulo !== this._ultimoRegistrado.angulo;

    if (cambioNivel || cambioAngulo) {
      this._ultimoRegistrado = { nivel: this.estado.nivel, angulo: this.estado.angulo };
      return true;
    }
    return false;
  }

  aplicarTrama(trama) {
    if (!P.esTramaValida(trama)) {
      return { valido: false, estado: this.obtenerEstado(), infoBitacora: null };
    }

    this.estado = P.aplicarEvento(this.estado, trama);
    const info = P.describirEvento(trama, this.estado);
    const infoBitacora = info && this._debeRegistrar(trama) ? info : null;

    return {
      valido: true,
      estado: this.obtenerEstado(),
      infoBitacora,
    };
  }
}

module.exports = DispensadorModel;
