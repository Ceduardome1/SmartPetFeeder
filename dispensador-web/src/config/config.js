'use strict';

const path = require('path');

const args = process.argv.slice(2);
const hayBandera = (nombre) => args.includes(`--${nombre}`);
const valorDe = (nombre) => {
  const a = args.find((x) => x.startsWith(`--${nombre}=`));
  return a ? a.split('=').slice(1).join('=') : undefined;
};

module.exports = {
  // Servidor web. Por defecto solo escucha en esta computadora; con --lan lo ve toda la red local.
  httpPort: Number(valorDe('http') || process.env.PORT || 3000),
  host: hayBandera('lan') ? '0.0.0.0' : '127.0.0.1',

  // Modos de ejecución
  simulador: hayBandera('simulador') || process.env.SIMULADOR === '1',
  listarPuertos: hayBandera('puertos'),
  // Si el autodescubrimiento no encuentra la placa, se puede forzar: --puerto=/dev/ttyUSB0 o --puerto=COM5
  puertoForzado: valorDe('puerto') || process.env.SERIAL_PORT || null,

  // Rutas del proyecto
  publicDir: path.join(__dirname, '..', '..', 'public'),

  // Parámetros del enlace UART definidos en el README (sección "Especificación de Sesión M2M")
  serial: {
    baudRate: 115200, // 8N1, sin control de flujo
    esperaArranqueMs: 2000, // 1500-2000 ms tras pulso DTR para bootloader del Arduino Nano
    pingTimeoutMs: 500, // ventana máxima de 500 ms para recibir PONG
    pingIntentos: 3, // reintentos de CMD_PING por puerto candidato
    pingPausaEntreIntentosMs: 250,
    reintentoBusquedaMs: 2500,
    // VID de controladores USB-UART compatibles: CH340, FTDI, Arduino oficial (2341/2a03), CP210x
    vendorIds: ['1a86', '0403', '2341', '2a03', '10c4'],
  },

  // El MCU acepta tanto CMD_ESCOTILLA como CMD_PARO_EMERGENCIA (M2MProtocol.cpp).
  // Se permite sobreescribir vía variable de entorno CMD_PARO.
  comandoParo: process.env.CMD_PARO || 'CMD_ESCOTILLA',

  bitacora: {
    archivo: path.join(__dirname, '..', '..', 'data', 'bitacora.jsonl'),
    maxEnMemoria: 500,
    // Los cambios de nivel del potenciómetro llegan cada ±2 %; en la bitácora solo se
    // anotan cuando el nivel cambió al menos esto desde la última anotación.
    umbralNivelPct: 10,
  },
};
