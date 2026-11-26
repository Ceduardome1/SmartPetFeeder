/**
 * Capa de comunicación con el servidor (SSE en tiempo real y comandos POST).
 * Sin polling: el servidor empuja eventos por el canal "evento_hardware".
 */

export function conectarEventos({ onSnapshot, onEventoHardware, onError }) {
  const fuente = new EventSource('/api/eventos');

  fuente.addEventListener('snapshot', (ev) => {
    onSnapshot(JSON.parse(ev.data));
  });

  fuente.addEventListener('evento_hardware', (ev) => {
    onEventoHardware(JSON.parse(ev.data));
  });

  fuente.onerror = () => {
    onError();
  };

  return fuente;
}

export async function enviarComando(comando, valor) {
  try {
    const r = await fetch('/api/comando', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comando, valor }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) {
      return { ok: false, error: j.error || `El servidor respondió con error ${r.status}.` };
    }
    return { ok: true, enviado: j.enviado };
  } catch {
    return { ok: false, error: 'No se pudo contactar con el servidor web.' };
  }
}

export async function enviarSimulacion(accion, valor) {
  try {
    const r = await fetch('/api/sim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion, valor }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      return { ok: false, error: j.error || 'El simulador rechazó la acción.' };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'No se pudo contactar con el servidor web.' };
  }
}
