# Registro de cambios

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Este proyecto sigue
[versionado semántico](https://semver.org/lang/es/): mientras la versión sea `0.y.z`, cualquier cosa
puede cambiar sin previo aviso (ver "Versionado" en [README.md](README.md)).

## [Sin publicar]

Nada todavía.

## [0.1.0] - 2026-09-22

Primera instantánea de desarrollo etiquetada. No es un lanzamiento público: el instalador de
Windows no está firmado (ver "Firma de código" en el README) y macOS/Linux no se han probado de
verdad. Resume todo el trabajo hecho hasta ahora, no solo el de esta versión.

### Dibujo y pinceles
- Biblioteca amplia de pinceles, con importación real de `.abr` (v1/v2, roundness, ángulo, ruido,
  bordes húmedos), `.brush`/`.brushset` de Procreate y `.kpp`/`.bundle` de Krita (incluidas texturas,
  motor de experimentación, smudge, deform, clone y curvas de presión).
- Herramientas de línea y curva con afilado al soltar, para lineart limpio.
- Flujo (*flow*) por trazo, con opacidad y modo de mezcla aplicados una sola vez por trazo.
- Rueda de color RYB/RGB con armonías, mezclador de color por pigmento (RYB) y otro por arrastre
  (smudge).
- Regla de dibujo a mano alzada (recta, paralelas, elipse, perspectiva).

### Capas
- Capas vectoriales editables (formas, texto en vivo, trazados con pluma) hasta que se rasterizan.
- Capas de ajuste y de relleno, máscaras, recorte, grupos, modos de mezcla y efectos no destructivos.
- Un segundo foco de luz en el visor 3D (lámpara, foco o relleno suave) con su propia temperatura
  de color.

### 3D y estudio
- Maniquí 3D posable (pies y tobillos incluidos), 12 especies de animales, prendas y más de 50
  objetos.
- Análisis de proporciones y anatomía de la figura, con puntos de referencia manuales o
  automáticos (incluida detección en line art probando versiones recortadas, rellenas y sombreadas).
- Guías de estudio (rostro, figura, elipse, mano, curvilínea, habitación, edificio) guardadas con
  el proyecto; perspectiva automática que marca las líneas que fallan un punto de fuga.
- Panel de Estudio: tutor de dibujo, academia, biblioteca de estilos y modos de práctica.
- Horizonte ajustable, referencias por proyecto y globales, ventana de referencia flotante,
  comparación con el dibujo y búsqueda de referencias en Wikimedia Commons.

### Cómic / Manga
- Plantillas de viñetas, tramas (screentone) y globos de texto.

### Animación
- Onion skin, interpolación de fotogramas intermedios y exportación a GIF/APNG.

### Historial y reproducción del proceso
- Deshacer/rehacer sin límite práctico (los estados antiguos se mueven a IndexedDB).
- Historial de versiones del proyecto, con comparación antes/después.
- Reproducción del proceso paso a paso, exportable como timelapse WebM.
- El guardado del historial y de la reproducción se codifica en un Web Worker en segundo plano,
  para no bloquear la interfaz tras un trazo en lienzos grandes.

### Exportación
- PNG, JPG, WebP, AVIF, BMP, TIFF, PSD por capas, PDF, GIF/APNG y SVG vectorial real (trazado por
  capas, no solo una imagen incrustada).

### IA como asistente opcional
- Asistente de IA (referencias, poses, paletas, limpieza de línea) que nunca dibuja por ti, con un
  interruptor maestro que la desactiva del todo — la app queda 100 % manual, sin llamadas de red.

### Accesibilidad y ergonomía
- Modo de disposición para zurdos.

### Rendimiento
- Carga bajo demanda de paneles, diálogos, el visor 3D y la detección de pose (chunk principal
  reducido en más de un 55 %).
- Historial y reproducción del proceso ya no bloquean el hilo principal al soltar un trazo, ni
  siquiera en lienzos de 12 MP con varias capas.

### Calidad
- Batería local de comprobaciones (`npm run check`, 46 comprobaciones) que abre la app real en
  Electron y compara píxeles: historial, guardar/abrir, exportar, reproducción, los cuatro tipos
  de proyecto, capas, filtros, selección, pixel art, cómic, animación, paneles e IA.
- Comprobación del instalador (`npm run check:installer`): instala en silencio, prueba la app
  instalada, desinstala y verifica que no queda nada; repite con la versión portable.
