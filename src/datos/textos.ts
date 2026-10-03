/** Cada texto es [antes] + "qué pasa" + "cómo corregirlo"; juntos forman el texto exacto. */
export interface Texto {
  antes?: string;
  que: string;
  como: string;
}

const BOLA_ADELANTE = 'Revisa que la bola no esté muy adelante.';

export const T = {
  ataqueAtras: {
    antes: BOLA_ADELANTE,
    que: 'El punto más bajo cae detrás de la bola.',
    como: 'Toalla 10 cm detrás de la bola, peso en el pie de adelante y manos adelante al impacto.',
  },
  ataqueDriverBajando: {
    que: 'Le pegas bajando.',
    como: 'Bola a la altura del talón de adelante, tee más alto y hombro de atrás más bajo en el setup.',
  },
  ataqueDriverSubiendo: {
    que: 'Le pegas subiendo de más.',
    como: 'Revisa que la bola no esté demasiado adelante en tu postura.',
  },
  ataqueVertical: {
    que: 'Le pegas demasiado hacia abajo: divots profundos y la bola sale baja.',
    como: 'Menos peso cargado adelante en el setup y un swing menos vertical.',
  },
  caraD: {
    que: 'Cara abierta, curva a la derecha.',
    como: 'Grip un poco más fuerte y deja girar los antebrazos en el impacto.',
  },
  caraI: {
    que: 'Cara cerrada, curva a la izquierda.',
    como: 'Grip más neutro y no cierres las manos de golpe.',
  },
  lineaI: {
    antes: BOLA_ADELANTE,
    que: 'Vas de afuera hacia adentro.',
    como: 'Headcover en el piso afuera y atrás de la bola; baja el palo por dentro sin tocarlo.',
  },
  lineaD: {
    que: 'Vas de adentro hacia afuera de más.',
    como: 'Pies y hombros apuntando al objetivo; termina el swing más a la izquierda.',
  },
  lanzCara: {
    que: 'Revisa en qué parte de la cara le pegaste:',
    como: 'échale talco en spray a la cara del palo y ve dónde queda la marca.',
  },
  lanzAtaque: {
    que: 'El lanzamiento viene del ángulo de ataque.',
    como: 'Corrige primero el ataque.',
  },
} satisfies Record<string, Texto>;

export const TODO_BIEN = 'Buen golpe: ataque, cara a línea y línea en rango.';
