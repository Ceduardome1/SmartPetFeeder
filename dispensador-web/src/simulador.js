'use strict';

const { EventEmitter } = require('events');
const { FIRMA_DISPOSITIVO, UMBRAL_SIN_COMIDA, ANGULO_MIN, ANGULO_MAX } = require('./protocolo');

/**
 * Firmware virtual: habla el mismo contrato M2M que el Arduino (PING/PONG, tramas JSON,
 * comandos CMD_*). Sirve para probar y presentar la interfaz sin hardware conectado.
 * Tiene la misma interfaz que EnlaceSerial, más simular() para imitar los componentes
 * físicos (potenciómetro y pulsadores).
 */
class EnlaceSimulado extends EventEmitter {
  constructor() {
    super();
    this.simulador = true;
    this.conectado = false;
    this.puerto = null;
    this.m = { nivel: 80, nivelReportado: 80, angulo: 50, escotilla: false, bloqueo: null, ocupado: false };
  }

  iniciar() {
    this.emit('info', 'Iniciando el simulador del firmware…');
    setTimeout(() => {
      this.conectado = true;
      this.puerto = 'SIMULADOR';
      this.emit('conectado', { path: 'SIMULADOR', firma: FIRMA_DISPOSITIVO });
      setTimeout(() => this._emitir('ESTADO_NIVEL'), 100); // sincronización de estado inicial
    }, 600);
  }

  enviar(linea) {
    return new Promise((resolve, reject) => {
      if (!this.conectado) return reject(new Error('El hardware no está conectado.'));
      setImmediate(() => this._procesar(String(linea).trim()));
      resolve();
    });
  }

  // ----- Firmware virtual -----

  _estadoGlobal() {
    if (this.m.bloqueo === 'CABEZA') return 'CABEZA_ATORADA';
    if (this.m.bloqueo === 'PARO') return 'PARO_EMERGENCIA';
    return this.m.nivel <= UMBRAL_SIN_COMIDA ? 'SIN_COMIDA' : 'OPERATIVO';
  }

  _emitir(evento) {
    if (evento === 'ESTADO_NIVEL') this.m.nivelReportado = this.m.nivel;
    const trama = {
      evento,
      estado: this._estadoGlobal(),
      nivel: this.m.nivel,
      angulo: this.m.angulo,
      escotilla: this.m.escotilla,
    };
    setTimeout(() => this.emit('trama', trama), 30);
  }

  _procesar(cmd) {
    if (cmd === 'CMD_PING') {
      setTimeout(() => this.emit('trama', { evento: 'PONG', dispositivo: FIRMA_DISPOSITIVO }), 10);
      return;
    }
    if (cmd === 'CMD_DISPENSAR') return this._dispensar();
    if (cmd === 'CMD_REINICIAR') return this._reiniciar();
    if (cmd === 'CMD_ESCOTILLA' || cmd === 'CMD_PARO_EMERGENCIA') return this._paro();
    const m = /^CMD_ANGULO:(\d+)$/.exec(cmd);
    if (m) {
      const v = Number(m[1]);
      if (v >= ANGULO_MIN && v <= ANGULO_MAX) {
        this.m.angulo = v;
        this._emitir('ESTADO_NIVEL');
      }
    }
  }

  _dispensar() {
    if (this.m.bloqueo) return; // bloqueado hasta Reiniciar: el firmware ignora la orden
    if (this.m.nivel <= UMBRAL_SIN_COMIDA) return this._emitir('SIN_COMIDA');
    if (this.m.ocupado) return;
    this.m.ocupado = true;
    setTimeout(() => {
      this.m.ocupado = false;
      if (!this.m.bloqueo) this._emitir('DISPENSACION_EXITOSA');
    }, 1500); // duración del ciclo del servo
  }

  _paro() {
    if (this.m.bloqueo !== 'CABEZA') this.m.bloqueo = 'PARO';
    this.m.escotilla = true;
    this._emitir('PARO_EMERGENCIA');
  }

  _cabeza() {
    this.m.bloqueo = 'CABEZA';
    this.m.escotilla = true;
    this._emitir('ALERTA_CABEZA_ATORADA');
  }

  _reiniciar() {
    this.m.bloqueo = null;
    this.m.escotilla = false;
    this.m.ocupado = false;
    this._emitir('FLUJO_REINICIADO');
  }

  // ----- Componentes físicos simulados -----

  simular(accion, valor) {
    switch (accion) {
      case 'nivel': {
        const v = Math.round(Number(valor));
        if (!(v >= 0 && v <= 100)) throw new Error('El nivel debe estar entre 0 y 100.');
        const antes = this.m.nivel;
        this.m.nivel = v;
        const cruzaUmbral = antes > UMBRAL_SIN_COMIDA !== v > UMBRAL_SIN_COMIDA;
        // El firmware solo reporta cambios de ±2 % en el potenciómetro
        if (cruzaUmbral || Math.abs(v - this.m.nivelReportado) >= 2) this._emitir('ESTADO_NIVEL');
        if (antes > UMBRAL_SIN_COMIDA && v <= UMBRAL_SIN_COMIDA) this._emitir('SIN_COMIDA');
        return;
      }
      case 'cabeza':
        return this._cabeza();
      case 'dispensar':
        return this._dispensar();
      case 'escotilla':
        return this._paro();
      case 'reiniciar':
        return this._reiniciar();
      default:
        throw new Error(`Acción de simulación desconocida: ${accion}`);
    }
  }
}

module.exports = { EnlaceSimulado };
