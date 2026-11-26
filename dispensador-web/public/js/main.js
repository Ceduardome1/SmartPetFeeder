/**
 * Controlador principal de la interfaz web (punto de entrada ES Module).
 * Conecta las acciones del usuario con la API y actualiza el estado y la vista.
 */

import { state, aplicarSnapshot, aplicarEventoHardware } from './state.js';
import { conectarEventos, enviarComando, enviarSimulacion } from './api.js';
import { $, render, renderControles, renderInstrumentos, renderBitacora, avisar } from './view.js';

const EVENTOS_FIN_DISPENSACION = new Set([
  'DISPENSACION_EXITOSA',
  'SIN_COMIDA',
  'PARO_EMERGENCIA',
  'ALERTA_CABEZA_ATORADA',
  'FLUJO_REINICIADO',
  'ENLACE_PERDIDO',
]);

let temporizadorAnimacion = null;
let temporizadorDispensando = null;

function finalizarDispensacion() {
  clearTimeout(temporizadorDispensando);
  temporizadorDispensando = null;
  if (state.dispensando) {
    state.dispensando = false;
  }
}

function animarDispensacion() {
  if (!state.estado) return;
  state.aperturaAnimada = state.estado.angulo;
  renderInstrumentos(state);
  clearTimeout(temporizadorAnimacion);
  temporizadorAnimacion = setTimeout(() => {
    state.aperturaAnimada = null;
    renderInstrumentos(state);
  }, 900);
}

async function ejecutarComando(comando, valor) {
  const res = await enviarComando(comando, valor);
  if (!res.ok) {
    avisar(res.error);
    render(state);
    return false;
  }
  return true;
}

async function ejecutarSimulacion(accion, valor) {
  const res = await enviarSimulacion(accion, valor);
  if (!res.ok) avisar(res.error);
}

// ------------------------------------------------------------------ eventos del DOM

$('angulo').addEventListener('input', (e) => {
  state.aperturaBorrador = Number(e.target.value);
  renderControles(state);
});

$('btn-aplicar').addEventListener('click', () => {
  if (state.aperturaBorrador !== null) {
    ejecutarComando('ANGULO', state.aperturaBorrador);
  }
});

$('btn-dispensar').addEventListener('click', async () => {
  state.dispensando = true;
  renderControles(state);

  const ok = await ejecutarComando('DISPENSAR');
  if (!ok) {
    finalizarDispensacion();
    renderControles(state);
    return;
  }

  // Timeout de seguridad ligeramente mayor al ciclo real del MCU (~3.5 s)
  clearTimeout(temporizadorDispensando);
  temporizadorDispensando = setTimeout(() => {
    finalizarDispensacion();
    renderControles(state);
  }, 4500);
});

$('sw-paro').addEventListener('change', (e) => {
  if (e.target.checked) ejecutarComando('PARO');
});

$('btn-reiniciar').addEventListener('click', () => ejecutarComando('REINICIAR'));

// ------------------------------------------------------------------ simulador (solo modo demo)

document.querySelectorAll('[data-sim]').forEach((boton) => {
  boton.addEventListener('click', () => ejecutarSimulacion(boton.dataset.sim));
});

let nivelPendiente = null;
let temporizadorNivel = null;
$('sim-nivel').addEventListener('input', (e) => {
  $('sim-nivel-out').textContent = `${e.target.value} %`;
  nivelPendiente = Number(e.target.value);
  if (temporizadorNivel) return;
  temporizadorNivel = setTimeout(() => {
    temporizadorNivel = null;
    ejecutarSimulacion('nivel', nivelPendiente);
  }, 120);
});

// ------------------------------------------------------------------ arranque

render(state);
renderBitacora(state);

conectarEventos({
  onSnapshot(datos) {
    aplicarSnapshot(datos);
    renderBitacora(state);
    render(state);
  },
  onEventoHardware(msg) {
    if (EVENTOS_FIN_DISPENSACION.has(msg.evento)) {
      finalizarDispensacion();
    }
    aplicarEventoHardware(msg);
    if (msg.entrada) renderBitacora(state, true);
    render(state);
    if (msg.evento === 'DISPENSACION_EXITOSA') animarDispensacion();
  },
  onError() {
    state.servidor = 'caido';
    finalizarDispensacion();
    render(state);
  },
});
