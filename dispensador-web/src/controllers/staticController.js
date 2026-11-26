'use strict';

const fs = require('fs');
const path = require('path');
const { enviarJson } = require('./apiController');

const TIPOS_MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

/**
 * Controlador de archivos estáticos (Vista web en public/).
 */
class StaticController {
  constructor(publicDir) {
    this.publicDir = path.resolve(publicDir);
  }

  servir(pathname, res) {
    let relativa;
    try {
      relativa = decodeURIComponent(pathname);
    } catch {
      return enviarJson(res, 400, { ok: false, error: 'Ruta inválida' });
    }

    if (relativa === '/') relativa = '/index.html';
    const ruta = path.normalize(path.join(this.publicDir, relativa));
    if (!ruta.startsWith(this.publicDir + path.sep)) {
      return enviarJson(res, 403, { ok: false, error: 'Acceso denegado' });
    }

    fs.readFile(ruta, (err, contenido) => {
      if (err) return enviarJson(res, 404, { ok: false, error: 'No encontrado' });
      res.writeHead(200, {
        'Content-Type': TIPOS_MIME[path.extname(ruta)] || 'application/octet-stream',
        'Cache-Control': 'no-cache',
      });
      res.end(contenido);
    });
  }
}

module.exports = StaticController;
