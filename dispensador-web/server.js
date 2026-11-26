'use strict';

/**
 * Punto de entrada del servidor del Dispensador Inteligente (arquitectura MVC).
 *
 *   Arduino ──UART/JSON──▶ SerialService ──▶ HardwareController ──▶ Models + SseService ──▶ Vista Web
 *   Arduino ◀──CMD_*────── SerialService ◀── HardwareController ◀── ApiController ◀──────── Vista Web
 */

const http = require('http');
const os = require('os');

const config = require('./src/config/config');
const BitacoraModel = require('./src/models/bitacoraModel');
const DispensadorModel = require('./src/models/dispensadorModel');
const SseService = require('./src/services/sseService');
const HardwareController = require('./src/controllers/hardwareController');
const { ApiController } = require('./src/controllers/apiController');
const StaticController = require('./src/controllers/staticController');
const crearRouter = require('./src/routes/router');

function direccionesLan() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => i.address);
}

async function listarPuertosCli() {
  let SerialService;
  try {
    ({ SerialService } = require('./src/services/serialService'));
  } catch {
    console.error('Falta la dependencia "serialport". Ejecuta primero: npm install');
    process.exit(1);
  }

  const puertos = await SerialService.listarPuertos(config);
  const relevantes = puertos.filter((p) => !p.internoLinux);
  const omitidos = puertos.length - relevantes.length;

  if (relevantes.length === 0) {
    console.log('No se detectó ningún puerto USB-UART.');
    if (omitidos > 0) console.log(`(Se omitieron ${omitidos} puertos internos /dev/ttyS* de la placa base.)`);
    console.log('\nRevisa:');
    console.log('  1. Que el cable Mini-USB sea de DATOS (4 hilos) y no solo de carga.');
    console.log('  2. En Linux: que tu usuario esté en el grupo dialout y que brltty no capture el CH340.');
    return;
  }

  console.log('Puertos serie USB detectados:\n');
  for (const p of relevantes) {
    const marca = p.compatible
      ? '   <- compatible con Arduino Nano'
      : p.usbFallback
        ? '   <- USB-serial (candidato secundario)'
        : '';
    console.log(
      `  ${p.path.padEnd(18)} VID ${p.vendorId ?? '----'}  PID ${p.productId ?? '----'}  ${p.manufacturer}${marca}`
    );
  }
  if (omitidos > 0) {
    console.log(`\n(${omitidos} puertos internos /dev/ttyS* omitidos.)`);
  }
  console.log('\nSi necesitas forzar un puerto específico: npm start -- --puerto=/dev/ttyUSB0');
}

function crearEnlace() {
  try {
    if (config.simulador) {
      const { SimuladorService } = require('./src/services/simuladorService');
      return new SimuladorService();
    }
    const { SerialService } = require('./src/services/serialService');
    return new SerialService(config);
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND') {
      console.error('Falta la dependencia "serialport". Ejecuta primero: npm install');
      console.error('(Para probar la interfaz sin Arduino puedes usar: npm run demo)');
      process.exit(1);
    }
    throw err;
  }
}

async function main() {
  if (config.listarPuertos) return listarPuertosCli();

  // Ensamblaje MVC
  const bitacoraModel = new BitacoraModel(config.bitacora);
  const dispensadorModel = new DispensadorModel({ umbralNivelPct: config.bitacora.umbralNivelPct });
  const sseService = new SseService();
  const enlace = crearEnlace();

  const hardwareController = new HardwareController({
    config,
    enlace,
    dispensadorModel,
    bitacoraModel,
    sseService,
  });

  const apiController = new ApiController({
    config,
    hardwareController,
    dispensadorModel,
    bitacoraModel,
    sseService,
  });

  const staticController = new StaticController(config.publicDir);
  const router = crearRouter({ apiController, staticController });

  const servidor = http.createServer(router);
  servidor.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(
        `El puerto ${config.httpPort} ya está en uso. Cierra la otra instancia o usa: npm start -- --http=3001`
      );
    } else {
      console.error(err);
    }
    process.exit(1);
  });

  sseService.iniciarLatidos(15_000);

  let cerrando = false;
  async function apagar() {
    if (cerrando) return;
    cerrando = true;
    console.log('\nCerrando servidor y liberando puerto serial…');
    sseService.detener();
    await hardwareController.detener();
    servidor.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1500).unref();
  }

  process.on('SIGINT', apagar);
  process.on('SIGTERM', apagar);

  servidor.listen(config.httpPort, config.host, () => {
    bitacoraModel.agregar({
      tipo: 'sistema',
      severidad: 'info',
      evento: 'SERVIDOR_INICIADO',
      descripcion: 'Servidor web iniciado.',
    });
    console.log('\nDispensador inteligente: servidor web (MVC)');
    console.log(`  Panel:  http://localhost:${config.httpPort}`);
    if (config.host === '0.0.0.0') {
      for (const ip of direccionesLan()) console.log(`  En red: http://${ip}:${config.httpPort}`);
    }
    console.log(
      `  Modo:   ${hardwareController.esSimulador() ? 'simulador (sin hardware)' : 'hardware real (autodescubrimiento USB)'}\n`
    );
    hardwareController.iniciar();
  });
}

main();
