import { Tour } from '@/types/learning';

/** Every selector here targets a real button in the app (verified against the actual title
 * attributes in Header.tsx, Toolbox.tsx and Sidebar.tsx) — not a placeholder class name that
 * happens to not exist in the DOM. */
export const TOURS: Tour[] = [
  {
    id: 'getting-started',
    name: 'Primeros pasos',
    description: 'Un recorrido rápido por lo esencial: crear un proyecto, dibujar, capas y guardar.',
    steps: [
      {
        selector: 'button[title="Nuevo proyecto (Ctrl+N)"]',
        title: 'Crear un proyecto',
        description: 'Desde acá creás un lienzo nuevo, eligiendo tamaño o un preset (pixel art, HD, A4).',
      },
      {
        selector: 'button[title="Pincel (B)"]',
        title: 'El pincel',
        description: 'Tu herramienta principal para dibujar. Tiene tamaño, dureza, opacidad y espaciado configurables más abajo en esta barra.',
      },
      {
        selector: 'button[title="Bote de pintura (G)"]',
        title: 'Bote de pintura',
        description: 'Rellena una zona con el color o patrón activo — probá también los patrones y degradados desde la Biblioteca de assets.',
      },
      {
        selector: 'button[title="Selección (M)"]',
        title: 'Selección',
        description: 'Delimita una zona del lienzo para que los demás cambios solo la afecten a ella.',
      },
      {
        selector: 'button[title="Capas"]',
        title: 'Capas',
        description: 'Organizá tu dibujo en capas independientes — como hojas transparentes apiladas que podés reordenar, ocultar o mezclar.',
      },
      {
        selector: 'button[title="Deshacer (Ctrl+Z)"]',
        title: 'Deshacer y rehacer',
        description: 'Todo lo que hacés queda en el historial — no dudes en experimentar, siempre podés volver atrás.',
      },
      {
        selector: 'button[title="Guardar (Ctrl+S)"]',
        title: 'Guardar tu proyecto',
        description: 'Guarda el proyecto completo (capas, animación, todo) en un archivo que podés volver a abrir después.',
      },
      {
        selector: 'button[title="Exportar (Ctrl+E)"]',
        title: 'Exportar tu trabajo',
        description: 'Elegí entre PNG, JPG, WebP, AVIF, BMP, TIFF o SVG. El SVG es la imagen aplanada envuelta en un archivo SVG, no es vectorial editable — esta app trabaja en píxeles.',
      },
    ],
  },
  {
    id: 'creative-tools',
    name: 'Herramientas creativas',
    description: 'Las herramientas más avanzadas: color, assets, filtros, animación y lotes.',
    steps: [
      {
        selector: 'button[title="Herramientas de color"]',
        title: 'Herramientas de color',
        description: 'Simulador de daltonismo, generador de armonías, extractor de paletas, conversor de espacios de color y verificador de accesibilidad (WCAG).',
      },
      {
        selector: 'button[title="Biblioteca de assets"]',
        title: 'Biblioteca de assets',
        description: 'Tus pinceles, patrones, degradados y texturas favoritos, organizados y listos para reutilizar en cualquier proyecto.',
      },
      {
        selector: 'button[title="Filtros"]',
        title: 'Filtros',
        description: 'Ajustes de color, desenfoques, efectos de pixel art, atmosféricos y más — todos con vista previa en vivo antes de aplicarlos.',
      },
      {
        selector: 'button[title="Animación"]',
        title: 'Animación',
        description: 'Dibujo cuadro por cuadro con onion skin configurable, generación de intermedios y exportación a GIF, APNG, WebM o spritesheet.',
      },
      {
        selector: 'button[title="Procesamiento por lotes"]',
        title: 'Procesamiento por lotes',
        description: 'Importá varias imágenes a la vez y aplicales el mismo redimensionado, filtro y formato de salida en un solo paso.',
      },
    ],
  },
  {
    id: 'comic-3d-workspace',
    name: 'Cómic, 3D y espacio de trabajo',
    description: 'Importar archivos, herramientas de cómic/manga, referencia 3D y el espacio de trabajo flotante.',
    steps: [
      {
        selector: 'button[title="Importar imagen"]',
        title: 'Importar una imagen',
        description: 'Trae una imagen (PNG, JPG, WebP, TIFF, BMP y más) como capa nueva o como referencia.',
      },
      {
        selector: 'button[title="Importar Krita (.kra)"]',
        title: 'Importar desde Krita',
        description: 'Abrí un archivo .kra de Krita conservando sus capas.',
      },
      {
        selector: 'button[title="Cómic / Manga"]',
        title: 'Cómic / Manga',
        description: 'Tramas (screentone), plantillas de página, líneas de velocidad y globos de diálogo — hacé una selección rectangular y usá "Insertar".',
      },
      {
        selector: 'button[title="Insertar modelo 3D"]',
        title: 'Insertar un modelo 3D',
        description: 'Cargá un modelo .glb, .gltf u .obj, orbitá la cámara y aplastalo en una capa nueva del lienzo.',
      },
      {
        selector: 'button[title="Referencia 3D flotante"]',
        title: 'Referencia 3D flotante',
        description: 'Lo mismo que el visor de modelos, pero como panel flotante que queda visible mientras seguís dibujando — no se guarda en el proyecto.',
      },
      {
        selector: 'button[title="Redimensionar (inteligente)"]',
        title: 'Redimensionado inteligente',
        description: 'Cambia el tamaño del lienzo removiendo o agregando las costuras (seams) menos importantes en vez de estirar la imagen — si tenés animación, lo aplica a todos los cuadros.',
      },
      {
        selector: 'button[title="Workspace flotante (paneles acoplables, presets)"]',
        title: 'Espacio de trabajo flotante',
        description: 'Un modo alternativo con paneles que podés mover y acoplar libremente, más 6 presets de layout (pintura digital, cómic, concept art, UI, pixel art, animación).',
      },
    ],
  },
  {
    id: 'advanced-editing',
    name: 'Historial y edición avanzada',
    description: 'El historial, el histograma, el editor de pinceles, el selector de color avanzado y las herramientas de texto, pluma y transformar.',
    steps: [
      {
        selector: 'button[title="Historial"]',
        title: 'Historial',
        description: 'Lista de solo lectura de todas las acciones deshacer/rehacer, con el punto actual resaltado — el mismo historial que usan Ctrl+Z y Ctrl+Shift+Z.',
      },
      {
        selector: 'button[title="Histograma"]',
        title: 'Histograma',
        description: 'Distribución de brillo (o de un canal de color) de la capa actual, con media, mediana, desviación estándar y rango.',
      },
      {
        selector: 'div[title="Selector de color avanzado"]',
        title: 'Selector de color avanzado',
        description: 'Un selector HSV completo (saturación/valor + tira de tono) con campo hexadecimal, debajo de los swatches de color primario/secundario.',
      },
      {
        selector: 'button[title="Editar pincel"]',
        title: 'Editor de pinceles',
        description: 'Ajustá tamaño, dureza, opacidad, espaciado, dispersión y variación de ángulo/tamaño del pincel actual, guardalo como uno nuevo, o exportalo/importalo como archivo .brush.',
      },
      {
        selector: 'button[title="Texto (T)"]',
        title: 'Texto',
        description: 'Hacé clic en el lienzo para escribir. Podés elegir el color y un efecto (Normal, Relieve, Sombra larga, Neón). Enter aplica, Esc cancela.',
      },
      {
        selector: 'button[title="Pluma (P)"]',
        title: 'Pluma',
        description: 'Trazado vectorial por puntos (curvas bezier) — cerralo para rellenarlo con el color secundario, o activá "Texto en trazo" para que un texto siga la curva.',
      },
      {
        selector: 'button[title="Transformar (V)"]',
        title: 'Transformar',
        description: 'Mové, redimensioná y rotá libremente la capa o selección actual. Enter aplica, Esc cancela. (No incluye voltear/espejar.)',
      },
      {
        selector: 'button[title^="Mostrar cuadrícula"]',
        title: 'Cuadrícula',
        description: 'Muestra u oculta una cuadrícula de referencia sobre el lienzo (Ctrl+\') — se activa sola al crear un proyecto de pixel art.',
      },
    ],
  },
];
