# SCHIZZO STUDIO

Estudio de dibujo digital, pixel art, cómic/manga y referencias 3D. Gratuito, de código abierto (no comercial) y **local primero**: tus proyectos viven en tu equipo, sin cuenta ni suscripción.

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
- **Enviar comentario**: desde la cabecera o la pantalla de inicio, en cualquier momento (fase de pruebas con usuarios de confianza). Incluye la versión, el tipo de proyecto y los últimos errores de la sesión, y opcionalmente una miniatura de lo que se estaba dibujando — siempre visible antes de copiar, guardar o enviar, nunca automático. Copiar y Guardar son las opciones fiables (probadas de verdad); "Correo" y "Gmail" dependen de que el sistema tenga un cliente de correo o navegador que responda a esos enlaces, así que se ofrecen las dos — si ninguna abre nada, el mensaje ya está para copiar o guardar.

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

`npm run check` compila la app y la abre de verdad en Electron (perfil temporal, sin tocar tus proyectos) para hacer las operaciones y comprobar el resultado con píxeles reales. Tarda unos 8 minutos y no necesita servicios externos.

| Grupo | Qué comprueba |
| --- | --- |
| `historial` | Deshacer/rehacer con píxeles reales, varios trazos, deshacer inmediato tras un trazo, crear/borrar capas. |
| `archivo` | Guardar un `.drawing` con varias capas, reabrirlo y comparar píxeles; volver a guardar sobre el mismo archivo. |
| `exportar` | PNG, JPG, WebP, BMP, SVG y PDF: formato, tamaño y que el dibujo no salga en blanco. |
| `reproduccion` | Cada paso queda registrado, en orden, y el último fotograma contiene el dibujo. |
| `tipos` | Los cuatro tipos de proyecto abren sin errores; el pincel dibuja en dibujo y pixel art. |
| `rendimiento` | Lienzo de 12 MP con 5 capas: trazos fluidos y sin bloqueo al soltar. |
| `capas` | Fusionar, modos de mezcla y opacidad, máscaras, grupos, duplicar/reordenar/borrar, aplanar, recorte (clipping), capas de ajuste y relleno, bloquear y aislar. |
| `filtros` | Resultado exacto de los filtros básicos, desenfoques, que cada filtro y ajuste se ejecute sin errores y que se pueda deshacer. |
| `seleccion` | Rellenar/borrar/copiar/cortar/pegar con selección, invertir, expandir, contraer, rango de color, voltear y recortar al contenido. |
| `pixelart` | El pincel no deja semitransparencias, cuantizar y tramar solo usan la paleta, pixelar. |
| `comic` | Plantillas de viñetas, tramas, globos de texto, líneas de velocidad y el panel de cómic. |
| `animacion` | Fotogramas (crear, duplicar, borrar, duración, fps), deshacer/rehacer y exportar GIF y APNG. |
| `paneles` | Los 19 paneles laterales y los diálogos se abren sin errores; los atajos de herramienta. |
| `ia` | Desactivar la IA quita el asistente, se guarda la preferencia y no hay peticiones de red. |
| `asistente` | Las 8 funciones de IA que son en realidad proceso local (sin modelo ni red): limpieza de trazos, composición, separar capas, sugerir paletas, ajustar el maniquí a una pose, prompts de referencia, reiluminar e interpretar texto. |
| `ia-generativa` | Generar imagen y reescribir texto llegan de verdad al proveedor configurado (contra un servidor mock local, sin API de pago) y no se hace ninguna petición con la IA desactivada. |
| `feedback` | Copiar y guardar el diálogo "Enviar comentario" funcionan de verdad (portapapeles, archivo), la miniatura opcional del lienzo se genera, y se puede abrir sin ningún proyecto abierto. |

```bash
npm run check -- historial archivo   # solo algunos grupos
node scripts/check.cjs --no-build    # reutiliza el build existente
```

Sale con código distinto de 0 si algo falla. Los diálogos de abrir/guardar se responden solos (`scripts/check/electron-entry.cjs`).

### Detección de pose (aparte, necesita red)

```bash
npm run check:pose                 # descarga (o reutiliza) el modelo real y detecta sobre una figura de prueba
node scripts/check-pose.cjs --no-build   # reutiliza el build existente
```

Fuera de la batería principal porque, a diferencia de todo lo demás, la primera vez descarga el modelo MoveNet real (~12 MB) de tfhub.dev — después queda en caché en `scripts/check/.pose-model-cache` (fuera del repo) y las siguientes ejecuciones lo reutilizan. Comprueba que con la IA desactivada no se toca la red, y que con la IA activada la detección completa sin errores sobre una silueta de prueba: no exige que la reconozca con seguridad (una silueta sintética no es una foto), solo que el resultado tenga la forma esperada, con motivo explicado si no reconoce nada.

Los grupos "a fondo" usan un gancho de pruebas (`src/checkHook.ts`) que solo existe si la página tiene `localStorage['schizzo:check'] = '1'`; la app normal no lo activa. No se prueban la generación de imágenes con IA ni la detección de pose, porque descargan modelos pesados.

### Instaladores

```bash
npm run check:installer                   # genera los instaladores y los prueba (unos 2 min)
node scripts/check-installer.cjs --no-build   # prueba los que ya hay en release/
```

Instala en silencio en una carpeta temporal, abre la app instalada (proyecto, trazo, deshacer, reproducción), la desinstala comprobando que no queda ni carpeta, ni accesos directos, ni registro, y repite el recorrido con la versión portable. Solo Windows.

```bash
npm run check:linux                   # genera el AppImage y lo prueba
node scripts/check-linux.cjs --no-build   # prueba el que ya haya en release/
```

Equivalente en Linux: genera el AppImage, lo arranca, dibuja, deshace, rehace y comprueba la reproducción del proceso. Solo Linux (probado en Ubuntu 24.04).

## Empaquetado (Windows)

```bash
npm run package    # instalador NSIS y versión portable en release/
```

Genera `SCHIZZO-STUDIO-Setup-<versión>.exe` y `SCHIZZO-STUDIO-Portable-<versión>.exe`. La configuración está en `electron-builder.yml` (también define objetivos para macOS y Linux).

**Estado por plataforma:**
- **Windows:** probado de extremo a extremo (`npm run check` y `npm run check:installer`).
- **Linux:** probado de verdad en Ubuntu 24.04 (kernel real, no emulación) con `npm run check` y el
  AppImage con `npm run check:linux` (script en `scripts/check-linux.cjs`). 45/46 comprobaciones
  pasan; solo falla la de rendimiento, y por una razón identificada y ajena a la app: bajo WSLg,
  Chromium cayó a render por software (WebGL/Vulkan reportan `llvmpipe`) al faltarle el driver
  Vulkan D3D12 ("dozen") de Mesa en esa instalación mínima — el tiempo por evento del pincel
  seguía siendo normal (3-4 ms), solo la composición de capas iba lenta. En una máquina Linux
  normal con un driver de GPU real (Intel/AMD/NVIDIA), que es el caso habitual fuera de WSL, no
  debería reproducirse; queda sin confirmar en hardware Linux nativo.
- **macOS:** sin probar. `electron-builder` solo puede generar el `.dmg` desde un Mac, y no hay
  ninguno disponible; queda documentado aquí en vez de forzarlo con infraestructura de CI, que el
  proyecto ha decidido no usar.

### Firma de código

El instalador y el portable no están firmados: al abrirlos, Windows SmartScreen muestra un aviso
de "editor no reconocido". No es un fallo, es lo esperado sin certificado — y no hay forma de
evitarlo sin comprar uno, ni con un certificado autofirmado (Windows solo confía en certificados
de una autoridad reconocida).

Para firmar:
1. **Comprar un certificado de firma de código** (OV o EV) a una autoridad como DigiCert, Sectigo o
   SSL.com. Un EV cuesta más pero genera la reputación de SmartScreen mucho antes; uno OV es más
   barato pero el aviso puede tardar semanas o meses en desaparecer, según cuántas descargas tenga
   el instalador.
2. **No hace falta tocar el código.** `electron-builder.yml` ya está preparado (servidor de sellado
   de tiempo y algoritmo de firma); electron-builder firma solo al detectar el certificado en el
   entorno:
   ```bash
   export CSC_LINK=/ruta/al/certificado.pfx       # o su contenido en base64
   export CSC_KEY_PASSWORD=la_contraseña_del_pfx
   npm run package
   ```
3. Comprueba que quedó firmado con `Get-AuthenticodeSignature .\release\SCHIZZO-STUDIO-Setup-<versión>.exe` en PowerShell (`Status` debe decir `Valid`).

## Versionado

[Versionado semántico](https://semver.org/lang/es/). Mientras la versión sea `0.y.z` (como ahora),
cualquier cosa puede cambiar sin previo aviso: queda sin resolver la colaboración en tiempo real, la
firma de código y las pruebas reales en macOS/Linux con GPU. `1.0.0` queda reservado para cuando eso
esté decidido y la app esté lista para un primer público. Un sistema de plugins se descartó por
ahora (no hay demanda real y el riesgo de ejecutar código de terceros no compensa con el grupo de
pruebas actual); se reconsiderará si aparece una comunidad real pidiendo algo concreto. Los cambios
de cada versión están en [CHANGELOG.md](CHANGELOG.md).

Cada versión etiquetada (`git tag`) tiene su [Release en GitHub](https://github.com/itsramirez4/SCHIZZO-STUDIO/releases), con la sección correspondiente del changelog como notas. `node scripts/make-release.cjs v<versión>` crea el Release de un tag ya subido, tomando las notas directamente de su sección en `CHANGELOG.md`.

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

[PolyForm Noncommercial 1.0.0](LICENSE): puedes usar, copiar, modificar y redistribuir el código
libremente, incluso para fines personales, educativos o de investigación — pero no para fines
comerciales (venderlo, cobrar por él o por una versión modificada, etc.). El objetivo es que
SCHIZZO STUDIO y cualquier derivado se mantengan gratuitos para quien los use.
