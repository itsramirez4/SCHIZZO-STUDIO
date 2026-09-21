# SCHIZZO STUDIO

Estudio de dibujo digital, pixel art, cómic/manga y referencias 3D. Gratuito, de código abierto (MIT) y **local primero**: tus proyectos viven en tu equipo, sin cuenta ni suscripción.

Electron 31 · React 18 · TypeScript · Vite · Tailwind · Zustand.

## Tipos de proyecto

| Tipo | Para qué |
| --- | --- |
| **Dibujo** | Pintura e ilustración con pinceles, capas, filtros y ayudas de perspectiva. |
| **Pixel art** | Lienzo píxel a píxel, paletas y filtros de pixel art. |
| **Cómic** | Viñetas, globos de texto y paneles de manga. |
| **3D** | Visor 3D con modelos importables, cámara, luces y maniquí posable. |

## Qué incluye

- **Pinceles**: biblioteca amplia, editor de pinceles, importación de pinceles ABR y de otros formatos.
- **Capas**: raster, relleno, ajuste, vectoriales, texto, grupos, máscaras, recorte, modos de mezcla y efectos no destructivos.
- **Color**: rueda de color RYB/RGB con armonías, paletas, selector avanzado, herramientas de accesibilidad (daltonismo).
- **Ayudas de dibujo**: regla a mano alzada (recta, paralelas, elipse, perspectiva), perspectiva de 1 a 3 puntos, simetría, guías de estudio y cuadrículas.
- **Referencias**: por proyecto y en carpetas, ventana flotante con zoom/rotación/desplazamiento, comparación con el dibujo (superposición).
- **Maniquí y modelos 3D**: maniquí con pose (pies incluidos), 12 especies de animales, 17 prendas, más de 50 objetos, línea de horizonte ajustable y biblioteca personal de poses.
- **Aprender**: tutor, academia de dibujo y guías paso a paso.
- **Reproducción del proceso**: cada paso queda registrado con el proyecto; puedes reproducirlo, recorrerlo paso a paso y exportarlo como timelapse WebM (Historial → *Reproducir el proceso*).
- **Historial** de deshacer con salto directo a cualquier estado, versiones del proyecto y copias automáticas.
- **Animación**, procesamiento por lotes, grabación de sesión y exportación a PNG, JPG, WebP, GIF/APNG, SVG y más.
- **IA como asistente, nunca obligatoria**: referencias, poses, paletas, limpieza de línea. Se puede desactivar por completo desde el botón de la cabecera y la app queda 100 % manual (sin asistente, sin modelos, sin conexiones).

## Desarrollo

Requisitos: Node.js 20+ y npm.

```bash
npm install
npm run dev        # Vite + Electron con recarga en caliente
npm run lint       # comprobación de tipos (tsc --noEmit)
npm run build      # compila Electron y genera dist/
npm start          # build + abrir la app
npm run check      # batería local de comprobaciones (ver abajo)
```

## Comprobaciones locales

`npm run check` compila la app y la abre de verdad en Electron (perfil temporal, sin tocar tus proyectos) para hacer las operaciones críticas y comprobar el resultado. Tarda unos 3 minutos y no necesita servicios externos.

| Grupo | Qué comprueba |
| --- | --- |
| `historial` | Deshacer/rehacer con píxeles reales, varios trazos, deshacer inmediato tras un trazo, crear/borrar capas. |
| `archivo` | Guardar un `.drawing` con varias capas, reabrirlo y comparar píxeles; volver a guardar sobre el mismo archivo. |
| `exportar` | PNG, JPG, WebP, BMP, SVG y PDF: formato, tamaño y que el dibujo no salga en blanco. |
| `reproduccion` | Cada paso queda registrado, en orden, y el último fotograma contiene el dibujo. |
| `tipos` | Los cuatro tipos de proyecto abren sin errores; el pincel dibuja en dibujo y pixel art. |
| `rendimiento` | Lienzo de 12 MP con 5 capas: trazos fluidos y sin bloqueo al soltar. |

```bash
npm run check -- historial archivo   # solo algunos grupos
node scripts/check.cjs --no-build    # reutiliza el build existente
```

Sale con código distinto de 0 si algo falla. Los diálogos de abrir/guardar se responden solos (`scripts/check/electron-entry.cjs`).

## Empaquetado (Windows)

```bash
npm run package    # instalador NSIS y versión portable en release/
```

Genera `SCHIZZO-STUDIO-Setup-<versión>.exe` y `SCHIZZO-STUDIO-Portable-<versión>.exe`. La configuración está en `electron-builder.yml` (también define objetivos para macOS y Linux).

## Rendimiento

- La interfaz carga solo lo necesario al arrancar; paneles, diálogos, el visor 3D y la detección de pose se descargan bajo demanda.
- Al soltar un trazo, las capas se copian al instante y su codificación (historial y reproducción) se hace en un Web Worker, para que dibujar siga fluido incluso con lienzos de 12 MP y varias capas.

## Estructura

```
electron/        proceso principal de Electron
src/components/  interfaz (lienzo, capas, filtros, paneles…)
src/services/    lógica: capas, filtros, historial, reproducción, exportación…
src/store/       estado global (Zustand)
```

## Licencia

MIT
