/**
 * Study content for the Academy: a 10-module curriculum with graded exercises, quick-fire
 * challenges, and a library of visual traditions to study. The exercises are written practice
 * prompts — the app does not grade drawings automatically; progress comes from the artist's own
 * self-assessment (Fácil / Justo / Difícil) after each exercise.
 */

export type ExerciseKind = 'gesture' | 'construct' | 'study' | 'memory' | 'draw';
export type StudyTool = 'model3d' | 'guides' | 'references' | 'analyze' | 'color';

export interface Exercise {
  id: string;
  module: string;
  title: string;
  minutes: number;
  /** 1 (beginner) .. 5 (advanced) */
  difficulty: 1 | 2 | 3 | 4 | 5;
  kind: ExerciseKind;
  goal: string;
  steps: string[];
  tool?: StudyTool;
}

export interface AcademyModule {
  id: string;
  title: string;
  /** Position in the recommended learning path. */
  order: number;
  summary: string;
}

export const MODULES: AcademyModule[] = [
  { id: 'anatomia', order: 1, title: 'Anatomía y figura', summary: 'Proporciones, gesto, masas del cuerpo y estructura.' },
  { id: 'perspectiva', order: 2, title: 'Perspectiva', summary: 'Horizonte, puntos de fuga, cajas y elipses en el espacio.' },
  { id: 'luz', order: 3, title: 'Luz y sombra', summary: 'Valores, forma de las sombras, luz de contorno y reflejos.' },
  { id: 'color', order: 4, title: 'Color', summary: 'Armonías, temperatura, saturación y mezcla.' },
  { id: 'composicion', order: 5, title: 'Composición', summary: 'Foco, equilibrio, ritmo y lectura de la imagen.' },
  { id: 'retrato', order: 6, title: 'Retrato', summary: 'Proporciones de la cabeza, rasgos y expresión.' },
  { id: 'manos', order: 7, title: 'Manos y pies', summary: 'Construcción con bloques, articulación y gesto.' },
  { id: 'ropa', order: 8, title: 'Ropa y telas', summary: 'Pliegues, tensión, gravedad y cómo la tela revela la forma.' },
  { id: 'fondos', order: 9, title: 'Fondos y entornos', summary: 'Espacio, arquitectura, planos y atmósfera.' },
  { id: 'teoria', order: 10, title: 'Teoría del arte', summary: 'Forma, línea, ritmo, unidad y variedad, y cómo estudiar a otros.' },
];

let seq = 0;
const ex = (module: string, title: string, minutes: number, difficulty: Exercise['difficulty'], kind: ExerciseKind, goal: string, steps: string[], tool?: StudyTool): Exercise => ({
  id: `${module}-${++seq}`,
  module,
  title,
  minutes,
  difficulty,
  kind,
  goal,
  steps,
  tool,
});

export const EXERCISES: Exercise[] = [
  // --- Anatomía
  ex('anatomia', 'Gestos de 30 segundos', 10, 1, 'gesture', 'Capturar el movimiento total de la pose antes que cualquier detalle.',
    ['Abre la Referencia 3D y pon la práctica de poses en 30 s.', 'Dibuja UNA línea de acción que recorra toda la figura.', 'Añade solo cabeza, caja del torso y pelvis como formas simples.', 'No borres: cada pose es un intento nuevo.'], 'model3d'),
  ex('anatomia', 'Figura en 8 cabezas', 15, 2, 'construct', 'Fijar las proporciones canónicas del cuerpo adulto.',
    ['Activa la guía «Figura: proporción en cabezas» en la pestaña Guías.', 'Sitúa hombros, ombligo y entrepierna sobre las divisiones.', 'Dibuja el muñeco de bloques encima sin mirar el resto.', 'Quita la guía y compara tu figura con ella con la regla de medir.'], 'guides'),
  ex('anatomia', 'Masas del torso en movimiento', 25, 3, 'construct', 'Ver caja torácica y pelvis como dos masas que se inclinan una respecto a la otra.',
    ['Elige una pose con contrapposto en el maniquí.', 'Dibuja el eje de hombros y el eje de caderas: ¿en qué sentido se inclinan?', 'Une ambas masas con la columna y comprueba el equilibrio del peso.', 'Repite desde otro ángulo de cámara.'], 'model3d'),
  ex('anatomia', 'Figura completa de memoria', 30, 4, 'memory', 'Interiorizar la estructura lo bastante como para dibujarla sin referencia.',
    ['Observa una pose 20 s en el modo memoria de la práctica de poses.', 'La figura se oculta: dibújala completa con tus proporciones.', 'Al revelarla, marca en otro color las diferencias más grandes.', 'Anota qué proporción falló más (¿cabeza? ¿piernas?).'], 'model3d'),

  // --- Perspectiva
  ex('perspectiva', 'Horizonte y cajas en 1 punto', 15, 1, 'construct', 'Entender que todo converge al horizonte a la altura de tus ojos.',
    ['Activa la perspectiva de 1 punto en la pestaña Perspectiva.', 'Dibuja 5 cajas: por encima, por debajo y sobre la línea del horizonte.', 'Observa qué caras ves según su posición respecto al horizonte.'], 'guides'),
  ex('perspectiva', 'Habitación en 2 puntos', 25, 2, 'construct', 'Construir un interior con paredes y suelo coherentes.',
    ['Activa 2 puntos de fuga y coloca el horizonte a media altura.', 'Levanta el rincón de la habitación con una vertical.', 'Añade puerta, ventana y una mesa (caja) respetando las convergencias.'], 'guides'),
  ex('perspectiva', 'Círculos y elipses en perspectiva', 20, 3, 'construct', 'Dibujar ruedas, tazas y cilindros sin que las elipses se vean «achatadas».',
    ['Coloca el asistente de elipses y varía el ratio de 0,2 a 0,9.', 'Dibuja el cuadrado en perspectiva que la contiene y traza la elipse inscrita.', 'Recuerda: el eje menor de la elipse apunta hacia el punto de fuga.'], 'guides'),
  ex('perspectiva', 'Calle en 3 puntos', 40, 5, 'draw', 'Dominar vistas picadas o contrapicadas con la convergencia vertical.',
    ['Activa la perspectiva de 3 puntos.', 'Dibuja 3 edificios con alturas distintas.', 'Ajusta el tercer punto para exagerar o suavizar el efecto.'], 'guides'),

  // --- Luz
  ex('luz', 'Esfera en 5 valores', 15, 1, 'study', 'Reconocer las 5 zonas de sombra de una forma redonda.',
    ['Coloca una esfera en el visor 3D y activa la vista de valores (arcilla).', 'Dibuja: luz, medio tono, núcleo de sombra, luz reflejada, sombra proyectada.', 'Comprueba que la luz reflejada nunca es más clara que el medio tono.'], 'model3d'),
  ex('luz', 'Un objeto, tres direcciones de luz', 25, 2, 'study', 'Ver cómo la dirección de la luz cambia la lectura de la forma.',
    ['Pon un cubo o el maniquí en el visor 3D.', 'Cambia el acimut: frontal, lateral y contraluz.', 'Haz un boceto de 5 min de valores de cada una.'], 'model3d'),
  ex('luz', 'Temperatura de luz', 25, 3, 'study', 'Asociar luz cálida con sombras frías y viceversa.',
    ['Usa la temperatura de color del visor 3D: 3000 K, 5600 K, 8000 K.', 'Pinta la misma forma con luz cálida y sombras frías.', 'Repite con luz fría y sombras cálidas.'], 'model3d'),
  ex('luz', 'Retrato con luz dramática', 45, 5, 'draw', 'Diseñar las formas de sombra para que cuenten la forma de la cara.',
    ['Ilumina el maniquí con luz alta y lateral y activa las sombras.', 'Decide qué zonas quedan en sombra plena y cuáles en luz.', 'Agrupa las sombras en una sola forma conectada.'], 'model3d'),

  // --- Color
  ex('color', 'Escala de grises a color', 15, 1, 'study', 'Ver que el valor manda sobre el matiz.',
    ['Pinta una forma con 5 valores en gris.', 'Convierte cada valor en un color respetando su luminosidad.', 'Analiza el dibujo y mira el mapa de valores para comprobar que los valores se mantienen.'], 'analyze'),
  ex('color', 'Armonía análoga y complementaria', 25, 2, 'study', 'Construir paletas con una lógica clara.',
    ['Genera una armonía en Herramientas de color → Armonía.', 'Pinta la misma escena con una paleta análoga y otra complementaria.', 'Compara qué transmite cada una.'], 'color'),
  ex('color', 'Mezcla de pigmentos: gamas de un color', 30, 3, 'study', 'Entender cómo se comportan las mezclas de pintura.',
    ['Abre Herramientas de color → Pigmentos.', 'Mezcla 2 primarios en 9 pasos y usa la rampa para pintar bloques.', 'Anota cuáles dan tonos neutros y cuáles colores vivos.'], 'color'),
  ex('color', 'Estudio de paleta de una fotografía', 35, 4, 'study', 'Aprender a extraer la lógica cromática de una imagen real.',
    ['Extrae una paleta de una foto con la herramienta de paletas.', 'Reproduce la escena usando solo esos 6 colores.', 'Nota qué colores usó la foto para las sombras.'], 'color'),

  // --- Composición
  ex('composicion', 'Miniaturas de valores', 15, 1, 'draw', 'Explorar composiciones rápido, sin apegarte a ninguna.',
    ['Haz 6 miniaturas de 2×3 cm con solo 3 valores.', 'Cambia el punto de interés de sitio en cada una.', 'Elige la que se lee mejor a simple vista.'], undefined),
  ex('composicion', 'Regla de tercios y punto focal', 20, 2, 'study', 'Colocar el foco de forma intencionada.',
    ['Activa la cuadrícula de tercios.', 'Dibuja un sujeto con su punto de mayor contraste en una intersección.', 'Analiza el dibujo: ¿la app confirma dónde está el contraste?'], 'analyze'),
  ex('composicion', 'Equilibrio asimétrico', 30, 3, 'draw', 'Compensar un elemento pesado con otro más pequeño y contrastado.',
    ['Pon una masa grande a un lado.', 'Equilíbrala con un acento pequeño al otro lado.', 'Usa el análisis para ver el reparto de peso visual.'], 'analyze'),
  ex('composicion', 'Réplica de una composición clásica', 45, 4, 'study', 'Descubrir la estructura oculta de una obra.',
    ['Elige una obra en la biblioteca de estilos.', 'Reduce su composición a 4-5 formas y sus líneas de dirección.', 'Redibuja con otro tema pero la misma estructura.'], 'references'),

  // --- Retrato
  ex('retrato', 'Cabeza de frente con proporciones', 20, 1, 'construct', 'Situar ojos, nariz y boca en su sitio.',
    ['Activa la guía de rostro de frente.', 'Dibuja el contorno y traza las líneas horizontales.', 'Coloca los ojos a media altura y separados por un ojo.'], 'guides'),
  ex('retrato', 'Cabeza de perfil (bola y plano)', 25, 2, 'construct', 'Entender la cabeza como esfera con planos.',
    ['Activa la guía de rostro de perfil.', 'Dibuja la esfera, corta los laterales y añade el plano frontal.', 'Ubica la oreja entre la línea de la ceja y la base de la nariz.'], 'guides'),
  ex('retrato', 'Cinco expresiones', 30, 3, 'study', 'Ver qué rasgos cambian de verdad con cada emoción.',
    ['Usa el rostro 3D y aplica alegre, triste, enfadado, sorpresa y miedo.', 'Dibuja cada expresión con la misma cabeza base.', 'Anota qué mueve la expresión: ¿cejas, párpados, boca?'], 'model3d'),
  ex('retrato', 'Retrato en 3/4 con iluminación', 50, 5, 'draw', 'Integrar estructura, proporciones y luz.',
    ['Coloca la cabeza a 3/4 con el maniquí y luz lateral.', 'Construye con guías y luego define sombras.', 'Comprueba con el análisis y la comparación en espejo.'], 'model3d'),

  // --- Manos
  ex('manos', 'Manos como bloques', 15, 1, 'construct', 'Reducir la mano a palma + dedos en cajas.',
    ['Activa la guía de mano.', 'Dibuja 5 manos en distintas posiciones usando solo cajas.', 'Añade después los dedos como cilindros con 3 segmentos.'], 'guides'),
  ex('manos', 'Diez manos en 20 minutos', 20, 2, 'gesture', 'Ganar fluidez con un ritmo de 2 minutos por mano.',
    ['Pon una mano en el maniquí con el preset que quieras.', 'Dibújala en 2 minutos y cambia de preset.', 'Alterna vistas: palma, dorso y perfil.'], 'model3d'),
  ex('manos', 'Agarre de objetos', 30, 3, 'study', 'Entender cómo la mano se adapta a la forma que sostiene.',
    ['Añade un objeto (silla, espada, guitarra) junto al maniquí.', 'Pon la mano en «Agarre» y ajusta cada dedo.', 'Dibuja el conjunto respetando el volumen del objeto.'], 'model3d'),
  ex('manos', 'Manos y pies en escorzo', 40, 5, 'draw', 'Resolver un escorzo fuerte sin perder proporción.',
    ['Pon la mano apuntando a cámara y usa el visor 3D con FOV alto.', 'Construye con cajas y superpón la guía de elipses.', 'Repite con un pie en puntillas.'], 'model3d'),

  // --- Ropa
  ex('ropa', 'Pliegues de tensión y de caída', 20, 1, 'study', 'Distinguir los dos tipos básicos de pliegue.',
    ['Dibuja un brazo con manga: pliegues de tensión en el codo y de caída abajo.', 'Comprueba que los pliegues nacen de un punto de tensión.'], 'references'),
  ex('ropa', 'La ropa sobre el maniquí', 30, 2, 'study', 'Ver cómo la ropa sigue la forma que hay debajo.',
    ['Pon camiseta y pantalón al maniquí y elige una pose dinámica.', 'Dibuja primero el cuerpo y luego la tela encima.', 'Comprueba dónde tira y dónde cuelga.'], 'model3d'),
  ex('ropa', 'Capa al viento', 30, 3, 'draw', 'Comunicar movimiento con la tela.',
    ['Activa la capa y coloca una pose de carrera.', 'Dibuja las líneas de dirección del viento primero.', 'Dibuja pliegues largos y continuos, sin repetir.'], 'model3d'),
  ex('ropa', 'Estudio de una prenda compleja', 45, 5, 'study', 'Simplificar una prenda con muchas capas.',
    ['Elige una foto de referencia.', 'Reduce la prenda a 3 volúmenes grandes.', 'Añade los pliegues principales y luego los secundarios.'], 'references'),

  // --- Fondos
  ex('fondos', 'Tres planos de profundidad', 20, 1, 'draw', 'Separar primer plano, plano medio y fondo con valor y detalle.',
    ['Divide la escena en 3 franjas de profundidad.', 'Oscurece el primer plano, deja el medio con contraste y suaviza el fondo.', 'Reduce el detalle a medida que te alejas.'], undefined),
  ex('fondos', 'Casa y calle en perspectiva', 35, 2, 'construct', 'Construir una escena arquitectónica sencilla.',
    ['Añade una casa y una torre desde el visor 3D como referencia de volumen.', 'Colócalas con 2 puntos de fuga.', 'Suma ventanas y puertas respetando la convergencia.'], 'model3d'),
  ex('fondos', 'Perspectiva atmosférica', 30, 3, 'study', 'Usar el color y el contraste para alejar los planos.',
    ['Pinta una cadena de colinas en 4 planos.', 'Cada plano más lejano: menos contraste, más claro y más azulado.', 'Comprueba con la vista de valores.'], 'analyze'),
  ex('fondos', 'Habitación con figura', 50, 5, 'draw', 'Integrar figura, escala y espacio.',
    ['Define horizonte y puntos de fuga.', 'Coloca el maniquí y una silla para comprobar la escala.', 'Ilumina con una sola fuente coherente.'], 'model3d'),

  // --- Teoría
  ex('teoria', 'Formas: círculo, cuadrado, triángulo', 15, 1, 'draw', 'Ver cómo la forma base comunica carácter.',
    ['Diseña 3 personajes: uno redondo (amable), uno cuadrado (fuerte), uno triangular (amenazante).', 'Mantén la misma altura en los tres.'], undefined),
  ex('teoria', 'Silueta y legibilidad', 20, 2, 'draw', 'Comprobar que la idea se lee sin detalle.',
    ['Rellena tu dibujo en negro sobre blanco.', '¿Se entiende la pose y la idea?', 'Corrige la silueta antes de añadir detalle.'], 'analyze'),
  ex('teoria', 'Ritmo, repetición y variedad', 30, 3, 'draw', 'Crear unidad con repetición y variedad con contraste.',
    ['Dibuja una fila de elementos con un patrón.', 'Rompe el patrón una vez para crear foco.', 'Analiza el resultado.'], 'analyze'),
  ex('teoria', 'Estudio de una tradición visual', 45, 4, 'study', 'Aprender técnicas concretas de otra cultura visual.',
    ['Elige un estilo en la pestaña Estilos.', 'Estudia sus 5 recursos y aplica uno en un dibujo propio.', 'Anota qué aprendiste que no supieras hacer.'], 'references'),
];

export interface Challenge {
  id: string;
  title: string;
  description: string;
  /** Number of items to complete. */
  count: number;
  /** Total time allowed, in minutes. */
  minutes: number;
  unit: string;
}

export const CHALLENGES: Challenge[] = [
  { id: 'hands10', title: '10 manos en 20 minutos', description: 'Ritmo de 2 minutos por mano, cambiando de posición cada vez.', count: 10, minutes: 20, unit: 'manos' },
  { id: 'faces5', title: '5 expresiones faciales', description: 'Una cabeza, cinco emociones distintas.', count: 5, minutes: 25, unit: 'expresiones' },
  { id: 'light3', title: '3 estudios de luz', description: 'El mismo objeto con tres direcciones de luz distintas.', count: 3, minutes: 30, unit: 'estudios' },
  { id: 'gesture20', title: '20 gestos de 30 segundos', description: 'Solo línea de acción y masas.', count: 20, minutes: 10, unit: 'gestos' },
  { id: 'perspective6', title: '6 cajas en perspectiva', description: 'Cajas a distintas alturas sobre el horizonte.', count: 6, minutes: 15, unit: 'cajas' },
  { id: 'thumbs12', title: '12 miniaturas de composición', description: 'Cuadros pequeños de 3 valores, foco en distintos sitios.', count: 12, minutes: 20, unit: 'miniaturas' },
];

export interface VisualTradition {
  id: string;
  title: string;
  region: string;
  /** Techniques and devices to look for when studying it. */
  devices: string[];
  exercise: string;
}

/** For studying techniques, composition and brushwork — not for converting a drawing into a style. */
export const TRADITIONS: VisualTradition[] = [
  {
    id: 'ukiyoe', title: 'Estampa japonesa (ukiyo-e)', region: 'Arte japonés',
    devices: ['Línea de contorno firme y de grosor casi constante.', 'Áreas de color plano con pocos valores; sin sombreado modelado.', 'Composiciones asimétricas, recortes atrevidos y diagonales fuertes.', 'Planos superpuestos en lugar de perspectiva lineal estricta.', 'El espacio vacío (ma) como parte de la composición.'],
    exercise: 'Redibuja un paisaje tuyo con solo 5 colores planos y un contorno de grosor uniforme.',
  },
  {
    id: 'manga', title: 'Manga', region: 'Arte japonés',
    devices: ['Líneas de velocidad y fondos abstractos para el movimiento.', 'Tramas (tonos de trama) en lugar de degradados.', 'Expresiones exageradas y cambio de estilo para el humor.', 'Distribución de viñetas que guía el ritmo de lectura.', 'Negros sólidos para dirigir el foco.'],
    exercise: 'Traduce un dibujo de tonos suaves a solo blanco, negro y 2 tramas.',
  },
  {
    id: 'sumie', title: 'Pintura de tinta china (shan shui / sumi-e)', region: 'Arte chino',
    devices: ['La pincelada expresa energía y ritmo, no solo forma.', 'Gradación de la tinta desde el negro intenso al gris casi blanco.', 'Vacío deliberado (niebla, agua, cielo) que da escala.', 'Punto de vista móvil: la escena se recorre, no se fija en un único punto.', 'Composición en verticales para montañas y ejes de lectura.'],
    exercise: 'Pinta tres montañas usando solo 3 valores de tinta y un tercio del lienzo vacío.',
  },
  {
    id: 'korean', title: 'Pintura coreana (paisaje Joseon y minhwa)', region: 'Arte coreano',
    devices: ['Paisajes «de vista real» que representan lugares concretos.', 'Uso simbólico de los cinco colores tradicionales (azul, rojo, amarillo, blanco y negro).', 'Minhwa: pintura popular de colores vivos y motivos simbólicos (tigres, flores, pájaros).', 'Pincelada de tinta variada según la textura de la roca o el árbol.'],
    exercise: 'Elige un lugar cercano y píntalo con solo los cinco colores tradicionales.',
  },
  {
    id: 'renaissance', title: 'Dibujo y pintura renacentistas', region: 'Arte europeo',
    devices: ['Perspectiva lineal con punto de fuga central.', 'Claroscuro y sfumato: transiciones suaves de luz a sombra.', 'Composición piramidal o triangular para los grupos.', 'Contrapposto: peso desigual sobre las piernas para dar naturalidad.', 'Estudios preparatorios de carboncillo, sanguina o punta de plata.'],
    exercise: 'Dibuja un estudio de una mano o un drapeado con carboncillo en 4 valores.',
  },
  {
    id: 'baroque', title: 'Barroco', region: 'Arte europeo',
    devices: ['Tenebrismo: fuerte contraste entre luz y oscuridad.', 'Diagonales dinámicas y composiciones en movimiento.', 'Una fuente de luz clara y dirigida que modela las figuras.', 'Realismo en los detalles del rostro y las telas.'],
    exercise: 'Ilumina el maniquí con una sola luz lateral y dibuja solo las masas de luz con el resto en sombra.',
  },
  {
    id: 'impressionism', title: 'Impresionismo', region: 'Pintura tradicional',
    devices: ['Pinceladas visibles y sueltas en lugar de acabados lisos.', 'Sombras coloreadas en vez de grises o negros.', 'Interés por la luz y su cambio a lo largo del día.', 'Mezcla óptica: colores puestos uno junto a otro.'],
    exercise: 'Pinta un objeto exterior con 30 minutos de límite y sin usar negro.',
  },
  {
    id: 'oil', title: 'Óleo tradicional (método de capas)', region: 'Pintura tradicional',
    devices: ['Imprimación de tono medio y grisalla para resolver los valores primero.', '«Graso sobre magro»: las capas superiores llevan más medio.', 'Velos (transparencias) para modificar el color de la capa inferior.', 'Empastes solo en las luces para que destaquen.'],
    exercise: 'Empieza una pintura con una imprimación gris, resuelve valores y añade color con velos.',
  },
  {
    id: 'illustration', title: 'Ilustración contemporánea', region: 'Ilustración contemporánea',
    devices: ['Formas simplificadas y muy legibles.', 'Paletas cortas y coherentes.', 'Texturas digitales (grano, ruido) para dar calidez.', 'Composición pensada para leer bien a tamaño pequeño.'],
    exercise: 'Limita tu paleta a 5 colores y repite una escena en versión simplificada.',
  },
  {
    id: 'concept', title: 'Concept art', region: 'Concept art',
    devices: ['Miniaturas y siluetas rápidas para explorar ideas.', 'Bloqueo de valores en 3 niveles antes del color.', 'Legibilidad ante todo: la idea se entiende en 2 segundos.', 'Uso de referencias y perspectiva para dar credibilidad.', 'Iteración: muchas versiones cortas antes de pulir una.'],
    exercise: 'Diseña 8 siluetas de un personaje y elige la más legible antes de detallar.',
  },
  {
    id: 'comic', title: 'Cómic occidental', region: 'Cómic',
    devices: ['Encuadre y planos (general, medio, primer plano) para narrar.', 'Tinta con negros sólidos que crean foco y peso.', 'Ritmo de viñetas: más viñetas = tiempo más lento o tenso.', 'Color plano con luz consistente entre viñetas.'],
    exercise: 'Cuenta una acción en 4 viñetas con planos distintos en cada una.',
  },
];

// Guidance for the tutor's light-and-shadow suggestions (used in the Study panel).
export const LIGHT_TIPS: string[] = [
  'Decide una sola fuente de luz principal y colócala antes de sombrear: todas las sombras deben ser coherentes con ella.',
  'Las sombras proyectadas se alargan cuando la luz baja (atardecer) y se acortan cuando sube (mediodía).',
  'Las sombras más oscuras suelen estar donde el objeto toca la superficie (sombra de contacto).',
  'La luz reflejada aclara el borde de la sombra pero casi nunca supera al medio tono.',
  'Una luz cálida suele pedir sombras algo más frías (y al revés): el contraste de temperatura da vida.',
  'Un contraluz suave (luz de contorno) separa la figura del fondo sin necesidad de un contorno dibujado.',
];

/** Per-module "twists" appended to a session, so a 30-day plan on the same module still varies. */
export const VARIATIONS: Record<string, string[]> = {
  anatomia: ['Con un modelo de cuerpo atlético.', 'Con un cuerpo corpulento: cuida el volumen del torso.', 'Con una figura infantil (cabeza más grande).', 'Desde un ángulo de cámara bajo.', 'Desde un ángulo de cámara alto.', 'Con la pose reflejada (espejo).'],
  perspectiva: ['Con el horizonte muy bajo.', 'Con el horizonte muy alto.', 'Con objetos redondos incluidos.', 'Añadiendo una figura humana para fijar la escala.', 'Con una escalera o rampa.', 'De noche: una sola luz puntual.'],
  luz: ['Con luz de atardecer (cálida, baja).', 'Con luz cenital de mediodía.', 'Con dos fuentes de luz de distinta temperatura.', 'Con contraluz suave.', 'Con luz de ventana lateral.', 'Con luz de vela desde abajo.'],
  color: ['Con una paleta limitada de 4 colores.', 'Con un color dominante y un acento.', 'Con paleta de atardecer.', 'Con paleta fría y un único toque cálido.', 'Con paleta triádica.', 'Con colores desaturados salvo el foco.'],
  composicion: ['Con formato vertical.', 'Con formato panorámico.', 'Con el foco en el tercio izquierdo.', 'Con el foco en el tercio derecho.', 'Con un marco natural dentro de la imagen.', 'Con una diagonal dominante.'],
  retrato: ['Con una persona mayor.', 'Con un niño.', 'Con un sombrero que proyecte sombra.', 'Con la cabeza inclinada.', 'Con gafas.', 'Con una expresión intensa.'],
  manos: ['Sosteniendo una taza o una silla pequeña.', 'Con las manos cruzadas.', 'Con una mano en un puño.', 'Señalando hacia la cámara.', 'Con los dedos entrelazados.', 'Con una mano relajada en reposo.'],
  ropa: ['Con una camisa holgada.', 'Con una capa larga.', 'Con un abrigo pesado.', 'Con una falda o túnica.', 'Con ropa ajustada.', 'Con pliegues por movimiento.'],
  fondos: ['Un interior pequeño.', 'Una calle estrecha.', 'Un paisaje abierto.', 'Un bosque con planos de profundidad.', 'Un puente o estructura repetida.', 'Un cielo dramático.'],
  teoria: ['Aplicando solo formas geométricas.', 'Limitándote a 3 valores.', 'Con un ritmo repetido y una excepción.', 'Con contraste de tamaño.', 'Con un solo color sobre gris.', 'Con líneas de dirección marcadas.'],
};
