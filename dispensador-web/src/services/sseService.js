'use strict';

/**
 * Servicio Server-Sent Events (SSE) para empuje en tiempo real hacia los navegadores
 * bajo el canal "evento_hardware" (README: Nivel Presentación Web).
 */
class SseService {
  constructor() {
    this.clientes = new Set();
    this._timerLatido = null;
  }

  iniciarLatidos(intervaloMs = 15_000) {
    if (this._timerLatido) return;
    this._timerLatido = setInterval(() => {
      for (const res of this.clientes) {
        try {
          res.write(': latido\n\n');
        } catch {
          this.clientes.delete(res);
        }
      }
    }, intervaloMs);
    this._timerLatido.unref();
  }

  agregarCliente(req, res, instantanea) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write('retry: 2000\n\n');
    res.write(`event: snapshot\ndata: ${JSON.stringify(instantanea)}\n\n`);
    this.clientes.add(res);
    req.on('close', () => this.clientes.delete(res));
  }

  difundir(evento, estado, entrada = null) {
    const mensaje = `event: evento_hardware\ndata: ${JSON.stringify({ evento, estado, entrada })}\n\n`;
    for (const res of this.clientes) {
      try {
        res.write(mensaje);
      } catch {
        this.clientes.delete(res);
      }
    }
  }

  detener() {
    if (this._timerLatido) {
      clearInterval(this._timerLatido);
      this._timerLatido = null;
    }
    for (const res of this.clientes) {
      try {
        res.end();
      } catch {
        // Ignorar errores al cerrar clientes
      }
    }
    this.clientes.clear();
  }
}

module.exports = SseService;
