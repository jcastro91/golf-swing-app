import type { Palo } from '../datos/palos';
import { T, type Texto } from '../datos/textos';
import type { Lado, Signo, TiroPreciso } from './tipos';

export type Area = 'ataque' | 'caraLinea' | 'linea' | 'lanz';

export const TITULO: Record<Area, string> = {
  ataque: 'Ángulo de ataque',
  caraLinea: 'Cara a línea',
  linea: 'Línea cabeza del palo',
  lanz: 'Ángulo de lanzamiento',
};

export interface Hallazgo {
  area: Area;
  texto: Texto;
}

/** Cara a línea y línea están bien entre 3 I y 3 D. */
export const UMBRAL = 3;
export const lado = (v: number): Lado => (v < -UMBRAL ? 'I' : v > UMBRAL ? 'D' : 'OK');

function porLado(area: 'caraLinea' | 'linea', l: Lado): Hallazgo | null {
  if (l === 'OK') return null;
  if (area === 'caraLinea') return { area, texto: l === 'D' ? T.caraD : T.caraI };
  return { area, texto: l === 'I' ? T.lineaI : T.lineaD };
}

/** Modo campo: el ataque se juzga solo por el signo. */
export function diagnosticoRapido(p: Palo, t: { ataque: Signo; caraLinea: Lado; linea: Lado }): Hallazgo[] {
  const h: Hallazgo[] = [];
  if (p.tee && t.ataque === '-') h.push({ area: 'ataque', texto: T.ataqueDriverBajando });
  if (!p.tee && t.ataque === '+') h.push({ area: 'ataque', texto: T.ataqueAtras });
  const c = porLado('caraLinea', t.caraLinea);
  if (c) h.push(c);
  const l = porLado('linea', t.linea);
  if (l) h.push(l);
  return h;
}

export interface Fila {
  area: Area;
  valor: string;
  rango: string;
  ok: boolean;
}

export const fmtLR = (v: number) => (Math.abs(v) < 0.05 ? '0' : `${Math.abs(v).toFixed(1)} ${v < 0 ? 'I' : 'D'}`);
export const fmtS = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(1)}`;

/** Modo preciso: el ataque se juzga con el rango del palo. */
export function diagnosticoPreciso(p: Palo, d: TiroPreciso): { filas: Fila[]; hallazgos: Hallazgo[] } {
  const filas: Fila[] = [];
  const hallazgos: Hallazgo[] = [];
  const [amin, amax] = p.at;

  const ataqueOk = d.ataque >= amin && d.ataque <= amax;
  filas.push({ area: 'ataque', valor: fmtS(d.ataque), rango: `${fmtS(amin)} a ${fmtS(amax)}`, ok: ataqueOk });
  if (d.ataque > amax) hallazgos.push({ area: 'ataque', texto: p.tee ? T.ataqueDriverSubiendo : T.ataqueAtras });
  if (d.ataque < amin) hallazgos.push({ area: 'ataque', texto: p.tee ? T.ataqueDriverBajando : T.ataqueVertical });

  const f2p = d.cara - d.linea;
  filas.push({ area: 'caraLinea', valor: fmtLR(f2p), rango: '3 I a 3 D', ok: lado(f2p) === 'OK' });
  const c = porLado('caraLinea', lado(f2p));
  if (c) hallazgos.push(c);

  filas.push({ area: 'linea', valor: fmtLR(d.linea), rango: '3 I a 3 D', ok: lado(d.linea) === 'OK' });
  const l = porLado('linea', lado(d.linea));
  if (l) hallazgos.push(l);

  if (d.lanz !== null) {
    const ok = d.lanz >= p.la[0] && d.lanz <= p.la[1];
    filas.push({ area: 'lanz', valor: `${d.lanz.toFixed(1)}°`, rango: `${p.la[0]}–${p.la[1]}°`, ok });
    if (!ok) hallazgos.push({ area: 'lanz', texto: ataqueOk ? T.lanzCara : T.lanzAtaque });
  }

  return { filas, hallazgos };
}
