# Registro de cambios

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Este proyecto sigue
[versionado semántico](https://semver.org/lang/es/): mientras la versión sea `0.y.z`, cualquier cosa
puede cambiar sin previo aviso (ver "Versionado" en [README.md](README.md)).

## [Sin publicar]

### Añadido
- Identidad visual "tinta y papel": paleta cálida casi monocroma con un único acento vermellón, en
  vez del azul genérico de antes, en modo oscuro y claro (`src/styles/variables.css`).
- Navegación reorganizada por categorías: los 19 paneles laterales se agrupan en 6 secciones
  (Pintura, Color y recursos, Aprender, Proyecto, Producción, Sistema) y funcionan como acordeón
  (uno abierto a la vez) en vez de apilarse sin orden; la cabecera y la caja de herramientas se
  agruparon en bloques con separadores en vez de una fila plana de iconos.
- "Enviar comentario": un diálogo (cabecera y pantalla de inicio) para que los testers manden
  feedback con el diagnóstico incluido (versión, tipo de proyecto, últimos errores de la sesión) y,
  opcionalmente, una miniatura del lienzo — siempre visible antes de copiar, guardar o enviar por
  email, nunca automático.

### Arreglado
- Boceto a lápiz: el control "Oscuridad" rompía la cancelación que hace que las zonas planas salgan
  en blanco (papel), así que un relleno plano oscuro salía como una mancha gris sólida en vez de
  blanco con el contorno en grafito. Encontrado revisando visualmente cada filtro artístico con
  sus valores por defecto reales, no solo comprobando que no fallaran.
- Los paneles laterales tenían una altura máxima fija en vez de usar el espacio real de la
  ventana, así que aparecía scroll interno mucho antes de agotar la pantalla; y la fila de iconos
  de cada capa (Capas) no envolvía, saliéndose del ancho del panel con una capa con máscara
  seleccionada. Corregido en ambos sitios, más tres barras de pestañas que ya admitían con
  `overflow-x-auto` que no cabían, y el panel de Filtros (el único que apilaba sus 16 categorías a
  la vez) dividido en 10 pestañas.
- El botón "Email" del diálogo de comentario no abría nada: dependía de que Windows tuviera
  registrado un cliente de correo que funcionara, y en la práctica el registrado (la app "Correo"
  integrada) no lo hacía — confirmado comprobando que no aparecía ninguna ventana nueva, no
  suponiéndolo. Añadido un segundo botón, "Gmail", que abre el correo en el navegador en vez de
  depender de un cliente instalado — mucho más probable que funcione en cualquier equipo.

### Comprobado
- Revisión visual de los 15 filtros artísticos y atmosféricos (óleo, carboncillo, posterizar,
  sepia, bordes, resplandor, boceto a lápiz, cómic/cel-shading, mosaico, cristalizar, niebla,
  polvo, humo, lluvia) con los valores por defecto reales de cada panel, no solo con "no falla".
  De paso se encontró que la propia comprobación automática de niebla/polvo/humo/lluvia llevaba la
  escala de "densidad" equivocada (una fracción 0–1 en vez del valor bruto 0–100 que usa el panel),
  corregido.
- Dos grupos nuevos en `npm run check`: `asistente` (las 8 funciones de IA que en realidad son
  proceso local, sin modelo ni red — limpieza, composición, separar capas, paletas, ajuste del
  maniquí, prompts de referencia, reiluminado, interpretación de texto) e `ia-generativa` (generar
  imagen, probar conexión y reescribir texto contra un servidor mock local, sin API de pago,
  incluyendo que nada se llama con la IA desactivada).
- Nuevo `npm run check:pose`, aparte de la batería principal porque necesita red la primera vez:
  descarga el modelo MoveNet real, lo deja en caché en disco y detecta sobre una figura de prueba.
- Linux probado de verdad (Ubuntu 24.04 sobre WSL2, kernel real): `npm run check` y el AppImage
  (nuevo `npm run check:linux`). 45/46 comprobaciones pasan; la de rendimiento falla solo por una
  limitación identificada de ese entorno concreto (Chromium cae a render por software al faltarle
  el driver Vulkan D3D12 de Mesa bajo WSLg), no por la app. Sin confirmar en Linux con GPU real.
- macOS sigue sin probarse: solo puede compilarse desde un Mac, y montar un runner de macOS en la
  nube habría significado la infraestructura de CI que este proyecto ha decidido no usar.
- Nuevo grupo `feedback`: copiar y guardar el diálogo de comentario funcionan de verdad
  (portapapeles, archivo), la miniatura opcional se genera, y se puede abrir sin ningún proyecto.

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
