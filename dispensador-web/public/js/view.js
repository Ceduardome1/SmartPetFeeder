/**
 * Capa Vista del cliente web: renderizado del DOM a partir del estado.
 */

import { MAX_FILAS_BITACORA, estaConectado } from './state.js';

export const $ = (id) => document.getElementById(id);

const ORIGEN = { hardware: 'Hardware', web: 'Web', sistema: 'Sistema' };

const SEMAFORO = {
  NORMAL: { luz: 'verde', etiqueta: 'Normal', detalle: 'Operativo y listo para dispensar.' },
  SIN_COMIDA: {
    luz: 'amarilla',
    etiqueta: 'Sin comida',
    detalle: 'El depósito está en el mínimo. Rellénalo para poder dispensar.',
  },
  CRITICO: {
    luz: 'roja',
    etiqueta: 'Crítico',
    detalle: 'Paro de emergencia activo. Dispensaciones bloqueadas.',
  },
};

let temporizadorAviso = null;

function infoBanner(state) {
  if (!estaConectado()) return null;
  const { estado } = state;

  if (estado.bloqueo === 'CABEZA') {
    return {
      clase: 'critico',
      titulo: 'Alerta crítica: cabeza atorada',
      detalle:
        'Escotilla abierta al 100 %, dispensador cerrado y alarma sonora activa. Libera a la mascota y pulsa «Reiniciar flujo».',
    };
  }
  if (estado.bloqueo === 'PARO') {
    return {
      clase: 'critico',
      titulo: 'Paro de emergencia',
      detalle:
        estado.escotilla === false
          ? 'Escotilla cerrada manualmente, pero el dispensador sigue bloqueado. Pulsa «Reiniciar flujo» para volver a operar.'
          : 'Escotilla abierta y dispensador cerrado y bloqueado. Pulsa «Reiniciar flujo» para volver a operar.',
    };
  }
  if (estado.sinComida) {
    return {
      clase: 'aviso',
      titulo: 'Sin comida',
      detalle: 'El depósito llegó al mínimo (5 % o menos). Rellénalo para poder dispensar.',
    };
  }
  return null;
}

function ponerCuerno(id, porcentaje) {
  $(id).style.transform = `rotate(${porcentaje * 1.8}deg)`; // 0 % izquierda, 100 % derecha
}

export function renderEnlace(state) {
  let clase;
  let texto;

  if (state.servidor === 'caido') {
    clase = 'enlace-off';
    texto = 'Sin conexión con el servidor web. Reintentando…';
  } else if (state.servidor === 'conectando' || state.estado === null) {
    clase = 'enlace-buscando';
    texto = 'Conectando con el servidor…';
  } else if (state.estado.conectado) {
    clase = 'enlace-on';
    texto = state.simulador ? 'Simulador activo' : `Hardware conectado en ${state.estado.puerto}`;
  } else {
    clase = 'enlace-buscando';
    texto = state.estado.mensajeEnlace || 'Buscando el hardware…';
  }

  $('enlace').className = `enlace ${clase}`;
  $('enlace-texto').textContent = texto;
}

export function renderBanner(state) {
  const info = infoBanner(state);
  const banner = $('banner');
  banner.hidden = info === null;
  if (info) {
    banner.className = `banner banner-${info.clase}`;
    $('banner-titulo').textContent = info.titulo;
    $('banner-detalle').textContent = info.detalle;
  }
  document.title = (info && info.clase === 'critico' ? '⚠ ' : '') + 'Dispensador inteligente';
}

export function renderInstrumentos(state) {
  const ok = estaConectado();
  const { estado } = state;

  // Semáforo
  const sem = ok ? SEMAFORO[estado.semaforo] || SEMAFORO.NORMAL : null;
  $('leds').dataset.activa = sem ? sem.luz : '';
  $('leds').classList.toggle('parpadea', ok && estado.bloqueo !== null);
  $('sem-etiqueta').textContent = sem ? sem.etiqueta : 'Sin datos';
  let detalle = sem ? sem.detalle : 'Esperando al hardware…';
  if (ok && estado.bloqueo === 'CABEZA') {
    detalle = 'Cabeza atorada: escotilla abierta y alarma sonora activa.';
  }
  $('sem-detalle').textContent = detalle;

  // Nivel de comida
  const nivel = ok ? estado.nivel : null;
  $('nivel-valor').textContent = nivel === null ? '—' : `${nivel} %`;
  $('nivel-valor').className = `valor${ok && estado.sinComida ? ' estado-aviso' : ''}`;
  $('tanque-nivel').style.height = `${nivel ?? 0}%`;

  // Servo del dispensador
  const apertura = ok ? estado.angulo : null;
  $('angulo-valor').textContent = apertura === null ? '—' : `${apertura} %`;
  $('arco-disp').style.strokeDashoffset = String(100 - (apertura ?? 0));
  ponerCuerno('cuerno-disp', state.aperturaAnimada ?? 0);

  // Servo de la escotilla
  const abierta = ok && estado.escotilla;
  $('escotilla-valor').textContent = ok ? (abierta ? 'Abierta' : 'Cerrada') : '—';
  $('escotilla-valor').className = `valor${abierta ? ' estado-critico' : ''}`;
  $('arco-esc').style.strokeDashoffset = abierta ? '0' : '100';
  ponerCuerno('cuerno-esc', abierta ? 100 : 0);
}

export function renderControles(state) {
  const ok = estaConectado();
  const { estado } = state;
  const bloqueado = ok && estado.bloqueo !== null;

  if (state.aperturaBorrador !== null && ok && state.aperturaBorrador === estado.angulo) {
    state.aperturaBorrador = null;
  }
  const apertura = state.aperturaBorrador ?? (ok ? estado.angulo : Number($('angulo').value));
  $('angulo').value = String(apertura);
  $('angulo-out').textContent = `${apertura} %`;
  $('angulo').disabled = !ok;
  $('btn-aplicar').disabled = !ok || state.aperturaBorrador === null;

  $('btn-dispensar').disabled = !ok || bloqueado || state.dispensando;

  const paro = $('sw-paro');
  paro.checked = ok && (bloqueado || estado.escotilla);
  paro.disabled = !ok || bloqueado || estado.escotilla;
  $('paro-detalle').textContent = paro.checked
    ? 'Activo. Pulsa «Reiniciar flujo» para volver a operar'
    : 'Abre la escotilla y bloquea el dispensador';

  $('btn-reiniciar').disabled = !ok;
  $('btn-reiniciar').classList.toggle('urgente', bloqueado);

  $('ctrl-ayuda').textContent = !ok
    ? 'Los controles se activan cuando el hardware está conectado.'
    : bloqueado
      ? 'El sistema está en paro. Para volver a operar pulsa «Reiniciar flujo».'
      : '';

  $('sim').hidden = !state.simulador;
  if (state.simulador && ok && estado.nivel !== null && document.activeElement !== $('sim-nivel')) {
    $('sim-nivel').value = String(estado.nivel);
    $('sim-nivel-out').textContent = `${estado.nivel} %`;
  }
}

function crearCelda(fila, texto) {
  const td = document.createElement('td');
  td.textContent = texto;
  fila.append(td);
}

export function renderBitacora(state, resaltarPrimera = false) {
  const cuerpo = $('bit-cuerpo');
  const fragmento = document.createDocumentFragment();

  for (const e of state.bitacora.slice(0, MAX_FILAS_BITACORA)) {
    const fila = document.createElement('tr');
    fila.className = `sev-${e.severidad}`;
    const d = new Date(e.ts);
    crearCelda(fila, d.toLocaleDateString('es-MX'));
    crearCelda(fila, d.toLocaleTimeString('es-MX', { hour12: false }));
    crearCelda(fila, ORIGEN[e.tipo] || e.tipo);

    const tdEvento = document.createElement('td');
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.textContent = e.evento;
    tdEvento.append(chip);
    fila.append(tdEvento);

    crearCelda(fila, e.descripcion);
    fragmento.append(fila);
  }

  cuerpo.replaceChildren(fragmento);
  if (resaltarPrimera && cuerpo.firstElementChild) {
    cuerpo.firstElementChild.classList.add('nueva');
  }
  $('bit-vacia').hidden = state.bitacora.length > 0;
}

export function render(state) {
  renderEnlace(state);
  renderBanner(state);
  renderInstrumentos(state);
  renderControles(state);
}

export function avisar(mensaje) {
  const caja = $('toast');
  caja.textContent = mensaje;
  caja.hidden = false;
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => {
    caja.hidden = true;
  }, 4500);
}
