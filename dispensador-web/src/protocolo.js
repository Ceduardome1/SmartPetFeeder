'use strict';

/**
 * Contrato M2M del dispensador (documento "Especificación de Sesión M2M").
 * Aquí viven las constantes del protocolo y la lógica pura (sin red ni puertos):
 * interpretar una trama del hardware y construir los comandos que envía la web.
 */

const FIRMA_DISPOSITIVO = 'SMART_PET_FEEDER_V1';
const UMBRAL_SIN_COMIDA = 5; // % — "Sin comida" cuando el nivel es <= 5 %
const ANGULO_MIN = 10; // % — rango de CMD_ANGULO:<valor>
const ANGULO_MAX = 100;

class ErrorComando extends Error {}

function estadoInicial() {
  return {
    conectado: false,
    puerto: null,
    mensajeEnlace: 'Iniciando…',
    nivel: null, // 0-100, del potenciómetro
    angulo: 50, // apertura configurada del dispensador (50 % por defecto)
    escotilla: false, // true = abierta
    bloqueo: null, // null | 'PARO' | 'CABEZA'
    sinComida: false,
    semaforo: 'NORMAL', // NORMAL | SIN_COMIDA | CRITICO
  };
}

function esTramaValida(t) {
  return t !== null && typeof t === 'object' && !Array.isArray(t) && typeof t.evento === 'string';
}

/** Devuelve el nuevo estado de la interfaz tras recibir una trama del hardware. */
function aplicarEvento(previo, t) {
  const e = { ...previo };

  if (Number.isFinite(t.nivel)) e.nivel = Math.min(100, Math.max(0, Math.round(t.nivel)));
  if (Number.isFinite(t.angulo)) e.angulo = Math.round(t.angulo);
  if (typeof t.escotilla === 'boolean') e.escotilla = t.escotilla;

  switch (t.evento) {
    case 'ALERTA_CABEZA_ATORADA':
      e.bloqueo = 'CABEZA'; // máxima prioridad
      break;
    case 'PARO_EMERGENCIA':
      if (e.bloqueo !== 'CABEZA') e.bloqueo = 'PARO';
      break;
    case 'FLUJO_REINICIADO':
      e.bloqueo = null;
      e.escotilla = false; // el reinicio deja ambos actuadores cerrados (0 %)
      break;
    default:
      break;
  }

  // Si el campo "estado" de la trama ya indica un bloqueo, se respeta aunque el evento sea otro.
  if (t.estado === 'CABEZA_ATORADA') e.bloqueo = 'CABEZA';
  else if (t.estado === 'PARO_EMERGENCIA' && e.bloqueo === null) e.bloqueo = 'PARO';

  const avisoSinComida = t.evento === 'SIN_COMIDA' || t.estado === 'SIN_COMIDA';
  e.sinComida = avisoSinComida || (e.nivel !== null && e.nivel <= UMBRAL_SIN_COMIDA);

  // Semáforo (RNF-03): verde operativo, amarillo sin comida, rojo emergencia
  e.semaforo = e.bloqueo ? 'CRITICO' : e.sinComida ? 'SIN_COMIDA' : 'NORMAL';
  return e;
}

/** Texto y severidad con que se anota cada evento en la bitácora. null = no se anota. */
function describirEvento(t, est) {
  switch (t.evento) {
    case 'ESTADO_NIVEL':
      return {
        severidad: 'info',
        descripcion: `Nivel de comida: ${est.nivel ?? '—'} %. Apertura del dispensador: ${est.angulo} %.`,
      };
    case 'DISPENSACION_EXITOSA':
      return { severidad: 'ok', descripcion: `Porción dispensada con apertura al ${est.angulo} %.` };
    case 'SIN_COMIDA':
      return {
        severidad: 'aviso',
        descripcion: 'Sin comida: el depósito llegó al mínimo o se intentó dispensar sin reserva.',
      };
    case 'PARO_EMERGENCIA':
      return {
        severidad: 'critico',
        descripcion:
          'Paro de emergencia: dispensador cerrado, escotilla abierta y dispensaciones bloqueadas hasta Reiniciar.',
      };
    case 'ALERTA_CABEZA_ATORADA':
      return {
        severidad: 'critico',
        descripcion:
          'Alerta crítica, cabeza atorada: escotilla abierta al 100 %, dispensador cerrado y alarma sonora activa.',
      };
    case 'FLUJO_REINICIADO':
      return { severidad: 'ok', descripcion: 'Flujo reiniciado: actuadores cerrados y sistema operativo.' };
    case 'PONG':
      return null;
    default:
      return { severidad: 'aviso', descripcion: `Evento no reconocido del hardware: ${t.evento}` };
  }
}

/**
 * Traduce una acción de la interfaz web a la cadena CMD_* del puerto serial.
 * Lanza ErrorComando si la acción o el valor no son válidos.
 */
function construirComando(nombre, valor, comandoParo) {
  switch (nombre) {
    case 'DISPENSAR':
      return { linea: 'CMD_DISPENSAR', descripcion: 'Dispensación solicitada desde la web.' };
    case 'PARO':
      return { linea: comandoParo, descripcion: 'Paro de emergencia solicitado desde la web (apertura de escotilla).' };
    case 'REINICIAR':
      return { linea: 'CMD_REINICIAR', descripcion: 'Reinicio de flujo solicitado desde la web.' };
    case 'ANGULO': {
      const v = Number(valor);
      if (!Number.isInteger(v) || v < ANGULO_MIN || v > ANGULO_MAX) {
        throw new ErrorComando(`La apertura debe ser un número entero entre ${ANGULO_MIN} y ${ANGULO_MAX}.`);
      }
      return { linea: `CMD_ANGULO:${v}`, descripcion: `Apertura del dispensador ajustada a ${v} % desde la web.` };
    }
    default:
      throw new ErrorComando(`Comando desconocido: ${nombre}`);
  }
}

module.exports = {
  FIRMA_DISPOSITIVO,
  UMBRAL_SIN_COMIDA,
  ANGULO_MIN,
  ANGULO_MAX,
  ErrorComando,
  estadoInicial,
  esTramaValida,
  aplicarEvento,
  describirEvento,
  construirComando,
};
