export interface Palo {
  id: string;
  nombre: string;
  corto: string;
  loft: number;
  /** Rango de ángulo de ataque (°). */
  at: [number, number];
  /** Rango de ángulo de lanzamiento (°). */
  la: [number, number];
  /** Bola adelante del centro del stance (cm). */
  fwd: number;
  tee: boolean;
  /** Radio del swing: centro de hombros a cabeza del palo (cm). */
  R: number;
  /** Inclinación del plano del swing (°). */
  pl: number;
  /** Posición de bola de referencia. */
  bola: string;
}

export const PALOS: Palo[] = [
  { id: 'dr', nombre: 'Driver', corto: 'Dr', loft: 10.5, at: [2, 5], la: [12, 15], fwd: 10, tee: true, R: 165, pl: 50, bola: 'Talón de adelante' },
  { id: 'm3', nombre: 'Madera 3', corto: 'M3', loft: 15, at: [-2, 0], la: [11, 14], fwd: 7, tee: false, R: 160, pl: 53, bola: 'Casi al talón' },
  { id: 'm5', nombre: 'Madera 5', corto: 'M5', loft: 18, at: [-2, 0], la: [14, 18], fwd: 6, tee: false, R: 157, pl: 55, bola: 'Casi al talón' },
  { id: 'h4', nombre: 'Híbrido 4', corto: 'H4', loft: 22, at: [-3, -2], la: [14, 17], fwd: 5, tee: false, R: 154, pl: 57, bola: 'Adelante del centro' },
  { id: 'i5', nombre: 'Hierro 5', corto: '5i', loft: 24, at: [-4, -2], la: [12, 15], fwd: 4, tee: false, R: 152, pl: 58, bola: 'Adelante del centro' },
  { id: 'i6', nombre: 'Hierro 6', corto: '6i', loft: 27, at: [-5, -2], la: [14, 18], fwd: 3, tee: false, R: 150, pl: 59, bola: 'Un poco adelante' },
  { id: 'i7', nombre: 'Hierro 7', corto: '7i', loft: 31, at: [-5, -3], la: [16, 19], fwd: 2, tee: false, R: 148, pl: 60, bola: 'Un poco adelante' },
  { id: 'i8', nombre: 'Hierro 8', corto: '8i', loft: 35, at: [-5, -3], la: [18, 21], fwd: 1, tee: false, R: 146, pl: 61, bola: 'Centro' },
  { id: 'i9', nombre: 'Hierro 9', corto: '9i', loft: 39, at: [-6, -3], la: [20, 24], fwd: 0, tee: false, R: 144, pl: 62, bola: 'Centro' },
  { id: 'pw', nombre: 'PW', corto: 'PW', loft: 44, at: [-6, -3], la: [24, 28], fwd: 0, tee: false, R: 142, pl: 62, bola: 'Centro' },
  { id: 'gw', nombre: 'GW', corto: 'GW', loft: 50, at: [-6, -3], la: [27, 31], fwd: 0, tee: false, R: 141, pl: 63, bola: 'Centro' },
  { id: 'sw', nombre: 'SW', corto: 'SW', loft: 54, at: [-6, -3], la: [29, 33], fwd: 0, tee: false, R: 140, pl: 63, bola: 'Centro' },
  { id: 'lw', nombre: 'LW', corto: 'LW', loft: 58, at: [-6, -3], la: [30, 35], fwd: 0, tee: false, R: 139, pl: 63, bola: 'Centro' },
];

export const mitad = (r: [number, number]) => (r[0] + r[1]) / 2;

export const paloPorId = (id: string | undefined) => PALOS.find((p) => p.id === id) ?? PALOS[5];
