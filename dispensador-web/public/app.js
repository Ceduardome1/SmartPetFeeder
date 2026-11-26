'use strict';

/**
 * Cliente del panel. No consulta al servidor cada cierto tiempo (sin polling):
 * recibe los eventos del hardware por Server-Sent Events (canal "evento_hardware")
 * y envía los comandos del usuario con POST /api/comando.
 */

const $ = (id) => document.getElementById(id);
const MAX_FILAS = 200;

let servidor = 'conectando'; // 'conectando' | 'ok' | 'caido'
let estado = null; // último estado calculado por el servidor
let bitacora = []; // la más reciente primero
let simulador = false;

let aperturaBorrador = null; // valor del slider que aún no se aplica
let dispensando = false; // evita pulsaciones repetidas del botón
let aperturaAnimada = null; // posición temporal del servo durante una dispensación
let temporizadorAnimacion = null;
let temporizadorAviso = null;

const ORIGEN = { hardware: 'Hardware', web: 'Web', sistema: 'Sistema' };

const SEMAFORO = {
  NORMAL: { luz: 'verde', etiqueta: 'Normal', detalle: 'Operativo y listo para dispensar.' },
  SIN_COMIDA: { luz: 'amarilla', etiqueta: 'Sin comida', detalle: 'El depósito está en el mínimo. Rellénalo para poder dispensar.' },
  CRITICO: { luz: 'roja', etiqueta: 'Crítico', detalle: 'Paro de emergencia activo. Dispensaciones bloqueadas.' },
};

const conectado = () => servidor === 'ok' && estado !== null && estado.conectado;

// ------------------------------------------------------------------ dibujo

function render() {
  renderEnlace();
  renderBanner();
  renderInstrumentos();
  renderControles();
}

function renderEnlace() {
  let clase;
  let texto;
  if (servidor === 'caido') {
    clase = 'enlace-off';
    texto = 'Sin conexión con el servidor web. Reintentando…';
  } else if (servidor === 'conectando' || estado === null) {
    clase = 'enlace-buscando';
    texto = 'Conectando con el servidor…';
  } else if (estado.conectado) {
    clase = 'enlace-on';
    texto = simulador ? 'Simulador activo' : `Hardware conectado en ${estado.puerto}`;
  } else {
    clase = 'enlace-buscando';
    texto = estado.mensajeEnlace || 'Buscando el hardware…';
  }
  $('enlace').className = `enlace ${clase}`;
  $('enlace-texto').textContent = texto;
}

function infoBanner() {
  if (!conectado()) return null;
  if (estado.bloqueo === 'CABEZA') {
    return {
      clase: 'critico',
      titulo: 'Alerta crítica: cabeza atorada',
      detalle: 'Escotilla abierta al 100 %, dispensador cerrado y alarma sonora activa. Libera a la mascota y pulsa «Reiniciar flujo».',
    };
  }
  if (estado.bloqueo === 'PARO') {
    return {
      clase: 'critico',
      titulo: 'Paro de emergencia',
      detalle: 'Escotilla abierta y dispensador cerrado y bloqueado. Pulsa «Reiniciar flujo» para volver a operar.',
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

function renderBanner() {
  const info = infoBanner();
  const banner = $('banner');
  banner.hidden = info === null;
  if (info) {
    banner.className = `banner banner-${info.clase}`;
    $('banner-titulo').textContent = info.titulo;
    $('banner-detalle').textContent = info.detalle;
  }
  document.title = (info && info.clase === 'critico' ? '⚠ ' : '') + 'Dispensador inteligente';
}

function ponerCuerno(id, porcentaje) {
  $(id).style.transform = `rotate(${porcentaje * 1.8}deg)`; // 0 % apunta a la izquierda, 100 % a la derecha
}

function renderInstrumentos() {
  const ok = conectado();

  // Semáforo
  const sem = ok ? SEMAFORO[estado.semaforo] || SEMAFORO.NORMAL : null;
  $('leds').dataset.activa = sem ? sem.luz : '';
  $('leds').classList.toggle('parpadea', ok && estado.bloqueo !== null);
  $('sem-etiqueta').textContent = sem ? sem.etiqueta : 'Sin datos';
  let detalle = sem ? sem.detalle : 'Esperando al hardware…';
  if (ok && estado.bloqueo === 'CABEZA') detalle = 'Cabeza atorada: escotilla abierta y alarma sonora activa.';
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
  ponerCuerno('cuerno-disp', aperturaAnimada ?? 0);

  // Servo de la escotilla
  const abierta = ok && estado.escotilla;
  $('escotilla-valor').textContent = ok ? (abierta ? 'Abierta' : 'Cerrada') : '—';
  $('escotilla-valor').className = `valor${abierta ? ' estado-critico' : ''}`;
  $('arco-esc').style.strokeDashoffset = abierta ? '0' : '100';
  ponerCuerno('cuerno-esc', abierta ? 100 : 0);
}

function renderControles() {
  const ok = conectado();
  const bloqueado = ok && estado.bloqueo !== null;

  if (aperturaBorrador !== null && ok && aperturaBorrador === estado.angulo) aperturaBorrador = null;
  const apertura = aperturaBorrador ?? (ok ? estado.angulo : Number($('angulo').value));
  $('angulo').value = String(apertura);
  $('angulo-out').textContent = `${apertura} %`;
  $('angulo').disabled = !ok;
  $('btn-aplicar').disabled = !ok || aperturaBorrador === null;

  $('btn-dispensar').disabled = !ok || bloqueado || dispensando;

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

  $('sim').hidden = !simulador;
  if (simulador && ok && estado.nivel !== null && document.activeElement !== $('sim-nivel')) {
    $('sim-nivel').value = String(estado.nivel);
    $('sim-nivel-out').textContent = `${estado.nivel} %`;
  }
}

function celda(fila, texto) {
  const td = document.createElement('td');
  td.textContent = texto;
  fila.append(td);
}

function renderBitacora(resaltarPrimera = false) {
  const cuerpo = $('bit-cuerpo');
  const fragmento = document.createDocumentFragment();
  for (const e of bitacora.slice(0, MAX_FILAS)) {
    const fila = document.createElement('tr');
    fila.className = `sev-${e.severidad}`;
    const d = new Date(e.ts);
    celda(fila, d.toLocaleDateString('es-MX'));
    celda(fila, d.toLocaleTimeString('es-MX', { hour12: false }));
    celda(fila, ORIGEN[e.tipo] || e.tipo);
    const tdEvento = document.createElement('td');
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.textContent = e.evento;
    tdEvento.append(chip);
    fila.append(tdEvento);
    celda(fila, e.descripcion);
    fragmento.append(fila);
  }
  cuerpo.replaceChildren(fragmento);
  if (resaltarPrimera && cuerpo.firstElementChild) cuerpo.firstElementChild.classList.add('nueva');
  $('bit-vacia').hidden = bitacora.length > 0;
}

function avisar(mensaje) {
  const caja = $('toast');
  caja.textContent = mensaje;
  caja.hidden = false;
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => { caja.hidden = true; }, 4500);
}

function animarDispensacion() {
  if (!estado) return;
  aperturaAnimada = estado.angulo; // el servo abre al ángulo configurado y vuelve a cerrar
  renderInstrumentos();
  clearTimeout(temporizadorAnimacion);
  temporizadorAnimacion = setTimeout(() => {
    aperturaAnimada = null;
    renderInstrumentos();
  }, 900);
}

// ------------------------------------------------------------------ eventos del servidor (SSE)

function conectarEventos() {
  const fuente = new EventSource('/api/eventos');

  fuente.addEventListener('snapshot', (ev) => {
    const datos = JSON.parse(ev.data);
    estado = datos.estado;
    bitacora = datos.bitacora;
    simulador = datos.simulador;
    servidor = 'ok';
    renderBitacora();
    render();
  });

  fuente.addEventListener('evento_hardware', (ev) => {
    const msg = JSON.parse(ev.data);
    estado = msg.estado;
    servidor = 'ok';
    if (msg.entrada) {
      bitacora.unshift(msg.entrada);
      if (bitacora.length > 500) bitacora.pop();
      renderBitacora(true);
    }
    render();
    if (msg.evento === 'DISPENSACION_EXITOSA') animarDispensacion();
  });

  fuente.onerror = () => {
    servidor = 'caido'; // EventSource reconecta solo y el servidor reenvía la instantánea
    render();
  };
}

// ------------------------------------------------------------------ comandos

async function enviar(comando, valor) {
  try {
    const r = await fetch('/api/comando', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comando, valor }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) {
      avisar(j.error || `El servidor respondió con error ${r.status}.`);
      render();
      return false;
    }
    return true;
  } catch {
    avisar('No se pudo contactar con el servidor web.');
    render();
    return false;
  }
}

$('angulo').addEventListener('input', (e) => {
  aperturaBorrador = Number(e.target.value);
  renderControles();
});

$('btn-aplicar').addEventListener('click', () => {
  if (aperturaBorrador !== null) enviar('ANGULO', aperturaBorrador);
});

$('btn-dispensar').addEventListener('click', async () => {
  dispensando = true;
  renderControles();
  await enviar('DISPENSAR');
  setTimeout(() => {
    dispensando = false;
    renderControles();
  }, 800);
});

$('sw-paro').addEventListener('change', (e) => {
  if (e.target.checked) enviar('PARO');
});

$('btn-reiniciar').addEventListener('click', () => enviar('REINICIAR'));

// ------------------------------------------------------------------ simulador (solo modo demo)

async function simular(accion, valor) {
  try {
    const r = await fetch('/api/sim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion, valor }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      avisar(j.error || 'El simulador rechazó la acción.');
    }
  } catch {
    avisar('No se pudo contactar con el servidor web.');
  }
}

document.querySelectorAll('[data-sim]').forEach((boton) => {
  boton.addEventListener('click', () => simular(boton.dataset.sim));
});

let nivelPendiente = null;
let temporizadorNivel = null;
$('sim-nivel').addEventListener('input', (e) => {
  $('sim-nivel-out').textContent = `${e.target.value} %`;
  nivelPendiente = Number(e.target.value);
  if (temporizadorNivel) return; // como máximo una petición cada 120 ms mientras se arrastra
  temporizadorNivel = setTimeout(() => {
    temporizadorNivel = null;
    simular('nivel', nivelPendiente);
  }, 120);
});

// ------------------------------------------------------------------ inicio

render();
renderBitacora();
conectarEventos();
