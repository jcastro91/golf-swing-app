import { TITULO, type Fila, type Hallazgo } from '../logica/diagnostico';

export function htmlHallazgos(h: Hallazgo[]): string {
  return h
    .map(({ area, texto: { antes, que, como } }) => {
      const p = [antes, `<b>${que}</b>`, como].filter(Boolean).join(' ');
      return `<div class="hallazgo"><h3>${TITULO[area]}</h3><p>${p}</p></div>`;
    })
    .join('');
}

export function htmlTabla(filas: Fila[]): string {
  const tr = filas
    .map(
      (f) =>
        `<tr><th>${TITULO[f.area]}</th><td>${f.valor}</td><td class="rango">${f.rango}</td>` +
        `<td class="est">${f.ok ? 'EN RANGO' : 'FUERA'}</td></tr>`,
    )
    .join('');
  return `<table class="tabla"><tbody>${tr}</tbody></table>`;
}
