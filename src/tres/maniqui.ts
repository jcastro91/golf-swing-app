import {
  BoxGeometry,
  CapsuleGeometry,
  CylinderGeometry,
  EdgesGeometry,
  Group,
  IcosahedronGeometry,
  Matrix4,
  Mesh,
  SphereGeometry,
  Vector3,
  type BufferGeometry,
  type Material,
} from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import type { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import type { Palo } from '../datos/palos';
import { ANTEBRAZO, BRAZO, LARGO_PIERNA, RADIO_BOLA, type Pose } from './swing';

/*
 * Figura low-poly hecha con primitivas. Cada cuadro se calculan las articulaciones en el
 * espacio del mundo (swing.ts) y cada segmento se orienta entre sus dos articulaciones.
 */

const ARRIBA = new Vector3(0, 1, 0);
const m4 = new Matrix4();
const tmp = new Vector3();

// Geometrías compartidas entre las dos figuras.
const capsula = (r: number, largo: number) => new CapsuleGeometry(r, largo, 2, 6);
const G = {
  brazo: capsula(4.6, BRAZO),
  antebrazo: capsula(4, ANTEBRAZO),
  muslo: capsula(7, LARGO_PIERNA),
  pierna: capsula(5.5, LARGO_PIERNA),
  cuello: capsula(4.5, 8),
  mano: new SphereGeometry(4.3, 6, 4),
  cabeza: new IcosahedronGeometry(11, 1),
  visera: new BoxGeometry(14, 2, 9),
  pelvis: new BoxGeometry(30, 15, 20),
  pecho: (() => {
    // Prisma cuadrado que se angosta hacia la cintura.
    const g = new CylinderGeometry(1, 0.78, 1, 4, 1);
    g.rotateY(Math.PI / 4);
    g.scale(19 / Math.SQRT1_2, 1, 10 / Math.SQRT1_2);
    return g;
  })(),
  pie: new BoxGeometry(10, 7, 26),
  grip: new CylinderGeometry(1.4, 1.2, 1, 6),
  varilla: new CylinderGeometry(0.6, 0.5, 1, 5),
};
const LARGO_GRIP = 26;

/** Solo las aristas marcadas (ángulo entre caras > 35°): contorno legible, sin la malla completa. */
const UMBRAL_ARISTA = 35;
const cacheAristas = new Map<string, LineSegmentsGeometry>();
function aristas(g: BufferGeometry): LineSegmentsGeometry {
  let a = cacheAristas.get(g.uuid);
  if (!a) {
    a = new LineSegmentsGeometry().fromEdgesGeometry(new EdgesGeometry(g, UMBRAL_ARISTA));
    cacheAristas.set(g.uuid, a);
  }
  return a;
}

function cabezaPalo(p: Palo): BufferGeometry {
  if (p.tee) return new BoxGeometry(11.5, 6, 10);
  if (p.id.startsWith('m')) return new BoxGeometry(10, 4.5, 7);
  if (p.id === 'h4') return new BoxGeometry(9, 4.5, 4.5);
  return new BoxGeometry(8, 5, 2);
}

/** Orienta una cápsula o cilindro (eje y) entre a y b. */
function entre(m: Mesh, a: Vector3, b: Vector3, nominal: number) {
  tmp.subVectors(b, a);
  const largo = tmp.length() || 1;
  m.position.addVectors(a, b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(ARRIBA, tmp.divideScalar(largo));
  m.scale.set(1, largo / nominal, 1);
}

function conBase(m: Mesh, x: Vector3, y: Vector3, z: Vector3, pos: Vector3) {
  m4.makeBasis(x, y, z);
  m.quaternion.setFromRotationMatrix(m4);
  m.position.copy(pos);
}

export interface Materiales {
  cuerpo: Material;
  grip: Material;
  varilla: Material;
  cabezaPalo: Material;
}

export class Maniqui {
  readonly grupo = new Group();
  private m: Record<string, Mesh> = {};
  private dimCabeza = new Vector3();

  /**
   * Con `contorno`, cada pieza lleva sus aristas como hijo (mismo transform). La malla queda
   * solo para la profundidad, así las aristas de atrás de la figura no se ven.
   */
  constructor(
    private mat: Materiales,
    private contorno?: LineMaterial,
  ) {
    const c = mat.cuerpo;
    const add = (n: string, g: BufferGeometry, mt: Material = c) => {
      const mesh = this.pieza(g, mt);
      this.m[n] = mesh;
      this.grupo.add(mesh);
    };
    add('pelvis', G.pelvis);
    add('pecho', G.pecho);
    add('cuello', G.cuello);
    add('cabeza', G.cabeza);
    add('visera', G.visera);
    for (const lado of ['A', 'T']) {
      add('brazo' + lado, G.brazo);
      add('antebrazo' + lado, G.antebrazo);
      add('mano' + lado, G.mano);
      add('muslo' + lado, G.muslo);
      add('pierna' + lado, G.pierna);
      add('pie' + lado, G.pie);
    }
    add('grip', G.grip, mat.grip);
    add('varilla', G.varilla, mat.varilla);
  }

  private pieza(g: BufferGeometry, mt: Material): Mesh {
    const mesh = new Mesh(g, mt);
    if (this.contorno) {
      const lineas = new LineSegments2(aristas(g), this.contorno);
      lineas.renderOrder = 1; // después de la profundidad
      mesh.add(lineas);
    }
    return mesh;
  }

  /** La cabeza del palo cambia con el palo elegido. */
  setPalo(p: Palo) {
    const viejo = this.m.cabezaPalo;
    if (viejo) {
      this.grupo.remove(viejo);
      cacheAristas.get(viejo.geometry.uuid)?.dispose();
      cacheAristas.delete(viejo.geometry.uuid);
      viejo.geometry.dispose();
    }
    const g = cabezaPalo(p);
    g.computeBoundingBox();
    g.boundingBox!.getSize(this.dimCabeza);
    const mesh = this.pieza(g, this.mat.cabezaPalo);
    this.m.cabezaPalo = mesh;
    this.grupo.add(mesh);
  }

  actualizar(q: Pose) {
    const m = this.m;
    conBase(m.pelvis, q.lp, ARRIBA, tmp.crossVectors(q.lp, ARRIBA).normalize().clone(), q.cadera);

    const baseP = q.cadera.clone().addScaledVector(q.s, 6);
    const topeP = q.C.clone().addScaledVector(q.s, 3);
    const largoP = topeP.distanceTo(baseP);
    conBase(m.pecho, q.l, q.s, q.f, baseP.add(topeP).multiplyScalar(0.5));
    m.pecho.scale.set(1, largoP, 1);

    entre(m.cuello, q.C.clone().addScaledVector(q.s, 4), q.cabeza.clone().addScaledVector(q.s, -8), 8);
    m.cabeza.position.copy(q.cabeza);
    conBase(m.visera, q.lc, q.s, q.fc, q.cabeza.clone().addScaledVector(q.s, 6).addScaledVector(q.fc, 9));

    entre(m.brazoA, q.hombroA, q.codoA, BRAZO);
    entre(m.antebrazoA, q.codoA, q.manoA, ANTEBRAZO);
    entre(m.brazoT, q.hombroT, q.codoT, BRAZO);
    entre(m.antebrazoT, q.codoT, q.manoT, ANTEBRAZO);
    m.manoA.position.copy(q.manoA);
    m.manoT.position.copy(q.manoT);

    entre(m.musloA, q.caderaA, q.rodillaA, LARGO_PIERNA);
    entre(m.piernaA, q.rodillaA, q.tobilloA, LARGO_PIERNA);
    entre(m.musloT, q.caderaT, q.rodillaT, LARGO_PIERNA);
    entre(m.piernaT, q.rodillaT, q.tobilloT, LARGO_PIERNA);
    m.pieA.position.set(q.tobilloA.x + 2, 3.5, q.tobilloA.z + 7);
    m.pieA.rotation.set(0, 0.25, 0);
    // En el final el pie de atrás queda en la punta.
    m.pieT.position.set(q.tobilloT.x, 3.5 + 5 * q.talon, q.tobilloT.z + 7 + 2 * q.talon);
    m.pieT.rotation.set(0.7 * q.talon, 0, 0);

    // Palo: la cabeza se apoya en el piso y su cara toca la bola en el impacto.
    const d = this.dimCabeza;
    const centro = q.K.clone()
      .addScaledVector(q.arriba, d.y / 2)
      .addScaledVector(q.cara, -(d.z / 2 + RADIO_BOLA));
    conBase(m.cabezaPalo, q.punta, q.arriba, q.cara, centro);
    const hosel = centro.clone().addScaledVector(q.punta, -d.x * 0.45).addScaledVector(q.arriba, d.y * 0.3);
    const dir = hosel.clone().sub(q.manoA).normalize();
    const extremo = q.manoA.clone().addScaledVector(dir, -4);
    const finGrip = extremo.clone().addScaledVector(dir, LARGO_GRIP);
    entre(m.grip, extremo, finGrip, 1);
    entre(m.varilla, finGrip, hosel, 1);
  }
}
