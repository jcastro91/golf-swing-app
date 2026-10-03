# Golpe R10

Mini-PWA para el campo de práctica con el Garmin R10. Después de cada tiro marcas ataque, cara a línea y línea con tres toques; te dice qué corregir y te lo muestra con un maniquí 3D (tu golpe en naranja, uno bien pegado en gris).

Vite + TypeScript + three.js. Sin backend, sin cuentas, sin analytics. Funciona offline.

## Desarrollo

```sh
npm install
npm run dev        # abre la URL "Network" en el iPhone (misma red wifi)
npm run build      # genera dist/
npm run preview    # sirve dist/ con el service worker
```

Los íconos salen de `public/favicon.svg`; si lo cambias, corre `npm run icons`.

## Estructura

- `src/datos/` rangos por palo, posición de bola de referencia y los textos exactos del diagnóstico.
- `src/logica/` reglas del diagnóstico (campo y preciso) y conversión del tiro a números para animar.
- `src/tres/swing.ts` cinemática: arco del palo alrededor de los hombros, punto más bajo según el ataque, plano rotado según la línea, giro de cadera y hombros, IK de brazos y piernas.
- `src/tres/maniqui.ts` figura low-poly con primitivas.
- `src/tres/escena.ts` cámaras, controles táctiles, trazos y loop de animación.
- `src/ui/` pantallas de campo y preciso, y lo que se guarda en el teléfono.

## Publicar en GitHub Pages

1. Crea un repositorio en GitHub (por ejemplo `golpe-r10`).
2. En esta carpeta:
   ```sh
   git init -b main
   git add .
   git commit -m "Golpe R10"
   git remote add origin git@github.com:<tu-usuario>/golpe-r10.git
   git push -u origin main
   ```
3. En GitHub: Settings → Pages → Source: **GitHub Actions**.
4. El workflow `.github/workflows/deploy.yml` compila y publica en cada push a `main`. La app queda en `https://<tu-usuario>.github.io/golpe-r10/`.

## Publicar en Netlify (alternativa)

- Con el repo conectado: Netlify lee `netlify.toml` y publica `dist/`.
- Sin repo: `npm run build` y arrastra la carpeta `dist/` a app.netlify.com/drop.

## Instalar en el iPhone

1. Abre la URL en **Safari** con señal.
2. Compartir → **Agregar a inicio**.
3. Ábrela una vez desde el ícono con internet para que guarde todo. Desde ahí abre sin señal.

Las actualizaciones se descargan solas la siguiente vez que la abras con internet.
