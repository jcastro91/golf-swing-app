import type { Palo } from '../datos/palos';
import { TODO_BIEN } from '../datos/textos';
import { rapidoAGolpe } from '../logica/aNumeros';
import { diagnosticoRapido } from '../logica/diagnostico';
import { rapidoCompleto, type Golpe, type TiroRapido } from '../logica/tipos';
import { htmlHallazgos } from './diagnosticoHtml';

const $ = <T extends HTMLElement>(s: string) => document.querySelector(s) as T;

export function montarCampo(rapido: TiroRapido, alCambiar: () => void) {
  const grupos = document.querySelectorAll<HTMLElement>('#campo [data-campo]');

  const pintarBotones = () => {
    grupos.forEach((g) => {
      const v = rapido[g.dataset.campo as keyof TiroRapido];
      g.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === v)));
    });
  };

  grupos.forEach((g) =>
    g.addEventListener('click', (ev) => {
      const b = (ev.target as HTMLElement).closest('button');
      if (!b) return;
      const campo = g.dataset.campo as keyof TiroRapido;
      (rapido as unknown as Record<string, string | null>)[campo] = b.dataset.v!;
      pintarBotones();
      alCambiar();
    }),
  );

  $('#nuevo').addEventListener('click', () => {
    rapido.ataque = rapido.caraLinea = rapido.linea = null;
    pintarBotones();
    alCambiar();
  });

  pintarBotones();

  /** Pinta el diagnóstico y devuelve el golpe a animar (null si faltan datos). */
  return function pintar(p: Palo): Golpe | null {
    const caja = $('#diag-campo');
    if (!rapidoCompleto(rapido)) {
      caja.innerHTML = '<p class="vacio">Marca los tres datos del tiro.</p>';
      return null;
    }
    const h = diagnosticoRapido(p, rapido);
    caja.innerHTML = h.length ? htmlHallazgos(h) : `<p class="bien">${TODO_BIEN}</p>`;
    return rapidoAGolpe(p, rapido);
  };
}
