import { mitad, type Palo } from '../datos/palos';
import type { Golpe, Lado, Signo, TiroPreciso } from './tipos';

/** Grados representativos para un I/D del modo campo. */
const GRADOS_LADO = 6;
const g = (l: Lado) => (l === 'I' ? -GRADOS_LADO : l === 'D' ? GRADOS_LADO : 0);

export function rapidoAGolpe(p: Palo, t: { ataque: Signo; caraLinea: Lado; linea: Lado }): Golpe {
  const ataqueBien = p.tee ? t.ataque === '+' : t.ataque === '-';
  const ataque = ataqueBien ? mitad(p.at) : p.tee ? -2 : 3;
  const linea = g(t.linea);
  return { linea, cara: linea + g(t.caraLinea), ataque, lanz: null };
}

export const golpeIdeal = (p: Palo): Golpe => ({ linea: 0, cara: 0, ataque: mitad(p.at), lanz: null });

export const precisoAGolpe = (d: TiroPreciso): Golpe => ({ ...d });
