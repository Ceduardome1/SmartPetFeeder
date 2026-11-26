'use strict';

function enviarJson(res, codigo, objeto) {
  res.writeHead(codigo, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
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

/**
 * Controlador de la API HTTP / SSE del panel web.
 */
class ApiController {
  constructor({ config, hardwareController, dispensadorModel, bitacoraModel, sseService }) {
    this.config = config;
    this.hardware = hardwareController;
    this.dispensador = dispensadorModel;
    this.bitacora = bitacoraModel;
    this.sse = sseService;
  }

  eventosSSE(req, res) {
    this.sse.agregarCliente(req, res, this.hardware.obtenerInstantanea());
  }

  obtenerEstado(_req, res) {
    enviarJson(res, 200, {
      estado: this.dispensador.obtenerEstado(),
      simulador: this.hardware.esSimulador(),
    });
  }

  obtenerBitacora(_req, res) {
    enviarJson(res, 200, this.bitacora.recientes(500));
  }

  descargarBitacoraCsv(_req, res) {
    res.writeHead(200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="bitacora-dispensador.csv"',
    });
    res.end(this.bitacora.csv());
  }

  async listarPuertos(_req, res) {
    if (this.hardware.esSimulador()) {
      return enviarJson(res, 200, { simulador: true, puertos: [] });
    }
    try {
      const { SerialService } = require('../services/serialService');
      const puertos = await SerialService.listarPuertos(this.config);
      enviarJson(res, 200, { simulador: false, puertos });
    } catch (err) {
      enviarJson(res, 500, { ok: false, error: err.message });
    }
  }

  async enviarComando(req, res) {
    let cuerpo;
    try {
      cuerpo = JSON.parse((await leerCuerpo(req)) || '{}');
    } catch {
      return enviarJson(res, 400, { ok: false, error: 'El cuerpo de la petición no es JSON válido.' });
    }

    try {
      const resultado = await this.hardware.ejecutarComando(cuerpo.comando, cuerpo.valor);
      enviarJson(res, 200, { ok: true, enviado: resultado.enviado });
    } catch (err) {
      enviarJson(res, err.statusCode || 400, { ok: false, error: err.message });
    }
  }

  async ejecutarSimulacion(req, res) {
    let cuerpo;
    try {
      cuerpo = JSON.parse((await leerCuerpo(req)) || '{}');
    } catch {
      return enviarJson(res, 400, { ok: false, error: 'El cuerpo de la petición no es JSON válido.' });
    }

    try {
      this.hardware.ejecutarSimulacion(cuerpo.accion, cuerpo.valor);
      enviarJson(res, 200, { ok: true });
    } catch (err) {
      enviarJson(res, err.statusCode || 400, { ok: false, error: err.message });
    }
  }
}

module.exports = { ApiController, enviarJson };
