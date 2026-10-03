import { Vector3 } from 'three';
import { mitad, type Palo } from '../datos/palos';
import type { Golpe } from '../logica/tipos';

/*
 * Ejes en cm. x: hacia el objetivo, y: arriba, z: del golfista hacia la bola (+z es la derecha
 * vista desde atrás). La bola está en x=0, z=0. Golfista diestro, parado en z negativa.
 *
 * El palo sigue el modelo del prototipo: un arco alrededor del centro de los hombros C,
 * con el punto más bajo desplazado según el ataque y el plano rotado según la línea en la bajada.
 * Las manos giran en un plano más vertical que el del palo, para que los brazos cuelguen de los
 * hombros en el setup. El cuerpo se acomoda a ese arco y brazos y piernas se resuelven con IK.
 */

/**
 * Cuánto se exagera cada efecto para que se note en el celular.
 * Cara y línea comparten factor para que la cara a línea dibujada conserve el signo de la real.
 */
export const EXAG = { ataque: 3, caraLinea: 2, curva: 1.5 };


export const T_TOPE = 0.48;
export const T_IMPACTO = 0.7;

/** [t, ángulo de brazos a, quiebre de muñecas b] */
const KF_BRAZOS = [
  [0, 0, 0],
  [0.1, 0, 0],
  [0.48, 95, 115],
  [0.6, 45, 80],
  [0.67, 8, 6],
  [0.7, 0, 0],
  [0.74, -10, -6],
  [0.85, -70, -50],
  [1, -105, -80],
];

/** [t, giro de hombros, giro de cadera]; positivo es hacia atrás. */
const KF_GIRO = [
  [0, 0, 0],
  [0.1, 0, 0],
  [0.48, 90, 45],
  [0.6, 55, 20],
  [0.7, -20, -40],
  [0.85, -80, -70],
  [1, -105, -90],
];

const rad = (d: number) => (d * Math.PI) / 180;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
/** Ángulo de cara o línea tal como se dibuja. El tope es el mismo para las dos (monótono, no cambia el signo). */
export const dibujado = (v: number) => clamp(v * EXAG.caraLinea, -40, 40);
const suave = (u: number) => u * u * (3 - 2 * u);
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;

function tramo(tabla: number[][], t: number): number[] {
  for (let i = 1; i < tabla.length; i++) {
    if (t <= tabla[i][0]) {
      const p = tabla[i - 1];
      const q = tabla[i];
      const u = suave((t - p[0]) / (q[0] - p[0]));
      return p.slice(1).map((v, k) => lerp(v, q[k + 1], u));
    }
  }
  return tabla[tabla.length - 1].slice(1);
}

const X = new Vector3(1, 0, 0);
const Y = new Vector3(0, 1, 0);

export const RADIO_BOLA = 2.13;
const RH = 60; // centro de hombros a manos
/** Postura: columna inclinada 35° desde la cadera, rodillas flexionadas ~20°. */
const TORSO = 58;
const INCL_COLUMNA = rad(35);
const MUSLO = 44;
const PIERNA = 44;
const FLEX_RODILLA = rad(20);
export const BRAZO = 29;
export const ANTEBRAZO = 33;
export const LARGO_PIERNA = MUSLO;

/** Constantes de un golpe que no cambian durante la animación. */
export interface Geo {
  p: Palo;
  g: Golpe;
  pa: number;
  R: number;
  Lc: number;
  u: Vector3;
  uh: Vector3;
  cr: Vector3;
  ballY: number;
  lowX: number;
  ylow: number;
  cy: number;
  cz: number;
  cxSetup: number;
  rhoF: number;
  x0: number;
  fz: number;
}

export function crearGeo(p: Palo, g: Golpe): Geo {
  const pa = rad(p.pl);
  const ph = rad(Math.min(80, p.pl + 15)); // plano de las manos
  const Lc = p.R - 52; // largo efectivo del palo
  const R = RH + Lc;
  const ylow = p.tee ? 1.5 : g.ataque < 0 ? -1 : 0;
  const cy = ylow + RH * Math.sin(ph) + Lc * Math.sin(pa);
  const cz = -(RH * Math.cos(ph) + Lc * Math.cos(pa));
  // Pies fijos: debajo de la cadera, a la distancia que deja las rodillas flexionadas ~20°.
  const caderaY = cy - TORSO * Math.cos(INCL_COLUMNA);
  const caderaZ = cz - TORSO * Math.sin(INCL_COLUMNA);
  const dPierna = (MUSLO + PIERNA) * Math.cos(FLEX_RODILLA / 2);
  const vPierna = caderaY - 8;
  const sinAt = (a: number) => Math.sin(rad(clamp(a, -12, 12)));
  return {
    p,
    g,
    pa,
    R,
    Lc,
    u: new Vector3(0, -Math.sin(pa), Math.cos(pa)),
    uh: new Vector3(0, -Math.sin(ph), Math.cos(ph)),
    cr: new Vector3(0, Math.cos(pa), Math.sin(pa)),
    ballY: p.tee ? 4.6 : RADIO_BOLA,
    lowX: -EXAG.ataque * R * sinAt(g.ataque),
    ylow,
    cy,
    cz,
    // En el setup las dos figuras empiezan igual, con la postura de un golpe bien pegado.
    cxSetup: -EXAG.ataque * R * sinAt(mitad(p.at)) * 0.4,
    rhoF: Math.asin(clamp(Math.sin(rad(dibujado(g.linea))) / Math.sin(pa), -1, 1)),
    x0: -p.fwd,
    fz: caderaZ + Math.sqrt(Math.max(0, dPierna * dPierna - vPierna * vPierna)),
  };
}

export interface Pose {
  C: Vector3;
  cadera: Vector3;
  cabeza: Vector3;
  /** Base del pecho: lateral (hacia el hombro de adelante), columna, frente. */
  l: Vector3;
  s: Vector3;
  f: Vector3;
  /** Base de la cabeza (no gira con los hombros). */
  lc: Vector3;
  fc: Vector3;
  lp: Vector3;
  hombroA: Vector3;
  hombroT: Vector3;
  codoA: Vector3;
  codoT: Vector3;
  manoA: Vector3;
  manoT: Vector3;
  caderaA: Vector3;
  caderaT: Vector3;
  rodillaA: Vector3;
  rodillaT: Vector3;
  tobilloA: Vector3;
  tobilloT: Vector3;
  /** Talón de atrás levantado en el final (0 a 1). */
  talon: number;
  /** Cabeza del palo: punto de contacto y su base (punta, arriba, cara). */
  K: Vector3;
  punta: Vector3;
  arriba: Vector3;
  cara: Vector3;
}

/** IK analítica de dos huesos. Si no alcanza, estira un poco el brazo o la pierna. */
export function ik(a: Vector3, objetivo: Vector3, l1: number, l2: number, polo: Vector3): Vector3 {
  const d = objetivo.clone().sub(a);
  let dist = d.length();
  const n = d.divideScalar(dist || 1);
  if (dist > l1 + l2) {
    const k = dist / (l1 + l2);
    l1 *= k;
    l2 *= k;
  }
  dist = Math.max(dist, Math.abs(l1 - l2) + 0.01);
  const x = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist);
  const h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
  const pp = polo.clone().addScaledVector(n, -polo.dot(n));
  if (pp.lengthSq() < 1e-6) pp.copy(Y);
  pp.normalize();
  return a.clone().addScaledVector(n, x).addScaledVector(pp, h);
}

/** Centro de hombros en x: carga atrás, va hacia el objetivo en la bajada, queda según el ataque. */
function centroX(geo: Geo, t: number): number {
  const atras = geo.cxSetup - 4;
  if (t < 0.1) return geo.cxSetup;
  if (t < T_TOPE) return lerp(geo.cxSetup, atras, suave((t - 0.1) / (T_TOPE - 0.1)));
  if (t < 0.68) return lerp(atras, geo.lowX, suave((t - T_TOPE) / (0.68 - T_TOPE)));
  if (t < 0.78) return geo.lowX;
  return geo.lowX + 8 * suave((t - 0.78) / 0.22);
}

/** Posición de la cabeza del palo (y de las manos) en el instante t. */
export function palo(geo: Geo, t: number) {
  const cx = centroX(geo, t);
  const C = new Vector3(cx, geo.cy, geo.cz);
  const k = t < T_TOPE ? 0 : Math.min(1, (t - T_TOPE) / 0.12);
  const rho = geo.rhoF * k;
  const e = X.clone().multiplyScalar(Math.cos(rho)).addScaledVector(geo.cr, Math.sin(rho));
  let [a, b] = tramo(KF_BRAZOS, t);
  // Ajuste para que en el setup y el impacto la cabeza quede justo en la bola (x=0).
  const w = t <= 0.1 ? 1 : t < T_TOPE ? 1 - (t - 0.1) / 0.38 : t < T_IMPACTO ? (t - T_TOPE) / 0.22 : Math.max(0, 1 - (t - T_IMPACTO) / 0.1);
  a += (Math.asin(clamp(cx / (geo.R * Math.cos(rho)), -1, 1)) * 180) / Math.PI * w;
  const ar = rad(a);
  const abr = rad(a + b);
  const H = C.clone().addScaledVector(geo.uh, RH * Math.cos(ar)).addScaledVector(e, -RH * Math.sin(ar));
  const K = H.clone().addScaledVector(geo.u, geo.Lc * Math.cos(abr)).addScaledVector(e, -geo.Lc * Math.sin(abr));
  // Dirección en la que se mueve la cabeza en la bajada: hacia donde mira la cara.
  const tan = geo.uh
    .clone()
    .multiplyScalar(RH * Math.sin(ar))
    .addScaledVector(geo.u, geo.Lc * Math.sin(abr))
    .addScaledVector(e, RH * Math.cos(ar) + geo.Lc * Math.cos(abr))
    .normalize();
  return { C, H, K, tan };
}

export function pose(geo: Geo, t: number): Pose {
  const { C, H, K, tan } = palo(geo, t);
  const [gs, gh] = tramo(KF_GIRO, t);

  const cadera = new Vector3(
    geo.x0 + (C.x - geo.x0) * 0.6,
    geo.cy - TORSO * Math.cos(INCL_COLUMNA),
    geo.cz - TORSO * Math.sin(INCL_COLUMNA),
  );
  const s = C.clone().sub(cadera).normalize();

  // Hombro de atrás un poco más bajo en el setup; el giro es alrededor de la columna.
  const l0 = new Vector3(1, 0.22, 0);
  l0.addScaledVector(s, -l0.dot(s)).normalize();
  const fc = new Vector3().crossVectors(l0, s).normalize();
  const l = l0.clone().applyAxisAngle(s, -rad(gs));
  const f = new Vector3().crossVectors(l, s).normalize();

  const hombroA = C.clone().addScaledVector(l, 19);
  const hombroT = C.clone().addScaledVector(l, -19);
  const cabeza = C.clone().addScaledVector(s, 22).addScaledVector(fc, 6);

  const lp = X.clone().applyAxisAngle(Y, -rad(gh));
  const caderaA = cadera.clone().addScaledVector(lp, 10);
  const caderaT = cadera.clone().addScaledVector(lp, -10);

  const talon = t > 0.72 ? suave(Math.min(1, (t - 0.72) / 0.2)) : 0;
  const tobilloA = new Vector3(geo.x0 + 22, 8, geo.fz);
  const tobilloT = new Vector3(geo.x0 - 22 + 9 * talon, 8 + 7 * talon, geo.fz + 3 * talon);
  const rodillaA = ik(caderaA, tobilloA, MUSLO, PIERNA, new Vector3(0.25, 0, 1));
  const rodillaT = ik(caderaT, tobilloT, MUSLO, PIERNA, new Vector3(0.1 + 0.8 * talon, 0, 1));

  const sd = K.clone().sub(H).normalize();
  const manoA = H;
  const manoT = H.clone().addScaledVector(sd, 7);
  // Codos hacia abajo y hacia el cuerpo: brazos sueltos.
  const codoA = ik(hombroA, manoA, BRAZO, ANTEBRAZO, new Vector3(0.2, -1, -0.3));
  const codoT = ik(hombroT, manoT, BRAZO, ANTEBRAZO, new Vector3(-0.2, -1, -0.3));

  // Base de la cabeza del palo: la cara mira hacia donde se mueve, la punta sale hacia la bola.
  const cara = tan.clone();
  let punta = sd.clone().addScaledVector(Y, -sd.dot(Y) * 0.85);
  if (punta.lengthSq() < 0.02) punta = new Vector3().crossVectors(cara, sd);
  punta.addScaledVector(cara, -punta.dot(cara)).normalize();
  // Cerca del impacto la cara se abre o se cierra según el dato (exagerado).
  const wc = Math.exp(-(((t - T_IMPACTO) / 0.05) ** 2));
  const giro = -rad(dibujado(geo.g.cara)) * wc;
  cara.applyAxisAngle(Y, giro);
  punta.applyAxisAngle(Y, giro);
  const arriba = new Vector3().crossVectors(cara, punta).normalize();

  return {
    C, cadera, cabeza, l, s, f, lc: l0, fc, lp,
    hombroA, hombroT, codoA, codoT, manoA, manoT,
    caderaA, caderaT, rodillaA, rodillaT, tobilloA, tobilloT, talon,
    K, punta, arriba, cara,
  };
}

/**
 * Recorrido de la cabeza del palo, sin el arco completo. Desde atrás se ve desde la bajada (ahí se nota
 * si viene por encima o por debajo del plano); de frente, solo cerca del impacto (T_TRAZO_FRENTE).
 */
export const T_TRAZO: [number, number] = [0.56, 0.76];
export const T_TRAZO_FRENTE = 0.655;
export function trazoPalo(geo: Geo, n = 48): Vector3[] {
  const r: Vector3[] = [];
  for (let i = 0; i <= n; i++) r.push(palo(geo, lerp(T_TRAZO[0], T_TRAZO[1], i / n)).K);
  return r;
}

/** Vuelo de la bola (no a escala): sale con 0.85·cara + 0.15·línea y curva con cara − línea. */
const DIST_VUELO = 2500;
export function vuelo(geo: Geo, n = 48): Vector3[] {
  const { p, g } = geo;
  const la = rad(g.lanz ?? mitad(p.la));
  const dir = rad(0.85 * g.cara + 0.15 * g.linea);
  // La curva usa la cara a línea real; solo su tamaño se exagera.
  const k = 0.0255 * Math.sqrt(27 / p.loft) * (g.cara - g.linea) * EXAG.curva;
  const alto = (DIST_VUELO * Math.tan(la)) / 4;
  const r: Vector3[] = [];
  for (let i = 0; i <= n; i++) {
    const q = i / n;
    r.push(new Vector3(DIST_VUELO * q, geo.ballY + 4 * alto * q * (1 - q), DIST_VUELO * (q * Math.tan(dir) + k * q * q)));
  }
  return r;
}

/** Huella del vuelo en el piso, corta, para la vista Impacto (misma forma que el vuelo). */
export function vueloPiso(geo: Geo, largo = 170, n = 32): Vector3[] {
  return vuelo(geo, n).map((v) => new Vector3((v.x / DIST_VUELO) * largo, 0.4, (v.z / DIST_VUELO) * largo));
}

/** Línea del plano: de la bola a las manos en el setup. */
export function lineaPlano(geo: Geo): [Vector3, Vector3] {
  const bola = new Vector3(0, geo.ballY, 0);
  const manos = palo(geo, 0).H;
  return [bola, bola.clone().add(manos.sub(bola).multiplyScalar(2.4))];
}
