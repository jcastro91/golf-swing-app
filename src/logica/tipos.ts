export type Lado = 'I' | 'OK' | 'D';
export type Signo = '+' | '-';

/** Lo que se marca con botones en el campo. */
export interface TiroRapido {
  ataque: Signo | null;
  caraLinea: Lado | null;
  linea: Lado | null;
}

/** Números exactos del R10. I es negativo, D positivo. */
export interface TiroPreciso {
  linea: number;
  cara: number;
  ataque: number;
  lanz: number | null;
}

/** Lo que necesita la animación (grados). */
export interface Golpe {
  linea: number;
  cara: number;
  ataque: number;
  lanz: number | null;
}

export const rapidoCompleto = (t: TiroRapido): t is { ataque: Signo; caraLinea: Lado; linea: Lado } =>
  t.ataque !== null && t.caraLinea !== null && t.linea !== null;
