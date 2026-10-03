import type { Palo } from '../datos/palos';
import { TODO_BIEN } from '../datos/textos';
import { precisoAGolpe } from '../logica/aNumeros';
import { diagnosticoPreciso, fmtS, type Area } from '../logica/diagnostico';
import type { Golpe, TiroPreciso } from '../logica/tipos';
import { htmlHallazgos, htmlTabla } from './diagnosticoHtml';
import type { PrecisoCrudo } from './memoria';

const $ = <T extends HTMLElement>(s: string) => document.querySelector(s) as T;

const numero = (s: string): number | null => {
  const v = parseFloat(s.replace(',', '.').replace('−', '-'));
  return Number.isFinite(v) ? v : null;
};

const CAMPOS = ['linea', 'cara', 'ataque', 'lanz'] as const;
const LADOS = { linea: 'lineaLado', cara: 'caraLado', ataque: 'ataqueSigno' } as const;

function leer(c: PrecisoCrudo): TiroPreciso | null {
  const linea = numero(c.linea);
  const cara = numero(c.cara);
  const ataque = numero(c.ataque);
  if (linea === null || cara === null || ataque === null) return null;
  const lz = numero(c.lanz);
  return {
    linea: Math.abs(linea) * (c.lineaLado === 'I' ? -1 : 1),
    cara: Math.abs(cara) * (c.caraLado === 'I' ? -1 : 1),
    ataque: Math.abs(ataque) * (c.ataqueSigno === '-' ? -1 : 1),
    lanz: lz === null ? null : Math.abs(lz),
  };
}

export function montarPreciso(crudo: PrecisoCrudo, alCambiar: () => void) {
  for (const k of CAMPOS) {
    const inp = $<HTMLInputElement>(`#p-${k}`);
    inp.value = crudo[k];
    inp.addEventListener('input', () => {
      crudo[k] = inp.value;
      alCambiar();
    });
  }

  const pintarLados = () => {
    for (const [k, campo] of Object.entries(LADOS)) {
      document
        .querySelectorAll<HTMLButtonElement>(`[data-lado="${k}"] button`)
        .forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === crudo[campo])));
    }
  };
  for (const [k, campo] of Object.entries(LADOS)) {
    $(`[data-lado="${k}"]`).addEventListener('click', (ev) => {
      const b = (ev.target as HTMLElement).closest('button');
      if (!b) return;
      (crudo as unknown as Record<string, string>)[campo] = b.dataset.v!;
      pintarLados();
      alCambiar();
    });
  }
  pintarLados();

  return function pintar(p: Palo): { golpe: Golpe | null; primero: Area | null } {
    $('#ref-palo').innerHTML =
      `<b>${p.nombre}</b> · Bola: ${p.bola} · Ataque ${fmtS(p.at[0])} a ${fmtS(p.at[1])} · ` +
      `Lanzamiento ${p.la[0]}–${p.la[1]}°`;
    const caja = $('#diag-preciso');
    const d = leer(crudo);
    if (!d) {
      caja.innerHTML = '<p class="vacio">Escribe línea, cara y ataque tal como salen en el R10.</p>';
      return { golpe: null, primero: null };
    }
    const { filas, hallazgos } = diagnosticoPreciso(p, d);
    caja.innerHTML = htmlTabla(filas) + (hallazgos.length ? htmlHallazgos(hallazgos) : `<p class="bien">${TODO_BIEN}</p>`);
    return { golpe: precisoAGolpe(d), primero: hallazgos[0]?.area ?? null };
  };
}
