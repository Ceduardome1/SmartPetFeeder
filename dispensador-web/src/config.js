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
  // Si el autodescubrimiento no encuentra la placa, se puede forzar: --puerto=COM5
  puertoForzado: valorDe('puerto') || process.env.SERIAL_PORT || null,

  // Parámetros del enlace UART definidos en el documento (sección "Sesión M2M")
  serial: {
    baudRate: 115200, // 8N1, sin control de flujo
    esperaArranqueMs: 1800, // el bootloader del Nano tarda en arrancar tras el pulso DTR
    pingTimeoutMs: 500, // ventana máxima para recibir el PONG
    pingIntentos: 2,
    reintentoBusquedaMs: 3000,
    // VID de los chips USB-UART compatibles: CH340, FTDI, Arduino oficial, CP210x
    vendorIds: ['1a86', '0403', '2341', '10c4'],
  },

  // El documento nombra dos veces el comando de paro: CMD_ESCOTILLA (diccionario M2M)
  // y CMD_PARO_EMERGENCIA (sección 3.2). Si el firmware usa el otro, cambiarlo aquí
  // o ejecutar con la variable de entorno CMD_PARO.
  comandoParo: process.env.CMD_PARO || 'CMD_ESCOTILLA',

  bitacora: {
    archivo: path.join(__dirname, '..', 'data', 'bitacora.jsonl'),
    maxEnMemoria: 500,
    // Los cambios de nivel del potenciómetro llegan cada ±2 %; en la bitácora solo se
    // anotan cuando el nivel cambió al menos esto desde la última anotación.
    umbralNivelPct: 10,
  },
};
