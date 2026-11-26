'use strict';

/**
 * Servidor del Dispensador Inteligente: une el puerto serial (Arduino) con la interfaz web.
 *
 *   Arduino ──UART/JSON──▶ este servidor ──SSE (canal evento_hardware)──▶ navegador
 *   Arduino ◀──CMD_*────── este servidor ◀──POST /api/comando────────────── navegador
 *
 * Sin polling: el servidor solo reacciona cuando llega una línea completa (\n) del hardware.
 */

const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const config = require('./src/config');
const P = require('./src/protocolo');
const Bitacora = require('./src/bitacora');

const PUBLIC = path.join(__dirname, 'public');
const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

let bitacora = null;
let enlace = null;
let estado = P.estadoInicial();
let ultimoRegistrado = { nivel: null, angulo: null };
const clientes = new Set();

// ---------------------------------------------------------------- utilidades

function json(res, codigo, objeto) {
  res.writeHead(codigo, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(objeto));
}

function leerCuerpo(req, limite = 10_000) {
  return new Promise((resolve, reject) => {
    let datos = '';
    req.on('data', (trozo) => {
      datos += trozo;
      if (datos.length > limite) {
        reject(new Error('Cuerpo demasiado grande'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(datos));
    req.on('error', reject);
  });
}

function registrar(tipo, severidad, evento, descripcion) {
  return bitacora.agregar({ tipo, severidad, evento, descripcion });
}

/** Empuja un mensaje a todos los navegadores abiertos por el canal evento_hardware. */
function difundir(evento, entrada = null) {
  const mensaje = `event: evento_hardware\ndata: ${JSON.stringify({ evento, estado, entrada })}\n\n`;
  for (const res of clientes) {
    try {
      res.write(mensaje);
    } catch {
      clientes.delete(res);
    }
  }
}

// ---------------------------------------------------------------- eventos del hardware

function debeRegistrar(t) {
  if (t.evento !== 'ESTADO_NIVEL') return true;
  const cambioNivel =
    estado.nivel !== null &&
    (ultimoRegistrado.nivel === null || Math.abs(estado.nivel - ultimoRegistrado.nivel) >= config.bitacora.umbralNivelPct);
  const cambioAngulo = estado.angulo !== ultimoRegistrado.angulo;
  if (cambioNivel || cambioAngulo) {
    ultimoRegistrado = { nivel: estado.nivel, angulo: estado.angulo };
    return true;
  }
  return false;
}

function manejarTrama(t) {
  if (!P.esTramaValida(t)) {
    console.log('[serial] trama sin campo "evento": ignorada');
    return;
  }
  estado = P.aplicarEvento(estado, t);
  if (t.evento !== 'ESTADO_NIVEL') console.log(`[hardware] ${JSON.stringify(t)}`);

  let entrada = null;
  const info = P.describirEvento(t, estado);
  if (info && debeRegistrar(t)) entrada = registrar('hardware', info.severidad, t.evento, info.descripcion);
  difundir(t.evento, entrada);
}

function conectarEnlace() {
  enlace.on('info', (mensaje) => {
    estado = { ...estado, mensajeEnlace: mensaje };
    console.log(`[enlace] ${mensaje}`);
    difundir('ENLACE_INFO');
  });

  enlace.on('conectado', ({ path: puerto, firma }) => {
    estado = { ...P.estadoInicial(), conectado: true, puerto, mensajeEnlace: `Conectado en ${puerto}` };
    ultimoRegistrado = { nivel: null, angulo: null };
    const texto = enlace.simulador
      ? 'Simulador del firmware activo (sin hardware real).'
      : `Hardware ${firma} conectado en ${puerto} (115200 baudios, 8N1).`;
    console.log(`[enlace] ${texto}`);
    difundir('ENLACE_CONECTADO', registrar('sistema', 'ok', 'ENLACE_CONECTADO', texto));
  });

  enlace.on('desconectado', (motivo) => {
    estado = {
      ...estado,
      conectado: false,
      puerto: null,
      mensajeEnlace: `Se perdió la conexión: ${motivo}. Reintentando…`,
    };
    console.log(`[enlace] desconectado: ${motivo}`);
    difundir('ENLACE_PERDIDO', registrar('sistema', 'aviso', 'ENLACE_PERDIDO', `Se perdió la conexión con el hardware: ${motivo}.`));
  });

  enlace.on('trama', manejarTrama);
  enlace.on('trama-invalida', (texto) => console.log(`[serial] línea ignorada: ${texto}`));
  enlace.iniciar();
}

// ---------------------------------------------------------------- API

function abrirSSE(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write('retry: 2000\n\n');
  const instantanea = { estado, bitacora: bitacora.recientes(200), simulador: !!enlace.simulador };
  res.write(`event: snapshot\ndata: ${JSON.stringify(instantanea)}\n\n`);
  clientes.add(res);
  req.on('close', () => clientes.delete(res));
}

async function manejarComando(req, res) {
  let cuerpo;
  try {
    cuerpo = JSON.parse((await leerCuerpo(req)) || '{}');
  } catch {
    return json(res, 400, { ok: false, error: 'El cuerpo de la petición no es JSON válido.' });
  }

  let cmd;
  try {
    cmd = P.construirComando(cuerpo.comando, cuerpo.valor, config.comandoParo);
  } catch (err) {
    difundir('CMD_RECHAZADO', registrar('web', 'aviso', 'CMD_RECHAZADO', `Comando rechazado: ${err.message}`));
    return json(res, 400, { ok: false, error: err.message });
  }

  try {
    await enlace.enviar(cmd.linea + '\n');
  } catch (err) {
    const motivo = `Comando ${cmd.linea} rechazado: ${err.message}`;
    difundir('CMD_RECHAZADO', registrar('web', 'aviso', 'CMD_RECHAZADO', motivo));
    return json(res, 503, { ok: false, error: err.message });
  }

  const nombre = cmd.linea.split(':')[0];
  difundir(nombre, registrar('web', 'info', nombre, cmd.descripcion));
  console.log(`[web] ${cmd.linea}`);
  json(res, 200, { ok: true, enviado: cmd.linea });
}

async function manejarSimulacion(req, res) {
  if (!enlace.simulador) return json(res, 404, { ok: false, error: 'Solo disponible en modo simulador.' });
  try {
    const { accion, valor } = JSON.parse((await leerCuerpo(req)) || '{}');
    enlace.simular(accion, valor);
    json(res, 200, { ok: true });
  } catch (err) {
    json(res, 400, { ok: false, error: err.message });
  }
}

function servirEstatico(pathname, res) {
  let relativa;
  try {
    relativa = decodeURIComponent(pathname);
  } catch {
    return json(res, 400, { ok: false, error: 'Ruta inválida' });
  }
  if (relativa === '/') relativa = '/index.html';
  const ruta = path.normalize(path.join(PUBLIC, relativa));
  if (!ruta.startsWith(PUBLIC + path.sep)) return json(res, 403, { ok: false, error: 'Acceso denegado' });

  fs.readFile(ruta, (err, contenido) => {
    if (err) return json(res, 404, { ok: false, error: 'No encontrado' });
    res.writeHead(200, {
      'Content-Type': TIPOS[path.extname(ruta)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(contenido);
  });
}

async function enrutar(req, res) {
  try {
    const { pathname } = new URL(req.url, 'http://localhost');
    if (req.method === 'GET' && pathname === '/api/eventos') return abrirSSE(req, res);
    if (req.method === 'GET' && pathname === '/api/estado') {
      return json(res, 200, { estado, simulador: !!enlace.simulador });
    }
    if (req.method === 'GET' && pathname === '/api/bitacora') return json(res, 200, bitacora.recientes(500));
    if (req.method === 'GET' && pathname === '/api/bitacora.csv') {
      res.writeHead(200, {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="bitacora-dispensador.csv"',
      });
      return res.end(bitacora.csv());
    }
    if (req.method === 'POST' && pathname === '/api/comando') return await manejarComando(req, res);
    if (req.method === 'POST' && pathname === '/api/sim') return await manejarSimulacion(req, res);
    if (req.method === 'GET' || req.method === 'HEAD') return servirEstatico(pathname, res);
    json(res, 405, { ok: false, error: 'Método no permitido' });
  } catch (err) {
    console.error(err);
    if (!res.headersSent) json(res, 500, { ok: false, error: 'Error interno del servidor' });
  }
}

// ---------------------------------------------------------------- arranque

async function listarPuertos() {
  let SerialPort;
  try {
    ({ SerialPort } = require('serialport'));
  } catch {
    console.error('Falta la dependencia "serialport". Ejecuta primero: npm install');
    process.exit(1);
  }
  const puertos = await SerialPort.list();
  if (puertos.length === 0) return console.log('No se detectó ningún puerto serie.');
  console.log('Puertos serie detectados:\n');
  for (const p of puertos) {
    const compatible = p.vendorId && config.serial.vendorIds.includes(p.vendorId.toLowerCase());
    console.log(
      `  ${p.path.padEnd(16)} VID ${p.vendorId ?? '----'}  PID ${p.productId ?? '----'}  ${p.manufacturer ?? ''}` +
        (compatible ? '   <- compatible con Arduino Nano' : '')
    );
  }
  console.log('\nSi tu placa no aparece como compatible, arranca con: npm start -- --puerto=COM5 (usa tu puerto).');
}

function crearEnlace() {
  try {
    if (config.simulador) {
      const { EnlaceSimulado } = require('./src/simulador');
      return new EnlaceSimulado();
    }
    const { EnlaceSerial } = require('./src/serial');
    return new EnlaceSerial(config);
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND') {
      console.error('Falta la dependencia "serialport". Ejecuta primero: npm install');
      console.error('(Para ver la interfaz sin Arduino puedes usar: npm run demo)');
      process.exit(1);
    }
    throw err;
  }
}

function direccionesLan() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => i.address);
}

async function main() {
  if (config.listarPuertos) return listarPuertos();

  bitacora = new Bitacora(config.bitacora);
  enlace = crearEnlace();
  estado.mensajeEnlace = enlace.simulador ? 'Iniciando el simulador…' : 'Buscando el Arduino Nano por USB…';

  const servidor = http.createServer(enrutar);
  servidor.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`El puerto ${config.httpPort} ya está en uso. Cierra la otra instancia o usa: npm start -- --http=3001`);
    } else {
      console.error(err);
    }
    process.exit(1);
  });

  setInterval(() => {
    for (const res of clientes) {
      try {
        res.write(': latido\n\n');
      } catch {
        clientes.delete(res);
      }
    }
  }, 15_000).unref();

  servidor.listen(config.httpPort, config.host, () => {
    registrar('sistema', 'info', 'SERVIDOR_INICIADO', 'Servidor web iniciado.');
    console.log('\nDispensador inteligente: servidor web');
    console.log(`  Panel:  http://localhost:${config.httpPort}`);
    if (config.host === '0.0.0.0') {
      for (const ip of direccionesLan()) console.log(`  En red: http://${ip}:${config.httpPort}`);
    }
    console.log(`  Modo:   ${enlace.simulador ? 'simulador (sin hardware)' : 'hardware real (autodescubrimiento USB)'}\n`);
    conectarEnlace();
  });
}

process.on('SIGINT', () => process.exit(0));
main();
