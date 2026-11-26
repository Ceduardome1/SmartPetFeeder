'use strict';

const { EventEmitter } = require('events');
const { FIRMA_DISPOSITIVO, UMBRAL_SIN_COMIDA, ANGULO_MIN, ANGULO_MAX } = require('../models/protocolo');

/**
 * Servicio de firmware virtual (modo demo).
 * Replica exactamente la máquina de estados de mcu/StateMachine.cpp y el contrato M2M
 * con la misma interfaz pública que SerialService.
 */
class SimuladorService extends EventEmitter {
  constructor() {
    super();
    this.simulador = true;
    this.conectado = false;
    this.puerto = null;
    this._timers = new Set();
    this.m = {
      nivel: 80,
      nivelReportado: 80,
      angulo: 50,
      escotilla: false,
      bloqueo: null, // null | 'PARO' | 'CABEZA'
      ocupado: false,
    };
  }

  _programar(fn, ms) {
    const id = setTimeout(() => {
      this._timers.delete(id);
      fn();
    }, ms);
    this._timers.add(id);
    return id;
  }

  iniciar() {
    this.emit('info', 'Iniciando el simulador del firmware…');
    this._programar(() => {
      this.conectado = true;
      this.puerto = 'SIMULADOR';
      this.emit('conectado', { path: 'SIMULADOR', firma: FIRMA_DISPOSITIVO });
      this._programar(() => this._emitir('ESTADO_NIVEL'), 100);
    }, 500);
  }

  async detener() {
    for (const id of this._timers) clearTimeout(id);
    this._timers.clear();
    this.conectado = false;
    this.puerto = null;
  }

  enviar(linea) {
    return new Promise((resolve, reject) => {
      if (!this.conectado) return reject(new Error('El hardware no está conectado.'));
      setImmediate(() => this._procesar(String(linea).trim()));
      resolve();
    });
  }

  // ----- Lógica equivalente a mcu/StateMachine.cpp + mcu/M2MProtocol.cpp -----

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
    this._programar(() => this.emit('trama', trama), 30);
  }

  _procesar(cmd) {
    if (cmd === 'CMD_PING') {
      this._programar(() => {
        this.emit('trama', { evento: 'PONG', dispositivo: FIRMA_DISPOSITIVO });
        this._emitir('ESTADO_NIVEL');
      }, 15);
      return;
    }
    if (cmd === 'CMD_DISPENSAR') return this._dispensar();
    if (cmd === 'CMD_REINICIAR') return this._reiniciar();
    if (cmd === 'CMD_ESCOTILLA' || cmd === 'CMD_PARO_EMERGENCIA') return this._paroRemoto();

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
    if (this.m.bloqueo) return;
    if (this.m.nivel <= UMBRAL_SIN_COMIDA) return this._emitir('SIN_COMIDA');
    if (this.m.ocupado) return;
    this.m.ocupado = true;
    this.m.escotilla = true;
    this._programar(() => {
      this.m.ocupado = false;
      if (!this.m.bloqueo) {
        this.m.escotilla = false;
        this._emitir('DISPENSACION_EXITOSA');
      }
    }, 1800);
  }

  _paroRemoto() {
    if (this.m.bloqueo === 'CABEZA') return;
    this.m.ocupado = false;
    this.m.bloqueo = 'PARO';
    this.m.escotilla = true;
    this._emitir('PARO_EMERGENCIA');
  }

  _toggleEscotillaFisico() {
    if (this.m.bloqueo === 'CABEZA') return;
    if (this.m.ocupado || !this.m.escotilla) {
      this._paroRemoto();
    } else {
      this.m.escotilla = false;
      this._emitir('PARO_EMERGENCIA');
    }
  }

  _cabeza() {
    this.m.ocupado = false;
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

  // ----- Simulación de entradas físicas (potenciómetro y 4 botones) -----

  simular(accion, valor) {
    switch (accion) {
      case 'nivel': {
        const v = Math.round(Number(valor));
        if (!(v >= 0 && v <= 100)) throw new Error('El nivel debe estar entre 0 y 100.');
        const antes = this.m.nivel;
        this.m.nivel = v;

        const cambioHisteresis = Math.abs(v - this.m.nivelReportado) >= 2;
        const cruzaHaciaVacio = antes > UMBRAL_SIN_COMIDA && v <= UMBRAL_SIN_COMIDA;
        const cruzaHaciaLleno = antes <= UMBRAL_SIN_COMIDA && v > UMBRAL_SIN_COMIDA;

        if (!this.m.bloqueo && cruzaHaciaVacio) {
          this.m.nivelReportado = v;
          this._emitir('SIN_COMIDA');
          return;
        }
        if (cambioHisteresis || cruzaHaciaLleno) {
          this._emitir('ESTADO_NIVEL');
        }
        return;
      }
      case 'cabeza':
        return this._cabeza();
      case 'dispensar':
        return this._dispensar();
      case 'escotilla':
        return this._toggleEscotillaFisico();
      case 'reiniciar':
        return this._reiniciar();
      default:
        throw new Error(`Acción de simulación desconocida: ${accion}`);
    }
  }
}

module.exports = { SimuladorService };
