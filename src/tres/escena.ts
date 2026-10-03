import {
  BoxGeometry,
  CatmullRomCurve3,
  Color,
  CylinderGeometry,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  SphereGeometry,
  TubeGeometry,
  Vector3,
  WebGLRenderer,
  type Material,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Palo } from '../datos/palos';
import type { Golpe } from '../logica/tipos';
import { Maniqui } from './maniqui';
import { RADIO_BOLA, T_IMPACTO, T_TRAZO, crearGeo, lineaPlano, pose, trazoPalo, vuelo, type Geo } from './swing';

export type Vista = 'frente' | 'atras';

const NARANJA = 0xff8030;
const GRIS = 0x8d95ad;
const AZUL = 0x1c355e;
const DIVOT = 0x6b5a3e;

/** Duración de un swing (ms) y pausa al final, como fracción. */
const DURACION = 3200;
const PAUSA = 0.3;
const REPETICIONES = 3;

const CAMARAS: Record<Vista, { pos: [number, number, number]; obj: [number, number, number] }> = {
  // De frente, como en un espejo: el objetivo queda a la derecha de la pantalla.
  frente: { pos: [25, 105, 330], obj: [25, 92, -45] },
  // Desde atrás, en línea con el objetivo.
  atras: { pos: [-370, 130, -45], obj: [0, 88, -45] },
};

const BOLA_VISIBLE = 1.6;
const TUBO_SEG = 64;
const TUBO_RAD = 5;

/** Tubo que se va revelando con setDrawRange. */
class Trazo {
  readonly mesh: Mesh;
  private curva: CatmullRomCurve3 | null = null;
  constructor(mat: Material, private radio: number) {
    this.mesh = new Mesh(new BoxGeometry(0, 0, 0), mat);
    this.mesh.frustumCulled = false;
  }
  set(puntos: Vector3[]) {
    this.mesh.geometry.dispose();
    this.curva = new CatmullRomCurve3(puntos);
    this.mesh.geometry = new TubeGeometry(this.curva, TUBO_SEG, this.radio, TUBO_RAD, false);
  }
  revelar(f: number) {
    this.mesh.geometry.setDrawRange(0, Math.floor(Math.max(0, Math.min(1, f)) * TUBO_SEG) * TUBO_RAD * 6);
  }
  punto(f: number) {
    return this.curva ? this.curva.getPointAt(Math.max(0, Math.min(1, f))) : new Vector3();
  }
}

interface Capa {
  maniqui: Maniqui;
  trazo: Trazo;
  vuelo: Trazo;
  marca: Mesh;
  divot: Mesh;
  geo: Geo | null;
}

export class Visor {
  private renderer: WebGLRenderer;
  private scene = new Scene();
  private camera = new PerspectiveCamera(40, 1, 10, 12000);
  private controls: OrbitControls;
  private mio: Capa;
  private ideal: Capa;
  private bola: Mesh;
  private tee: Mesh;
  private plano: Mesh;

  private t = 1;
  private reloj = 0; // 0 .. 1 + PAUSA
  private reps = 0;
  private corriendo = false;
  private velocidad = 1;
  private ultimo = 0;
  private raf = 0;
  private interactuando = false;
  private dirCam = new Vector3();

  /** Se llama con el t actual cuando avanza la animación. */
  onTiempo: (t: number) => void = () => {};

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.scene.background = new Color(0xf3f4f6);

    this.scene.add(new HemisphereLight(0xffffff, 0x8a9478, 2.2));
    const sol = new DirectionalLight(0xffffff, 1.6);
    sol.position.set(200, 400, 300);
    this.scene.add(sol);

    const piso = new Mesh(new PlaneGeometry(8000, 8000), new MeshLambertMaterial({ color: 0xcdd8b8 }));
    piso.rotation.x = -Math.PI / 2;
    this.scene.add(piso);

    // Línea del objetivo, que pasa por la bola.
    const linea = new Mesh(new BoxGeometry(3000, 0.2, 0.8), new MeshBasicMaterial({ color: AZUL }));
    linea.position.set(1300, 0.1, 0);
    this.scene.add(linea);

    // La bola se dibuja más grande que la real para que se vea en el celular.
    this.bola = new Mesh(new SphereGeometry(RADIO_BOLA * BOLA_VISIBLE, 12, 8), new MeshLambertMaterial({ color: 0xffffff }));
    this.scene.add(this.bola);
    this.tee = new Mesh(new CylinderGeometry(0.6, 0.4, 2.5, 6), new MeshLambertMaterial({ color: 0xffffff }));
    this.tee.position.set(0, 1.25, 0);
    this.scene.add(this.tee);

    this.plano = new Mesh(new CylinderGeometry(0.5, 0.5, 1, 5), new MeshBasicMaterial({ color: AZUL }));
    this.scene.add(this.plano);

    // El fantasma se empuja hacia atrás en profundidad: donde coincide con mi golpe, gana el naranja.
    const gris = new MeshBasicMaterial({
      color: GRIS,
      transparent: true,
      opacity: 0.33,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: 2,
      polygonOffsetUnits: 8,
    });
    this.ideal = this.crearCapa(
      { cuerpo: gris, grip: gris, varilla: gris, cabezaPalo: gris },
      new MeshBasicMaterial({ color: GRIS, transparent: true, opacity: 0.7, depthWrite: false }),
      new MeshBasicMaterial({ color: DIVOT, transparent: true, opacity: 0.45, depthWrite: false }),
    );
    this.mio = this.crearCapa(
      {
        cuerpo: new MeshLambertMaterial({ color: NARANJA, flatShading: true }),
        grip: new MeshLambertMaterial({ color: 0x1b1b1b }),
        varilla: new MeshLambertMaterial({ color: 0x9aa3b5 }),
        cabezaPalo: new MeshLambertMaterial({ color: 0x3a3f4a, flatShading: true }),
      },
      new MeshBasicMaterial({ color: NARANJA }),
      new MeshBasicMaterial({ color: DIVOT }),
    );

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enablePan = false;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    this.controls.rotateSpeed = 0.8;
    this.controls.minDistance = 150;
    this.controls.maxDistance = 1100;
    this.controls.maxPolarAngle = (88 * Math.PI) / 180;
    this.controls.addEventListener('start', () => {
      this.interactuando = true;
      this.pedir();
    });
    this.controls.addEventListener('end', () => (this.interactuando = false));
    this.controls.addEventListener('change', () => this.pedir());

    new ResizeObserver(() => this.ajustar()).observe(canvas);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        cancelAnimationFrame(this.raf);
        this.raf = 0;
      } else this.pedir();
    });
    this.setVista('frente');
  }

  private crearCapa(mats: ConstructorParameters<typeof Maniqui>[0], matTrazo: Material, matDivot: Material): Capa {
    const maniqui = new Maniqui(mats);
    const trazo = new Trazo(matTrazo, 0.9);
    const vueloT = new Trazo(matTrazo, 1.6);
    const marca = new Mesh(new BoxGeometry(2.5, 0.3, 36), matTrazo);
    const divot = new Mesh(new BoxGeometry(1, 0.4, 6), matDivot);
    this.scene.add(maniqui.grupo, trazo.mesh, vueloT.mesh, marca, divot);
    return { maniqui, trazo, vuelo: vueloT, marca, divot, geo: null };
  }

  private ajustar() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.pedir();
  }

  setVista(v: Vista) {
    const c = CAMARAS[v];
    this.camera.position.set(...c.pos);
    this.controls.target.set(...c.obj);
    this.controls.update();
    this.pedir();
  }

  /** Muestra un golpe nuevo y arranca la animación. Sin golpe propio, solo el bien pegado. */
  mostrar(p: Palo, mio: Golpe | null, ideal: Golpe) {
    this.preparar(this.ideal, p, ideal);
    this.preparar(this.mio, p, mio);
    this.tee.visible = p.tee;
    const [a, b] = lineaPlano(this.ideal.geo!);
    const d = b.clone().sub(a);
    this.plano.position.copy(a).addScaledVector(d, 0.5);
    this.plano.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), d.clone().normalize());
    this.plano.scale.set(1, d.length(), 1);
    this.repetir();
  }

  private preparar(c: Capa, p: Palo, g: Golpe | null) {
    const visible = g !== null;
    for (const o of [c.maniqui.grupo, c.trazo.mesh, c.vuelo.mesh, c.marca, c.divot]) o.visible = visible;
    if (!g) {
      c.geo = null;
      return;
    }
    const geo = crearGeo(p, g);
    c.geo = geo;
    c.maniqui.setPalo(p);
    c.trazo.set(trazoPalo(geo));
    c.vuelo.set(vuelo(geo));
    // Raya en el piso donde cae el punto más bajo del swing.
    c.marca.position.set(geo.lowX, 0.25, 0);
    // Divot después de la bola cuando el palo llega bajando y sin tee.
    const conDivot = !p.tee && geo.lowX > 2;
    c.divot.userData.activo = conDivot;
    if (conDivot) {
      const x1 = RADIO_BOLA;
      const x2 = geo.lowX + 14;
      c.divot.scale.set(x2 - x1, 1, 1);
      c.divot.position.set((x1 + x2) / 2, 0.2, 0);
    }
  }

  repetir() {
    this.reloj = 0;
    this.reps = 0;
    this.corriendo = true;
    this.ultimo = performance.now();
    this.pedir();
  }

  setLento(lento: boolean) {
    this.velocidad = lento ? 0.35 : 1;
  }

  /** Mover la animación a mano (pausa). */
  irA(t: number) {
    this.corriendo = false;
    this.t = t;
    this.pedir();
  }

  private pedir() {
    if (!this.raf && !document.hidden) this.raf = requestAnimationFrame(this.cuadro);
  }

  private cuadro = (ahora: number) => {
    this.raf = 0;
    if (this.corriendo) {
      const dt = Math.min(50, ahora - this.ultimo);
      this.reloj += (dt / DURACION) * this.velocidad;
      if (this.reloj >= 1 + PAUSA) {
        this.reps++;
        if (this.reps >= REPETICIONES) {
          this.corriendo = false;
          this.reloj = 1;
        } else this.reloj = 0;
      }
      this.t = Math.min(1, this.reloj);
      this.onTiempo(this.t);
    }
    this.ultimo = ahora;
    this.aplicar(this.t);
    const seMovio = this.controls.update();
    // El plano solo se entiende mirando en línea con el objetivo.
    this.camera.getWorldDirection(this.dirCam);
    this.plano.visible = Math.abs(this.dirCam.x) > 0.6;
    this.renderer.render(this.scene, this.camera);
    if (this.corriendo || this.interactuando || seMovio) this.pedir();
  };

  private aplicar(t: number) {
    for (const c of [this.ideal, this.mio]) {
      if (!c.geo) continue;
      c.maniqui.actualizar(pose(c.geo, t));
      c.trazo.revelar((t - T_TRAZO[0]) / (T_TRAZO[1] - T_TRAZO[0]));
      c.vuelo.revelar((t - T_IMPACTO) / (1 - T_IMPACTO));
      c.divot.visible = c.divot.userData.activo && t > T_IMPACTO + 0.01;
    }
    const ref = this.mio.geo ?? this.ideal.geo!;
    const capa = this.mio.geo ? this.mio : this.ideal;
    if (t <= T_IMPACTO) this.bola.position.set(0, ref.ballY + RADIO_BOLA * (BOLA_VISIBLE - 1), 0);
    else this.bola.position.copy(capa.vuelo.punto((t - T_IMPACTO) / (1 - T_IMPACTO)));
  }
}
