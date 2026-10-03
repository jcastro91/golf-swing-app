import type { Lado, Signo, TiroRapido } from '../logica/tipos';
import type { Vista } from '../tres/escena';

export interface PrecisoCrudo {
  linea: string;
  lineaLado: Exclude<Lado, 'OK'>;
  cara: string;
  caraLado: Exclude<Lado, 'OK'>;
  ataque: string;
  ataqueSigno: Signo;
  lanz: string;
}

export interface Estado {
  palo: string;
  vista: Vista;
  pestana: 'campo' | 'preciso';
  rapido: TiroRapido;
  preciso: PrecisoCrudo;
}

const CLAVE = 'golpe-r10';

const INICIAL: Estado = {
  palo: 'i7',
  vista: 'frente',
  pestana: 'campo',
  rapido: { ataque: null, caraLinea: null, linea: null },
  preciso: { linea: '', lineaLado: 'I', cara: '', caraLado: 'I', ataque: '', ataqueSigno: '-', lanz: '' },
};

/** iOS puede cerrar la app al cambiar a Garmin Golf; por eso se guarda todo. */
export function cargar(): Estado {
  try {
    const s = JSON.parse(localStorage.getItem(CLAVE) ?? '{}');
    return {
      ...INICIAL,
      ...s,
      rapido: { ...INICIAL.rapido, ...s.rapido },
      preciso: { ...INICIAL.preciso, ...s.preciso },
    };
  } catch {
    return structuredClone(INICIAL);
  }
}

export function guardar(e: Estado) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(e));
  } catch {
    // Sin almacenamiento (modo privado): la app sigue funcionando.
  }
}
