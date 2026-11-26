/**
 * Modelo de estado del cliente web (HMI remota).
 */

export const MAX_FILAS_BITACORA = 200;

export const state = {
  servidor: 'conectando', // 'conectando' | 'ok' | 'caido'
  estado: null, // último estado calculado por el servidor
  bitacora: [], // la más reciente primero
  simulador: false,

  aperturaBorrador: null, // valor del slider pendiente de aplicar
  dispensando: false, // bloquea clics repetidos mientras el servo completa el ciclo
  aperturaAnimada: null, // posición temporal del servo al confirmar dispensación
};

export function estaConectado() {
  return state.servidor === 'ok' && state.estado !== null && state.estado.conectado;
}

export function aplicarSnapshot(datos) {
  state.estado = datos.estado;
  state.bitacora = Array.isArray(datos.bitacora) ? datos.bitacora : [];
  state.simulador = Boolean(datos.simulador);
  state.servidor = 'ok';
}

export function aplicarEventoHardware(msg) {
  state.estado = msg.estado;
  state.servidor = 'ok';
  if (msg.entrada) {
    state.bitacora.unshift(msg.entrada);
    if (state.bitacora.length > 500) state.bitacora.pop();
  }
}
