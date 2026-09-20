import { DocPage } from '@/types/learning';

/** Written from the actual, verified feature set of this app — not generic placeholder
 * documentation. Every claim here matches real, working functionality. */
export const DOC_PAGES: DocPage[] = [
  {
    id: 'tools',
    title: 'Herramientas de dibujo',
    category: 'Fundamentos',
    content: [
      'La barra de herramientas de la izquierda tiene: Pincel (B), Borrador (E), Selección (M), Bote de pintura (G), Texto (T), Gotero (I), Pluma (P), Transformar (V), Zoom (Z) y Mano (H).',
      'Cada herramienta tiene sus propias opciones debajo de la barra: tamaño, dureza, opacidad, espaciado y dispersión para el pincel; modo de fusión y patrones para el bote de pintura.',
      'El bote de pintura puede rellenar con color sólido, con un patrón predefinido, con un patrón personalizado importado, o con un degradado de la Biblioteca de assets.',
      'Debajo de los dos swatches de color primario/secundario hay un selector de color avanzado (HSV completo con campo hexadecimal) y un selector rápido de paletas predefinidas.',
    ],
  },
  {
    id: 'layers',
    title: 'Capas',
    category: 'Fundamentos',
    content: [
      'Cada capa es un lienzo independiente que se combina con las demás según su opacidad, modo de fusión y visibilidad.',
      'Podés agrupar capas, agregarles una máscara de opacidad pintable, y usar capas de ajuste o de relleno (sólido, degradado o patrón) que no ocupan espacio de píxeles propio.',
      'El botón "Importar imagen de referencia" del panel de Capas trae una imagen como capa de referencia (distinta de una capa normal) — pensada para calcar o comparar mientras dibujás encima.',
      'El historial de deshacer/rehacer cubre casi todas las acciones — no hay riesgo en experimentar.',
    ],
  },
  {
    id: 'color-tools',
    title: 'Herramientas de color',
    category: 'Color',
    content: [
      'Simulador de daltonismo: muestra cómo se ven tus colores primario y secundario en protanopia, deuteranopia, tritanopia y monocromacía. Para simular el lienzo completo, usá el filtro "Daltonismo" en el panel de Filtros.',
      'Generador de armonías: a partir de tu color primario, genera complementarios, análogos, tríadas, tetradas y más.',
      'Extractor de paletas: obtiene los colores dominantes de la capa actual o de una imagen importada (k-means o colores dominantes), exportables como JSON, CSS, GPL o Tailwind.',
      'Conversor de espacios de color: RGB, HSL, HSV, LAB y CMYK del mismo color, todos sincronizados.',
      'Verificador de accesibilidad: calcula el ratio de contraste WCAG entre dos colores y sugiere alternativas si no pasa AA/AAA.',
    ],
  },
  {
    id: 'asset-library',
    title: 'Biblioteca de assets',
    category: 'Color',
    content: [
      'Pinceles: reutiliza tu librería de pinceles real, con búsqueda y favoritos.',
      'Patrones: además de los patrones predefinidos, podés importar una imagen como patrón personalizado y aplicarlo en mosaico.',
      'Degradados: predefinidos (arcoíris, atardecer, océano, monocromo) o creados por vos con varios puntos de color, aplicables directamente a la capa o selección actual.',
      'Texturas: importá imágenes y aplicalas en mosaico o estiradas sobre la capa o selección.',
      'Todo lo que guardás en la biblioteca persiste entre sesiones — no se pierde al cerrar la app.',
    ],
  },
  {
    id: 'animation',
    title: 'Animación',
    category: 'Animación',
    content: [
      'Activá la animación desde el panel "Animación" para empezar a trabajar con cuadros (frames). Cada cuadro guarda su propio conjunto de capas.',
      'Onion skin configurable: cantidad de cuadros hacia atrás/adelante, opacidad, y un modo de teñido rojo/azul para distinguir la dirección.',
      'Generación de intermedios: crea cuadros de transición (crossfade) entre el actual y el siguiente, con distintas curvas de aceleración.',
      'Exportación como GIF, APNG, secuencia de PNG, WebM o spritesheet.',
    ],
  },
  {
    id: 'model3d',
    title: 'Modelos 3D',
    category: 'Referencia',
    content: [
      'Importá modelos .glb, .gltf u .obj como referencia de pose y perspectiva — desde el diálogo "Insertar modelo 3D" o el panel flotante "Referencia 3D".',
      'Podés orbitar la cámara, cambiar la iluminación (dirección e intensidad), activar wireframe, y — si el modelo tiene un esqueleto — posar sus huesos manualmente.',
      'La opción "Extraer silueta" convierte la vista actual del modelo en una capa nueva, lista para calcar.',
    ],
  },
  {
    id: 'batch',
    title: 'Procesamiento por lotes',
    category: 'Productividad',
    content: [
      'Importá varias imágenes a la vez y aplicales el mismo redimensionado (exacto, ajustar o llenar), los mismos filtros (brillo, contraste, saturación, sepia, escala de grises, invertir) y el mismo formato de salida.',
      'Al terminar, exportá todos los resultados de una vez a una carpeta.',
    ],
  },
  {
    id: 'comic',
    title: 'Cómic y manga',
    category: 'Cómic',
    content: [
      'Todas las herramientas de cómic/manga funcionan igual: hacé una selección rectangular en el lienzo con la herramienta de Selección y después tocá "Insertar" — no hay overlays nuevos que aprender, reutilizan la selección que ya existe. La única excepción son las plantillas de página, que no necesitan selección porque ocupan todo el lienzo.',
      'Tramas (screentone): patrones de puntos característicos del manga en blanco y negro, con distintas densidades.',
      'Plantillas de página: grilla 2×2, grilla 2×3, página completa, página de título y doble página.',
      'Líneas de velocidad: el efecto clásico de movimiento/impacto, radiales desde un punto que elegís.',
      'Globos de diálogo: diálogo, pensamiento, grito, susurro y narración — cada uno con su propia forma de borde.',
    ],
  },
  {
    id: 'workspace',
    title: 'Espacio de trabajo flotante',
    category: 'Productividad',
    content: [
      'Por defecto la app usa un layout fijo (herramientas a la izquierda, panel a la derecha). El espacio de trabajo flotante es un modo alternativo, opcional, con paneles que podés arrastrar, acoplar y reordenar a tu gusto.',
      'Trae 6 presets de layout ya armados: pintura digital, dibujo de cómic, concept art, diseño de UI, pixel art y animación — cada uno acomoda los paneles relevantes para ese tipo de trabajo.',
      'Es un modo aparte del layout clásico, no los dos a la vez — podés volver al layout fijo cuando quieras.',
    ],
  },
  {
    id: 'resize',
    title: 'Redimensionado inteligente',
    category: 'Fundamentos',
    content: [
      'A diferencia de un redimensionado normal (que estira o recorta), este remueve o agrega las "costuras" (seams) de píxeles menos importantes de la imagen — la técnica se llama seam carving y permite achicar o agrandar el lienzo con menos distorsión en las zonas con más detalle.',
      'Si el proyecto tiene animación activada, el redimensionado se aplica a todos los cuadros, no solo al actual.',
      'Es un proceso más lento que un escalado simple, especialmente en lienzos grandes — la app te avisa y muestra el progreso cuando va a tardar.',
    ],
  },
  {
    id: 'importing',
    title: 'Importar archivos',
    category: 'Fundamentos',
    content: [
      'Importar imagen: acepta PNG, APNG, JPG, WebP, AVIF, BMP, GIF, SVG y TIFF — se agrega como capa nueva.',
      'Importar Krita (.kra): abre un proyecto de Krita conservando sus capas.',
      'La Biblioteca de assets y el Procesamiento por lotes tienen sus propios botones de importar, independientes de estos — para traer patrones, texturas o imágenes a procesar en lote.',
    ],
  },
  {
    id: 'filters',
    title: 'Filtros',
    category: 'Fundamentos',
    content: [
      'Casi todos los filtros funcionan igual: ajustás los parámetros y ves una vista previa en vivo antes de tocar "Aplicar" (o "Cancelar" para descartarla). Invertir, Escala de grises y Canales son la excepción — se aplican al instante, sin vista previa.',
      'Ajustes de color: brillo, contraste, saturación y tono (hue).',
      'Desenfoque: radio ajustable, con un modo "gaussiano" además del desenfoque simple.',
      'Distorsión: desenfoque de movimiento (distancia + ángulo), enfocar (sharpen), pixelar y ruido.',
      'Efectos artísticos: óleo, carboncillo, posterizar, sepia, detección de bordes y resplandor (bloom).',
      'Pixel art: cuantizar a una paleta, dithering, y "ciclado de color" — rota un rango de colores de la paleta y genera cuadros de animación reales con el resultado (aparecen en el panel de Animación).',
      'Atmósfera: niebla, polvo, humo y lluvia, cada uno con su propio color y densidad.',
      'Daltonismo: simula cómo se ve la capa completa en protanopia, deuteranopia, tritanopia o monocromacía — a diferencia del simulador de Herramientas de color, que solo compara dos swatches.',
      'Canales: aísla el canal rojo, verde, azul o alfa de la capa como una imagen en escala de grises.',
    ],
  },
  {
    id: 'history-panel',
    title: 'Historial',
    category: 'Fundamentos',
    content: [
      'Muestra la lista completa de acciones deshacer/rehacer con su nombre (por ejemplo "Óleo" o "Trazo de pluma"), resaltando en qué punto del historial estás.',
      'Es una vista de solo lectura: para moverte por el historial usá Ctrl+Z / Ctrl+Shift+Z, no hace falta hacer clic en la lista.',
    ],
  },
  {
    id: 'histogram',
    title: 'Histograma',
    category: 'Fundamentos',
    content: [
      'Muestra la distribución de brillo (o de un canal de color específico: rojo, verde o azul) de la capa actual, ignorando los píxeles totalmente transparentes.',
      'Incluye media, mediana, desviación estándar y rango (mínimo–máximo) del canal elegido — útil para chequear el contraste antes de exportar.',
      'Se recalcula solo, cada vez que cambiás de capa o hacés una edición.',
    ],
  },
  {
    id: 'brush-editor',
    title: 'Editor de pinceles',
    category: 'Fundamentos',
    content: [
      'Se abre con "Editar" debajo de la grilla de pinceles, en la barra de herramientas.',
      'Siete controles: tamaño, dureza, opacidad, espaciado, dispersión, variación de ángulo y variación de tamaño — con vista previa en vivo del trazo.',
      '"Guardar como nuevo" clona la configuración actual como un pincel nuevo en la librería (no sobrescribe el que estabas editando).',
      'Exportar/importar como archivo .brush — solo disponible en la app de escritorio.',
    ],
  },
  {
    id: 'text-tool',
    title: 'Herramienta de texto',
    category: 'Fundamentos',
    content: [
      'Hacé clic en el lienzo para escribir — aparece una caja de texto flotante con el color primario activo.',
      'Cuatro efectos disponibles: Normal, Relieve (emboss), Sombra larga y Neón.',
      'Enter aplica el texto a la capa actual; Escape lo cancela.',
      'El tamaño de fuente y la alineación no son ajustables desde la interfaz todavía.',
      'También podés escribir texto siguiendo una curva: activá "Texto en trazo" mientras usás la herramienta Pluma.',
    ],
  },
  {
    id: 'pen-tool',
    title: 'Herramienta de pluma',
    category: 'Fundamentos',
    content: [
      'Una herramienta de trazado vectorial: cada clic agrega un punto y arma una curva bezier, no una selección de lazo.',
      'Si cerrás el trazado, podés rellenarlo con el color secundario; el borde siempre se traza con el color primario y el ancho del pincel actual.',
      '"Texto en trazo" cambia la barra a un campo de texto + tamaño: al aplicar, el texto sigue la curva del trazado en vez de ir en línea recta.',
      'Enter termina/aplica el trazado, Escape lo cancela.',
    ],
  },
  {
    id: 'transform-tool',
    title: 'Herramienta de transformar',
    category: 'Fundamentos',
    content: [
      'Muestra un cuadro sobre la capa o selección actual: arrastrá el centro para mover, las esquinas para redimensionar, y el mango de arriba para rotar libremente (sin ángulos fijos).',
      'Enter aplica los cambios, Escape los cancela.',
      'No incluye voltear ni espejar — solo mover, escalar y rotar.',
    ],
  },
  {
    id: 'export-formats',
    title: 'Formatos de exportación',
    category: 'Fundamentos',
    content: [
      'Siete formatos disponibles: PNG, JPG, WebP, AVIF, BMP, TIFF y SVG. JPG/WebP/AVIF muestran un control de calidad (10–100%); los demás no lo necesitan.',
      'WebP: alrededor de un 30% más liviano que PNG con calidad similar.',
      'AVIF: alrededor de un 50% más liviano que PNG — formato más nuevo, con menos compatibilidad.',
      'BMP: sin compresión, pensado para compatibilidad con software antiguo.',
      'TIFF: sin compresión, con canal alfa — para impresión profesional.',
      'SVG: es la imagen aplanada envuelta en un archivo SVG, no es vectorial editable — esta app trabaja en píxeles, no en formas.',
    ],
  },
  {
    id: 'shortcuts',
    title: 'Atajos de teclado',
    category: 'Fundamentos',
    content: [
      'Generales: Ctrl+Z deshacer, Ctrl+Shift+Z rehacer, Ctrl+S guardar, Ctrl+Shift+S guardar como, Ctrl+N nuevo proyecto, Ctrl+O abrir proyecto, Ctrl+E exportar, Ctrl+\' mostrar/ocultar cuadrícula.',
      'Herramientas: B pincel, E borrador, M selección, G bote de pintura, T texto, I gotero, P pluma, V transformar, Z zoom, H mano.',
      'D intercambia los colores primario y secundario. Las teclas [ y ] reducen/aumentan el tamaño del pincel.',
      'Contextuales: Enter aplica (transformar, texto, trazado de pluma); Escape cancela; Delete/Backspace borra los píxeles de la selección activa.',
      'Solo en el espacio de trabajo flotante: Alt+1 a Alt+6 cargan cada preset de layout, Ctrl+\` cicla el zoom de la interfaz, Ctrl+Shift+T cicla el tema (oscuro/claro/auto).',
    ],
  },
  {
    id: 'art-brushes',
    title: 'Pinceles de arte y texturas',
    category: 'Estudio',
    content: [
      'El selector de pinceles se organiza por categorías: Dibujo (lápices, carboncillo, grafito, Conté), Tinta, Pintura (acuarela, óleo, gouache, acrílico), Medios secos (pastel, tiza, crayón), Digital (aerógrafo, marcadores) y Textura (esponja, punteado, sombreado, follaje).',
      'Las texturas de estos pinceles se generan por código: imitan el aspecto de cada medio, pero no son simulaciones físicas (no hay difusión de pigmento ni mezcla en húmedo).',
      'Los pinceles de medios secos giran según la dirección del trazo y reaccionan a la presión de la tableta. Puedes ajustarlos, guardarlos como propios o importar/exportar pinceles .brush desde el editor de pinceles.',
    ],
  },
  {
    id: 'mannequin',
    title: 'Maniquí 3D, animales y objetos',
    category: 'Estudio',
    content: [
      'En el visor 3D y en la ventana de Referencia 3D encontrarás la sección «Maniquí de referencia»: figura humana de 8 tipos de cuerpo, perro, gato y caballo.',
      'Cada articulación tiene sus tres giros con los rangos de una articulación real. Puedes elegir poses predefinidas, una pose aleatoria plausible o espejar la pose. Las manos tienen posiciones predefinidas y un control por dedo; el rostro tiene expresiones y sliders de cejas, ojos y boca.',
      'La ropa (camiseta, pantalón, sombrero, gafas, mochila, capa) y los objetos de escena (muebles, coche, casa, espada, guitarra…) son volúmenes simplificados para estudiar proporciones y perspectiva, no modelos detallados. También puedes importar tus propios .glb, .gltf, .obj u .fbx (con esqueleto y texturas; las animaciones del archivo se ignoran).',
      'La iluminación admite dirección, intensidad, temperatura de color en Kelvin, contraluz, sombras proyectadas y una vista de valores en gris para estudiar luz y sombra. La perspectiva de cámara se controla con el ángulo de visión y presets de vista.',
    ],
  },
  {
    id: 'study-panel',
    title: 'Panel Estudio: guías, tutor y academia',
    category: 'Estudio',
    content: [
      'Guías: superpone al lienzo, sin tocar tus capas, proporciones de rostro (frente y perfil), figura en cabezas, asistente de elipses, mano, perspectiva curvilínea, habitación y edificio. Incluye una regla para medir distancias y ángulos (con conversión a cabezas si hay una guía de figura) y acceso a las cuadrículas de composición y a la perspectiva.',
      'Analizar («¿Por qué no funciona?»): mide valores, reparto del peso visual, simetría, inclinación de las líneas dominantes y dispersión del color, y explica lo que ve con una sugerencia. Nunca modifica el dibujo. Es un análisis de la imagen: no reconoce anatomía ni rostros.',
      'Academia: ejercicio del día, plan de estudio por tema (el asistente interpreta frases como «retrato durante este mes»), práctica de poses aleatorias con temporizador, ejercicios de memoria visual, retos y progreso. La dificultad se ajusta según cómo valores cada ejercicio; la app no puntúa tus dibujos.',
      'Estilos: biblioteca de tradiciones visuales (japonesa, china, coreana, renacentista, barroca, impresionismo, cómic, manga, concept art…) con los recursos que conviene observar y un ejercicio de práctica. Sirve para estudiar, no para convertir tu dibujo a un estilo.',
    ],
  },
  {
    id: 'pigments',
    title: 'Mezcla de pigmentos',
    category: 'Color',
    content: [
      'En Herramientas de color → Pigmentos, dos colores se mezclan como pintura: azul con amarillo da verde, rojo con amarillo da naranja. Junto a la mezcla verás el resultado de mezclar luz (RGB) para comparar.',
      'Es una aproximación en espacio RYB, con blancos, negros y grises mezclados de forma neutra; no simula el comportamiento espectral de pigmentos concretos.',
    ],
  },
  {
    id: 'smart-fill-smudge',
    title: 'Relleno inteligente y mezclador de color',
    category: 'Herramientas',
    content: [
      'Bote de pintura → «Relleno inteligente»: detecta el área en todas las capas (para colorear en una capa bajo el line art), cierra huecos del contorno de hasta unos 2× el valor de «Cerrar huecos» y expande el color bajo la línea para no dejar un halo claro.',
      'Mezclador de color (tecla N): arrastra el color como pintura fresca. «Fuerza de arrastre» controla cuánto se arrastra y «Carga de color» va añadiendo el color principal mientras mezclas.',
      'Los pinceles admiten sensibilidad a la presión, inclinación del lápiz (ancho de la punta), giro según la dirección del trazo y estabilizador (suavizado). Puedes importar varias imágenes PNG/JPG a la vez como puntas de pincel. Desde el editor de pinceles se importan librerías .abr de Photoshop (todas las versiones), pinceles .brush de Procreate y presets .kpp de Krita: puntas, tamaño, espaciado, dispersión y dinámicas de presión. En el .abr moderno la textura de papel y el pincel dual se integran de forma aproximada en la punta; los bordes húmedos y el ruido no se importan. Procreate (.brush) y los paquetes de Krita (.bundle, con sus puntas .gbr/.gih/.png) se han verificado con archivos reales; se importan tamaño, espaciado, presión, orientación y dispersión, y el grano de Procreate se integra en la punta. En Krita se importan además las curvas de sensibilidad, los pinceles animados (.gih, con todos sus fotogramas, al azar o en orden), los borradores y los modos de fusión (que se aplican una vez por trazo, como en Krita). No se importan las texturas de Krita (sus imágenes no vienen en el paquete), ni motores que no son de pincel (difuminar, deformar, clonar). Un .kpp suelto necesita que selecciones a la vez sus ficheros de punta (.gbr/.gih/.png). Los .abr antiguos (v1/v2) siguen sin probarse con un archivo real: su lectura sigue el formato del código de GIMP.',
    ],
  },
  {
    id: 'perspective-tools',
    title: 'Perspectiva: guías, generador y detección automática',
    category: 'Estudio',
    content: [
      'En Estudio → Guías hay perspectiva curvilínea de 5 puntos, un generador de habitación de 1 punto con suelo y techo en baldosas, y un asistente de edificio de 2 puntos con plantas y columnas. Se mueven, giran y escalan; se guardan con el proyecto.',
      'En Estudio → Analizar, «Detectar puntos de fuga» busca líneas rectas que convergen y propone hasta dos puntos, que puedes colocar en la cuadrícula de perspectiva. Necesita líneas de construcción claras (edificios, habitaciones, calles): en dibujos orgánicos no encontrará nada.',
    ],
  },
  {
    id: 'modes-export',
    title: 'Modos de estudio, referencias en internet y PSD',
    category: 'Estudio',
    content: [
      'Estudio → Modos: mesa de artista (abre lienzo, referencias, paleta, modelo 3D y capas), modelo vivo (la cámara orbita el modelo mientras dibujas), estudio de anatomía (piel, músculos y esqueleto simplificados), pose aleatoria con temporizador y modo espejo automático (voltea el lienzo cada cierto tiempo).',
      'Referencias → «Buscar referencias en internet» busca imágenes libres en Wikimedia Commons y las guarda con su licencia como etiqueta. Requiere conexión.',
      'Exportar → PSD guarda las capas de píxeles (nombre, posición, opacidad, visibilidad y modo de fusión) más la imagen combinada. No incluye máscaras, capas de ajuste ni estilos de capa.',
    ],
  },
  {
    id: 'versions-undo',
    title: 'Versiones del proyecto, comparación y deshacer',
    category: 'Proyecto',
    content: [
      'El panel «Versiones» guarda copias completas del proyecto (capas, máscaras y ajustes) que sobreviven al cierre de la app: puedes volver a «la versión del martes». Se crea un «Estado inicial» automático la primera vez que abres un proyecto, una versión automática cada vez que guardas y otra cada 10 minutos de trabajo (se conservan las 20 últimas automáticas). Antes de restaurar una versión, tu estado actual se guarda para no perderlo.',
      'Comparar enfrenta dos versiones (o la versión inicial y el estado actual) con un deslizador, lado a lado, parpadeo o un mapa de diferencias que indica qué porcentaje de la imagen cambió.',
      'El deshacer/rehacer no tiene límite fijo: los estados recientes están en memoria y los antiguos se guardan en disco, así que la única cota es el espacio libre. El historial es de la sesión y se vacía al cerrar.',
    ],
  },
  {
    id: 'export-pdf-svg',
    title: 'Exportar a PDF y SVG vectorial',
    category: 'Proyecto',
    content: [
      'PDF: una página con el tamaño físico que corresponde a los DPI del proyecto (300 DPI para imprimir), con la imagen en JPEG o sin pérdida. Las transparencias se aplanan sobre el color de fondo.',
      'SVG: además de incrustar la imagen aplanada, puedes vectorizar. Cada capa se traza en formas de color plano (con huecos) y se escribe como su propio grupo, con su opacidad, visibilidad y modo de fusión, para editarla en Inkscape, Illustrator o Figma. Es un trazado automático: los degradados pasan a bandas de color, las transparencias parciales se vuelven opacas y la textura fina se pierde.',
    ],
  },
  {
    id: 'figure-analysis',
    title: 'Figura: proporciones, anatomía y errores de perspectiva',
    category: 'Estudio',
    content: [
      'Estudio → Figura: marca sobre tu dibujo 14 puntos (coronilla, barbilla, hombros, codos, muñecas, caderas, rodillas, tobillos) y la app mide la altura en cabezas, piernas y brazos, anchura de hombros, inclinación de cabeza, hombros y caderas, y si el centro de gravedad cae sobre los pies. Compara con el canon del tipo de figura elegido (adulto, héroe, niño o estilizado sin canon) y puede superponer una guía de figura para comparar.',
      'Las medidas son del plano de la imagen: un brazo hacia la cámara o una figura de perfil dan valores engañosos. La colocación automática de puntos usa un modelo de pose (se descarga una vez, 12 MB, y queda en tu equipo) que solo reconoce figuras realistas, sombreadas o pintadas: no bocetos de línea ni formas planas. En un adulto frontal la altura sale con ~3-4 % de error; en niños no es fiable. Si falla, coloca los puntos a mano.',
      'Estudio → Analizar → Perspectiva automática: además de proponer los puntos de fuga, marca en verde las líneas que convergen y en rojo las que no, con el ángulo que se desvían y hacia qué lado girarlas.',
    ],
  },
  {
    id: 'left-handed',
    title: 'Modo zurdo',
    category: 'Interfaz',
    content: [
      'El botón de la mano en la barra superior invierte la disposición: las herramientas pasan a la derecha y los paneles y sus pestañas a la izquierda. Se recuerda entre sesiones. No afecta al espacio de trabajo flotante.',
    ],
  },
];

