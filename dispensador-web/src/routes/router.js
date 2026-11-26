'use strict';

const { enviarJson } = require('../controllers/apiController');

/**
 * Enrutador HTTP declarativo.
 * Despacha peticiones API a ApiController y archivos de la vista a StaticController.
 */
function crearRouter({ apiController, staticController }) {
  return async function enrutar(req, res) {
    try {
      const { pathname } = new URL(req.url, 'http://localhost');

      if (req.method === 'GET' && pathname === '/api/eventos') return apiController.eventosSSE(req, res);
      if (req.method === 'GET' && pathname === '/api/estado') return apiController.obtenerEstado(req, res);
      if (req.method === 'GET' && pathname === '/api/bitacora') return apiController.obtenerBitacora(req, res);
      if (req.method === 'GET' && pathname === '/api/bitacora.csv') {
        return apiController.descargarBitacoraCsv(req, res);
      }
      if (req.method === 'GET' && pathname === '/api/puertos') return await apiController.listarPuertos(req, res);
      if (req.method === 'POST' && pathname === '/api/comando') return await apiController.enviarComando(req, res);
      if (req.method === 'POST' && pathname === '/api/sim') return await apiController.ejecutarSimulacion(req, res);

      if (req.method === 'GET' || req.method === 'HEAD') return staticController.servir(pathname, res);

      enviarJson(res, 405, { ok: false, error: 'Método no permitido' });
    } catch (err) {
      console.error(err);
      if (!res.headersSent) {
        enviarJson(res, 500, { ok: false, error: 'Error interno del servidor' });
      }
    }
  };
}

module.exports = crearRouter;
