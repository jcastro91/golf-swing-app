import './style.css';
import { PALOS, paloPorId } from './datos/palos';
import { golpeIdeal } from './logica/aNumeros';
import { Visor, type Vista } from './tres/escena';
import { montarCampo } from './ui/campo';
import { cargar, guardar } from './ui/memoria';
import { montarPreciso } from './ui/preciso';

const $ = <T extends HTMLElement>(s: string) => document.querySelector(s) as T;
const estado = cargar();

const visor = new Visor($<HTMLCanvasElement>('#lienzo'));
let firmaVisor = '';

function actualizar(inmediato = true) {
  guardar(estado);
  const p = paloPorId(estado.palo);
  const golpe = estado.pestana === 'campo' ? pintarCampo(p) : pintarPreciso(p);
  // El visor solo se reinicia si cambió lo que se anima.
  const firma = JSON.stringify([p.id, golpe]);
  if (firma === firmaVisor) return;
  firmaVisor = firma;
  clearTimeout(espera);
  const mostrar = () => visor.mostrar(p, golpe, golpeIdeal(p));
  if (inmediato) mostrar();
  else espera = window.setTimeout(mostrar, 450);
}
let espera = 0;

const pintarCampo = montarCampo(estado.rapido, () => actualizar());
const pintarPreciso = montarPreciso(estado.preciso, () => actualizar(false));

// Palos
const palos = $('#palos');
palos.innerHTML = PALOS.map(
  (p) => `<button type="button" role="radio" data-palo="${p.id}" aria-label="${p.nombre}">${p.corto}</button>`,
).join('');
const pintarPalos = () => {
  palos.querySelectorAll<HTMLButtonElement>('button').forEach((b) => {
    b.setAttribute('aria-checked', String(b.dataset.palo === estado.palo));
  });
};
palos.addEventListener('click', (ev) => {
  const b = (ev.target as HTMLElement).closest<HTMLButtonElement>('button');
  if (!b) return;
  estado.palo = b.dataset.palo!;
  pintarPalos();
  actualizar();
});
pintarPalos();
palos.querySelector('[aria-checked="true"]')?.scrollIntoView({ inline: 'center', block: 'nearest' });

// Pestañas
const pintarPestanas = () => {
  document.querySelectorAll<HTMLButtonElement>('[data-pestana]').forEach((b) => {
    b.setAttribute('aria-selected', String(b.dataset.pestana === estado.pestana));
  });
  $('#campo').hidden = estado.pestana !== 'campo';
  $('#preciso').hidden = estado.pestana !== 'preciso';
  $('#nuevo').hidden = estado.pestana !== 'campo';
};
document.querySelectorAll<HTMLButtonElement>('[data-pestana]').forEach((b) =>
  b.addEventListener('click', () => {
    estado.pestana = b.dataset.pestana as 'campo' | 'preciso';
    pintarPestanas();
    actualizar();
  }),
);
pintarPestanas();

// Controles del visor
const pintarVista = () =>
  document.querySelectorAll<HTMLButtonElement>('[data-vista]').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.vista === estado.vista));
  });
document.querySelectorAll<HTMLButtonElement>('[data-vista]').forEach((b) =>
  b.addEventListener('click', () => {
    estado.vista = b.dataset.vista as Vista;
    visor.setVista(estado.vista);
    pintarVista();
    guardar(estado);
  }),
);
visor.setVista(estado.vista);
pintarVista();

$('#repetir').addEventListener('click', () => visor.repetir());
const lento = $('#lento');
lento.addEventListener('click', () => {
  const on = lento.getAttribute('aria-pressed') !== 'true';
  lento.setAttribute('aria-pressed', String(on));
  visor.setLento(on);
  visor.repetir();
});
const tiempo = $<HTMLInputElement>('#tiempo');
tiempo.addEventListener('input', () => visor.irA(+tiempo.value / 1000));
visor.onTiempo = (t) => (tiempo.value = String(Math.round(t * 1000)));

// Pantalla encendida (Wake Lock), si el navegador lo permite.
let candado: WakeLockSentinel | null = null;
async function pantallaEncendida() {
  const aviso = $('#nota-pantalla');
  if (!('wakeLock' in navigator)) {
    aviso.hidden = false;
    return;
  }
  try {
    candado = await navigator.wakeLock.request('screen');
    aviso.hidden = true;
  } catch {
    aviso.hidden = false;
  }
}
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && (!candado || candado.released)) pantallaEncendida();
});
// Algunos navegadores solo lo conceden después de un toque.
document.addEventListener('pointerdown', () => (!candado || candado.released) && pantallaEncendida(), { passive: true });
pantallaEncendida();

actualizar();
