'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Bitácora cronológica persistente (RF-07). Cada entrada se guarda como una línea JSON
 * en data/bitacora.jsonl, así sobrevive a reinicios del servidor.
 */
class Bitacora {
  constructor({ archivo, maxEnMemoria }) {
    this.archivo = archivo;
    this.max = maxEnMemoria;
    this.entradas = [];
    this.siguienteId = 1;
    fs.mkdirSync(path.dirname(archivo), { recursive: true });
    this._cargar();
  }

  _leerArchivo() {
    try {
      return fs
        .readFileSync(this.archivo, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((linea) => {
          try {
            return JSON.parse(linea);
          } catch {
            return null;
          }
        })
        .filter(Boolean);
    } catch {
      return [];
    }
  }

  _cargar() {
    this.entradas = this._leerArchivo().slice(-this.max);
    const ultima = this.entradas[this.entradas.length - 1];
    if (ultima) this.siguienteId = ultima.id + 1;
  }

  /** tipo: 'hardware' | 'web' | 'sistema'; severidad: 'info' | 'ok' | 'aviso' | 'critico' */
  agregar({ tipo, severidad, evento, descripcion }) {
    const entrada = { id: this.siguienteId++, ts: new Date().toISOString(), tipo, severidad, evento, descripcion };
    this.entradas.push(entrada);
    if (this.entradas.length > this.max) this.entradas.shift();
    fs.appendFile(this.archivo, JSON.stringify(entrada) + '\n', () => {});
    return entrada;
  }

  /** Las más recientes primero. */
  recientes(n = 200) {
    return this.entradas.slice(-n).reverse();
  }

  /** Toda la historia en CSV (con BOM para que Excel respete los acentos). */
  csv() {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const filas = this._leerArchivo().map((e) => {
      const d = new Date(e.ts);
      return [
        d.toLocaleDateString('es-MX'),
        d.toLocaleTimeString('es-MX', { hour12: false }),
        e.tipo,
        e.severidad,
        e.evento,
        e.descripcion,
      ]
        .map(esc)
        .join(',');
    });
    return '﻿' + ['Fecha,Hora,Origen,Severidad,Evento,Descripción', ...filas].join('\r\n') + '\r\n';
  }
}

module.exports = Bitacora;
