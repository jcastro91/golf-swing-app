import {
  BoxGeometry,
  CatmullRomCurve3,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  NotEqualStencilFunc,
  PerspectiveCamera,
  ReplaceStencilOp,
  PlaneGeometry,
  RingGeometry,
  Scene,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  TOUCH,
  TubeGeometry,
  Vector3,
  WebGLRenderer,
  type Material,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import type { Palo } from '../datos/palos';
import type { Golpe } from '../logica/tipos';
import { Maniqui } from './maniqui';
import {
  RADIO_BOLA,
  T_IMPACTO,
  T_TRAZO,
  T_TRAZO_FRENTE,
  crearGeo,
  dibujado,
  lineaPlano,
  pose,
  trazoPalo,
  vuelo,
  vueloPiso,
  type Geo,
} from './swing';

export type Vista = 'frente' | 'atras' | 'impacto';
/** Qué figura se ve: las dos encimadas, o una sola con la misma cámara. */
export type Mostrar = 'ambos' | 'mio' | 'ideal';

const NARANJA = 0xff8030;
const AZUL = 0x1c355e;
const GRIS_PLANO = 0x60728e;
const DIVOT = 0x6b5a3e;
/** Bien pegado: aristas azules sólidas encima de todo y un relleno tenue que queda detrás de mi golpe. */
const ARISTA_IDEAL_PX = 2;
const RELLENO_IDEAL = 0.15;
const OPACIDAD_TRAZO_IDEAL = 0.6;

/** Duración de un swing a velocidad normal (ms) y pausa al final, como fracción. */
const DURACION = 2600;
const PAUSA = 0.35;
const REPETICIONES = 3;
/** Cámara lenta automática cerca del impacto. */
const LENTO_DESDE = 0.6;
const LENTO_HASTA = 0.8;
const LENTO_FACTOR = 0.25;

const CAMARAS: Record<Vista, { pos: [number, number, number]; obj: [number, number, number]; fov: number }> = {
  // De frente, como en un espejo: el objetivo queda a la derecha de la pantalla.
  frente: { pos: [25, 110, 345], obj: [25, 95, -50], fov: 40 },
  // Desde atrás, en línea con el objetivo.
  atras: { pos: [-380, 140, -50], obj: [0, 92, -50], fov: 40 },
  // Desde arriba y muy cerca de la bola: cabeza del palo, cara, línea y la curva más adelante.
  impacto: { pos: [-38, 58, 4], obj: [36, 0, 4], fov: 55 },
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
  /** Dibuja el tramo de la curva entre `desde` y `hasta` (fracciones de 0 a 1). */
  revelar(hasta: number, desde = 0) {
    const seg = (f: number) => Math.floor(Math.max(0, Math.min(1, f)) * TUBO_SEG) * TUBO_RAD * 6;
    this.mesh.geometry.setDrawRange(seg(desde), Math.max(0, seg(hasta) - seg(desde)));
  }
  punto(f: number) {
    return this.curva ? this.curva.getPointAt(Math.max(0, Math.min(1, f))) : new Vector3();
  }
}

/** Flecha plana sobre el piso, apuntando a +x desde el origen. */
function flecha(largo: number, ancho: number, mat: Material): Mesh {
  const punta = 7;
  const s = new Shape();
  s.moveTo(0, -ancho / 2);
  s.lineTo(largo - punta, -ancho / 2);
  s.lineTo(largo - punta, -ancho * 1.9);
  s.lineTo(largo, 0);
  s.lineTo(largo - punta, ancho * 1.9);
  s.lineTo(largo - punta, ancho / 2);
  s.lineTo(0, ancho / 2);
  s.closePath();
  const g = new ShapeGeometry(s);
  g.rotateX(-Math.PI / 2);
  return new Mesh(g, mat);
}

/** Dirección sobre el piso para un ángulo en grados (positivo = D = +z). */
const dirPiso = (grados: number) => {
  const a = (grados * Math.PI) / 180;
  return new Vector3(Math.cos(a), 0, Math.sin(a));
};

interface Capa {
  maniqui: Maniqui;
  /** Solo el bien pegado: aristas, dibujadas aparte encima de todo. */
  contorno?: Maniqui;
  trazo: Trazo;
  vuelo: Trazo; // solo su curva: mueve la bola
  huella: Trazo; // vuelo visto desde arriba, en la vista Impacto
  marca: Mesh;
  divot: Mesh;
  geo: Geo | null;
}

interface Etiqueta {
  el: HTMLDivElement;
  punto: Vector3;
  visible: boolean;
}

export class Visor {
  private renderer: WebGLRenderer;
  private scene = new Scene();
  /** Las aristas del bien pegado se dibujan aparte, encima de todo, para que no las tape mi golpe. */
  private escenaIdeal = new Scene();
  private matArista = new LineMaterial({ color: AZUL, linewidth: ARISTA_IDEAL_PX });
  private camera = new PerspectiveCamera(40, 1, 4, 12000);
  private controls: OrbitControls;
  private mio: Capa;
  private ideal: Capa;
  private bola: Mesh;
  private tee: Mesh;
  private plano: Mesh;
  private lineaObjetivo: Mesh;
  private flechas = new Group();
  private flechaLinea: Mesh;
  private flechaCara: Mesh;
  private arco: Mesh;
  private etiquetas: Record<'plano' | 'miPalo' | 'bienPegado' | 'linea' | 'cara', Etiqueta>;

  private vista: Vista = 'frente';
  private mostrarModo: Mostrar = 'ambos';
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
    this.renderer = new WebGLRenderer({ canvas, antialias: true, stencil: true, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.autoClear = false;
    this.scene.background = new Color(0xf3f4f6);

    this.scene.add(new HemisphereLight(0xffffff, 0x8a9478, 2.2));
    const sol = new DirectionalLight(0xffffff, 1.6);
    sol.position.set(200, 400, 300);
    this.scene.add(sol);

    const piso = new Mesh(new PlaneGeometry(8000, 8000), new MeshLambertMaterial({ color: 0xcdd8b8 }));
    piso.rotation.x = -Math.PI / 2;
    this.scene.add(piso);

    // La bola se dibuja más grande que la real para que se vea en el celular.
    this.bola = new Mesh(new SphereGeometry(RADIO_BOLA * BOLA_VISIBLE, 12, 8), new MeshLambertMaterial({ color: 0xffffff }));
    this.scene.add(this.bola);
    this.tee = new Mesh(new CylinderGeometry(0.6, 0.4, 2.5, 6), new MeshLambertMaterial({ color: 0xffffff }));
    this.tee.position.set(0, 1.25, 0);
    this.scene.add(this.tee);

    this.plano = new Mesh(new CylinderGeometry(0.6, 0.6, 1, 5), new MeshBasicMaterial({ color: GRIS_PLANO }));
    this.scene.add(this.plano);

    // Vista Impacto: línea del objetivo, flecha de la línea del palo, flecha de la cara y el ángulo entre ellas.
    this.lineaObjetivo = new Mesh(new BoxGeometry(260, 0.2, 0.5), new MeshBasicMaterial({ color: GRIS_PLANO }));
    this.lineaObjetivo.position.set(100, 0.15, 0);
    this.flechaLinea = flecha(62, 1.6, new MeshBasicMaterial({ color: AZUL, side: DoubleSide }));
    this.flechaCara = flecha(40, 1.6, new MeshBasicMaterial({ color: NARANJA, side: DoubleSide }));
    this.arco = new Mesh(new RingGeometry(1, 2, 2), new MeshBasicMaterial({ color: AZUL, side: DoubleSide }));
    this.flechas.add(this.lineaObjetivo, this.flechaLinea, this.flechaCara, this.arco);
    this.scene.add(this.flechas);

    // Relleno tenue: en la escena normal, así mi golpe (opaco) queda delante y en naranja puro.
    // Además no pinta donde está mi figura (stencil): el naranja nunca se tiñe.
    const relleno = new MeshBasicMaterial({
      color: AZUL,
      transparent: true,
      opacity: RELLENO_IDEAL,
      depthWrite: false,
      stencilWrite: true,
      stencilRef: 1,
      stencilFunc: NotEqualStencilFunc,
    });
    this.ideal = this.crearCapa(
      { cuerpo: relleno, grip: relleno, varilla: relleno, cabezaPalo: relleno },
      new MeshBasicMaterial({ color: AZUL, transparent: true, opacity: OPACIDAD_TRAZO_IDEAL, depthWrite: false }),
      new MeshBasicMaterial({ color: DIVOT, transparent: true, opacity: 0.45, depthWrite: false }),
      this.scene,
    );
    // Contorno: las mallas solo escriben profundidad (un poco hacia atrás) y encima van las aristas.
    const soloProfundidad = new MeshBasicMaterial({
      colorWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 2,
    });
    this.ideal.contorno = new Maniqui(
      { cuerpo: soloProfundidad, grip: soloProfundidad, varilla: soloProfundidad, cabezaPalo: soloProfundidad },
      this.matArista,
    );
    this.escenaIdeal.add(this.ideal.contorno.grupo);
    // Mi figura marca sus píxeles en el stencil para que el relleno del bien pegado no los pinte.
    const marcaStencil = { stencilWrite: true, stencilRef: 1, stencilZPass: ReplaceStencilOp };
    this.mio = this.crearCapa(
      {
        cuerpo: new MeshLambertMaterial({ color: NARANJA, flatShading: true, ...marcaStencil }),
        grip: new MeshLambertMaterial({ color: 0x1b1b1b, ...marcaStencil }),
        varilla: new MeshLambertMaterial({ color: 0x9aa3b5, ...marcaStencil }),
        cabezaPalo: new MeshLambertMaterial({ color: 0x3a3f4a, flatShading: true, ...marcaStencil }),
      },
      new MeshBasicMaterial({ color: NARANJA }),
      new MeshBasicMaterial({ color: DIVOT }),
      this.scene,
    );

    const caja = canvas.parentElement!.querySelector<HTMLDivElement>('.etiquetas')!;
    const etiqueta = (texto: string, clase: string): Etiqueta => {
      const el = document.createElement('div');
      el.className = `etiqueta ${clase}`;
      el.textContent = texto;
      caja.append(el);
      return { el, punto: new Vector3(), visible: false };
    };
    this.etiquetas = {
      plano: etiqueta('plano', 'e-plano'),
      miPalo: etiqueta('mi palo', 'e-mio'),
      bienPegado: etiqueta('bien pegado', 'e-ideal'),
      linea: etiqueta('línea', 'e-ideal'),
      cara: etiqueta('cara', 'e-mio'),
    };

    this.controls = new OrbitControls(this.camera, canvas);
    // Un dedo hace scroll de la página (touch-action: pan-y en el CSS); dos dedos giran la cámara.
    canvas.style.touchAction = '';
    this.controls.touches = { ONE: -1 as TOUCH, TWO: TOUCH.DOLLY_ROTATE };
    this.controls.enableZoom = false;
    this.controls.enablePan = false;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    this.controls.rotateSpeed = 0.8;
    this.controls.minDistance = 40;
    this.controls.maxDistance = 1100;
    this.controls.maxPolarAngle = (88 * Math.PI) / 180;
    this.controls.addEventListener('start', () => {
      this.interactuando = true;
      this.pedir();
    });
    this.controls.addEventListener('end', () => (this.interactuando = false));
    this.controls.addEventListener('change', () => this.pedir());

    // Con dos dedos, iOS haría zoom o scroll de la página en vez de girar el maniquí.
    const sinGesto = (e: Event) => e.preventDefault();
    canvas.addEventListener('gesturestart', sinGesto);
    canvas.addEventListener('gesturechange', sinGesto);
    canvas.addEventListener('touchmove', (e) => e.touches.length > 1 && e.preventDefault(), { passive: false });

    new ResizeObserver(() => this.ajustar()).observe(canvas);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        cancelAnimationFrame(this.raf);
        this.raf = 0;
      } else this.pedir();
    });
    this.setVista('frente');
  }

  private crearCapa(
    mats: ConstructorParameters<typeof Maniqui>[0],
    matTrazo: Material,
    matDivot: Material,
    escenaFigura: Scene,
  ): Capa {
    const maniqui = new Maniqui(mats);
    const trazo = new Trazo(matTrazo, 0.9);
    const huella = new Trazo(matTrazo, 0.8);
    const marca = new Mesh(new BoxGeometry(2.5, 0.3, 36), matTrazo);
    const divot = new Mesh(new BoxGeometry(1, 0.4, 6), matDivot);
    escenaFigura.add(maniqui.grupo);
    this.scene.add(trazo.mesh, huella.mesh, marca, divot);
    return { maniqui, trazo, vuelo: new Trazo(matTrazo, 1), huella, marca, divot, geo: null };
  }

  private ajustar() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.matArista.resolution.set(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.pedir();
  }

  setVista(v: Vista) {
    this.vista = v;
    const c = CAMARAS[v];
    // Sin damping, update() consume la inercia que quedaba del giro con los dedos.
    this.controls.enableDamping = false;
    this.controls.update();
    this.camera.fov = c.fov;
    this.camera.updateProjectionMatrix();
    this.camera.position.set(...c.pos);
    this.controls.target.set(...c.obj);
    this.controls.update();
    this.controls.enableDamping = true;
    this.pedir();
  }

  setMostrar(m: Mostrar) {
    this.mostrarModo = m;
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
    this.etiquetas.plano.punto.copy(a).addScaledVector(d, 0.78);

    if (mio) this.prepararFlechas(mio);
    this.repetir();
  }

  /** Flechas de la vista Impacto. Cara y línea con el mismo factor: el ángulo entre ellas sale ×2. */
  private prepararFlechas(g: Golpe) {
    const lin = dibujado(g.linea);
    const car = dibujado(g.cara);
    const y = 0.5;
    this.flechaLinea.rotation.y = (-lin * Math.PI) / 180;
    this.flechaLinea.position.copy(dirPiso(lin).multiplyScalar(-24)).setY(y);
    this.flechaCara.rotation.y = (-car * Math.PI) / 180;
    this.flechaCara.position.set(0, y + 0.1, 0);
    // "línea" a la izquierda de su flecha y "cara" a la derecha de la suya, para que no se encimen.
    this.etiquetas.linea.punto.copy(dirPiso(lin).multiplyScalar(30)).add(dirPiso(lin - 90).multiplyScalar(14)).setY(y);
    this.etiquetas.cara.punto.copy(dirPiso(car).multiplyScalar(46)).setY(y);

    const desde = Math.min(lin, car);
    const hasta = Math.max(lin, car);
    this.arco.geometry.dispose();
    const r = 32;
    const g2 = new RingGeometry(r - 1, r + 1, 24, 1, (-hasta * Math.PI) / 180, ((hasta - desde) * Math.PI) / 180);
    g2.rotateX(-Math.PI / 2);
    this.arco.geometry = g2;
    this.arco.position.y = y;
    this.arco.visible = hasta - desde > 0.5;
  }

  private preparar(c: Capa, p: Palo, g: Golpe | null) {
    if (!g) {
      c.geo = null;
      return;
    }
    const geo = crearGeo(p, g);
    c.geo = geo;
    c.maniqui.setPalo(p);
    c.contorno?.setPalo(p);
    c.trazo.set(trazoPalo(geo));
    c.vuelo.set(vuelo(geo));
    c.huella.set(vueloPiso(geo));
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
      const cercaImpacto = this.reloj >= LENTO_DESDE && this.reloj < LENTO_HASTA;
      this.reloj += (dt / DURACION) * this.velocidad * (cercaImpacto ? LENTO_FACTOR : 1);
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
    const seMovio = this.controls.update();
    this.aplicar(this.t);

    const r = this.renderer;
    r.clear();
    r.render(this.scene, this.camera);
    if (this.ideal.contorno?.grupo.visible) {
      // Profundidad limpia: el contorno se ve encima de mi golpe, pero sus aristas de atrás no.
      r.clearDepth();
      r.render(this.escenaIdeal, this.camera);
    }
    this.colocarEtiquetas();
    if (this.corriendo || this.interactuando || seMovio) this.pedir();
  };

  private aplicar(t: number) {
    const impacto = this.vista === 'impacto';
    const ver = (c: Capa) =>
      c.geo !== null && (this.mostrarModo === 'ambos' || this.mostrarModo === (c === this.mio ? 'mio' : 'ideal'));

    for (const c of [this.ideal, this.mio]) {
      const v = ver(c);
      c.maniqui.grupo.visible = v;
      if (c.contorno) c.contorno.grupo.visible = v;
      c.trazo.mesh.visible = v && !impacto;
      c.huella.mesh.visible = v && impacto;
      // En Impacto la raya y el divot taparían las flechas.
      c.marca.visible = v && !impacto;
      if (!c.geo) continue;
      c.divot.visible = v && !impacto && c.divot.userData.activo && t > T_IMPACTO + 0.01;
      if (!v) continue;
      const q = pose(c.geo, t);
      c.maniqui.actualizar(q);
      c.contorno?.actualizar(q);
      const fTrazo = (x: number) => (x - T_TRAZO[0]) / (T_TRAZO[1] - T_TRAZO[0]);
      c.trazo.revelar(fTrazo(t), this.vista === 'atras' ? 0 : fTrazo(T_TRAZO_FRENTE));
      c.huella.revelar((t - T_IMPACTO) / (1 - T_IMPACTO));
    }
    this.flechas.visible = impacto && ver(this.mio);

    // El plano solo se entiende mirando en línea con el objetivo.
    this.camera.getWorldDirection(this.dirCam);
    this.plano.visible = !impacto && Math.abs(this.dirCam.x) > 0.6;

    // La bola sigue al golpe que se está viendo.
    const capa = ver(this.mio) ? this.mio : this.ideal;
    const geo = capa.geo!;
    const f = (t - T_IMPACTO) / (1 - T_IMPACTO);
    if (t <= T_IMPACTO) this.bola.position.set(0, geo.ballY + RADIO_BOLA * (BOLA_VISIBLE - 1), 0);
    else if (impacto) this.bola.position.copy(capa.huella.punto(f)).setY(RADIO_BOLA * BOLA_VISIBLE);
    else this.bola.position.copy(capa.vuelo.punto(f));

    const e = this.etiquetas;
    const trazoVisto = (c: Capa) => c.trazo.mesh.visible && t >= T_TRAZO[1];
    e.plano.visible = this.plano.visible;
    e.miPalo.visible = trazoVisto(this.mio);
    e.bienPegado.visible = trazoVisto(this.ideal);
    if (this.mio.geo) e.miPalo.punto.copy(this.mio.trazo.punto(1));
    if (this.ideal.geo) e.bienPegado.punto.copy(this.ideal.trazo.punto(1));
    e.linea.visible = e.cara.visible = this.flechas.visible;
  }

  /** Proyecta las etiquetas sobre el canvas y separa las que se encimarían. */
  private colocarEtiquetas() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    const puestas: [number, number][] = [];
    const v = new Vector3();
    for (const et of Object.values(this.etiquetas)) {
      v.copy(et.punto).project(this.camera);
      const dentro = et.visible && v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05;
      et.el.hidden = !dentro;
      if (!dentro) continue;
      const x = Math.min(w - 80, Math.max(4, ((v.x + 1) / 2) * w + 6));
      let y = Math.min(h - 26, Math.max(4, ((1 - v.y) / 2) * h - 12));
      for (const [px, py] of puestas) if (Math.abs(px - x) < 90 && Math.abs(py - y) < 24) y = py + 26;
      puestas.push([x, y]);
      et.el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    }
  }
}
