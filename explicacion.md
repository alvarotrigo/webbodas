# Explicación del proyecto – Guía para programadores

Este documento describe la lógica interna del proyecto **nine-screen-canvas-flow**: cómo funcionan los ítems añadibles (secciones o temáticas/templates), los estilos, los scripts de generación de imágenes y qué debe hacer un programador para añadir o modificar contenido.

**Variante con temáticas/templates:** El proyecto puede usar **temáticas** (temas/templates) en lugar de secciones. La misma lógica se mantiene: **se puede sustituir el array `sections` por un array de temáticas** (por ejemplo `tematicas`) con la **misma estructura** (`id`, `name`, `file`, `tags`, `is_pro`, `hidden`). El resto del flujo (categorías, preview, inserción, nombres, scripts) no cambia; solo hay que hacer que el código use ese array (p. ej. `const sections = tematicas;` o refactorizar referencias de `sections` a `tematicas`). Las rutas de archivos pueden ser otras (p. ej. `templates/html/` en lugar de `sections/`) si se desea.

---

## SECCIONES (O TEMÁTICAS)

En el código la lista de ítems añadibles está en el array **`sections`**. Si el proyecto usa temáticas/templates directamente, ese array puede ser **`tematicas`** (o similar) con la misma forma; la lógica que se describe abajo aplica igual.

### Cómo añadir nuevas secciones (o temáticas) al proyecto

1. **Definir el ítem en el array** (`sections` o `tematicas`) en `public/js/app.js` (aprox. líneas 649–758 si sigue siendo `sections`). Cada entrada tiene:
   - **`id`**: número único (entero). Debe ser el siguiente al último existente si quieres que la miniatura coincida con `screenshots/{id}.jpg`.
   - **`name`**: texto que se muestra en el menú (ej. `'Hero'`, `'Pricing 2'`).
   - **`file`**: nombre del archivo HTML (ej. en `sections/` o `templates/html/`, según el proyecto). Ej.: `'fp-theme-mi-seccion.html'` o `'template1.html'`.
   - **`tags`**: array de etiquetas para filtrar en categorías (ej. `['hero', 'cta']`, `['pricing']`, `['testimonial']`). Ver categorías en el objeto `categories` en el mismo archivo.
   - **`is_pro`**: `0` (gratis) o `1` (solo usuarios PRO).
   - **`hidden`** (opcional): `true` para ocultar del menú.

2. **Crear el HTML** en la carpeta que use el proyecto (`sections/` o `templates/html/`) con el mismo nombre que `file`. El contenido debe tener **una sola raíz** que sea `<section>` o `<footer>`. Ese nodo es el que se inserta en el preview; lo que vaya fuera no se usa.

3. **Incluir el ítem en `all.html`** en la posición que corresponda al `id` (ver más abajo “De dónde se cogen los nombres” y “Scripts de imágenes”). Sin esto, la miniatura `screenshots/{id}.jpg` no representará ese ítem.

4. **Opcional**: si el ítem necesita JS (slider, acordeón, etc.), añadir el script en `preview.html` (por ejemplo `public/js/sections/fp-theme-xxx.js`).

---

### Cómo detecta y clasifica el código los ítems (secciones o temáticas)

- **Lista maestra**: el array usado en `public/js/app.js` (`sections` o, si aplica, `tematicas`) es la única fuente de verdad. **Sustituir `sections` por `tematicas` mantiene esta lógica** siempre que el array tenga la misma estructura. Cada elemento tiene `id`, `name`, `file`, `tags`, `is_pro` y opcionalmente `hidden`.
- **Clasificación por categorías**: el objeto `categories` (mismo archivo, aprox. líneas 842–973) agrupa ítems por **tags**. Por ejemplo:
  - `Hero` → `tags` incluye `'hero'` o `'intro'`.
  - `Pricing` → `tags` incluye `'pricing'`.
  - `Testimonials` → `tags` incluye `'testimonial'`.
- **Menú lateral**: el menú lateral puede mostrar **estilos de template** (`templateStyles`: minimal, classic, rustic, luxe) con templates completos, o listar directamente los ítems del array (secciones o temáticas). En ambos casos la lista se construye a partir del mismo tipo de datos (id, name, file, tags, etc.). En la variante original, las categorías de tipo “Hero/Features/Testimonials” como menú principal; el menú lateral puede mostrar **estilos de template** (`templateStyles`: minimal, classic, rustic, luxe) con templates completos, o listar directamente los ítems del array (secciones o temáticas). En ambos casos la lista se construye a partir del mismo tipo de datos (id, name, file, tags, etc.).
- **Detección en el DOM**: en el iframe de preview (`preview.js`), cada ítem insertado se identifica por:
  - **`data-section`**: número/id del ítem (coincide con `id` del array).
  - **`data-section-uid`**: identificador único por instancia (por si el mismo ítem se añade varias veces).
  - Clase **`.section`** en el elemento raíz (`<section>` o `<footer>`).

---

### Lógica y metodología del preview (secciones o temáticas)

- **Miniatura en el panel**:  
  - Para usuarios gratuitos e ítem PRO: se muestra la imagen `screenshots/{id}.jpg` (generada por `screenshot-generator.cjs` desde `all.html`).  
  - Para el resto: se carga el HTML desde la ruta correspondiente (p. ej. `sections_thumbnails/{file}` o la que use el proyecto) y se renderiza dentro del ítem del grid (con lazy load al entrar en vista).
- **Contenido al insertar**: cuando el usuario hace clic en “+” para añadir un ítem, la app hace **fetch** a la URL del `file` (p. ej. `sections/{file}` o `templates/html/{file}`). Se usa el HTML “completo” del archivo.
- **Caché**: `sectionCache` y `loadedSections` en `app.js` evitan cargar el mismo `file` varias veces. Si se usa un array `tematicas`, la lógica es la misma.
- **Tema en miniaturas**: el grid recibe la clase del tema actual (`selectTheme` añade la clase al `#category-sections-grid`), de modo que las miniaturas que renderizan HTML heredan los estilos del tema seleccionado.

---

### Cómo se inserta el ítem cuando el usuario lo añade (sección o temática)

1. **En `app.js`**: al hacer clic en “+” se llama a `addSectionToPreview(sectionNumber, options)`. El "sectionNumber" es el `id` del ítem en el array (sección o temática).
2. **Carga del HTML**: se hace `fetch` a la ruta del `file` (p. ej. `sections/${section.file}` o la base que use el proyecto) y con el texto se obtiene el primer `<section>` o `<footer>` del HTML (no todo el documento).
3. **Historial**: si existe `historyManager`, se crea un `SectionAddCommand` con ese HTML y `insertIndex` (posición donde insertar).
4. **Envío al iframe**: se envía un `postMessage` con tipo `'ADD_SECTION'` y datos: `sectionNumber`, `html`, `insertIndex`, etc.
5. **En `preview.js`**: el listener recibe `ADD_SECTION` y llama a `addSection(sectionNumber, html, ...)`. Ahí se:
   - Parsea el `html` y se queda con el nodo `<section>` o `<footer>`.
   - Añade la clase `section` y los atributos `data-section={sectionNumber}` y `data-section-uid` (único por instancia).
   - Inserta el nodo en `#preview-content`: al final o en `insertIndex` si se indica.
   - Se inicializa TinyMCE, menú de sección, opacidad de overlay, etc.

La misma lógica sirve si el array es de temáticas: el ítem puede aparecer varias veces en el preview; cada instancia tiene su propio `data-section-uid` pero el mismo `data-section` (id del tipo de ítem).

---

### De dónde se cogen los nombres de cada ítem (sección o temática)

- **Nombre visible en la UI**: viene del campo **`name`** del objeto correspondiente en el array usado en `public/js/app.js` (**`sections`** o **`tematicas`**). No se extrae del HTML ni del nombre del archivo; es un texto fijo por entrada (ej. `'Hero'`, `'My Wedding'`, `'Pricing 2'`).
- **Identificador interno**: `id` (numérico o string) y `file` (nombre del archivo en la carpeta que corresponda).

---

## ESTILOS

### Lógica para cambiar de estilos (temas)

- **Definición de temas**: en `public/js/app.js` existe un array **`themes`** (aprox. líneas 520–645) con objetos `{ id, name, colors }`. El `id` es la clase CSS del tema (ej. `theme-light-minimal`, `theme-dark-modern`).
- **Selección**: al elegir un tema en la UI se llama a **`selectTheme(themeId)`** en `app.js`. Esa función:
  - Actualiza **`currentTheme`** y la UI (botón activo, panel de temas).
  - Añade la clase del tema al **`#category-sections-grid`** para que las miniaturas de secciones hereden el tema.
  - Envía al iframe un **`postMessage`** con tipo **`SET_THEME`** y `data: { theme: themeId }`.
- **En el iframe** (`preview.js`): el mensaje `SET_THEME` llama a **`setTheme(theme)`**, que:
  - Quita del `body` y de `#preview-content` cualquier clase que empiece por `theme-` o `custom-theme-`.
  - Añade la clase del nuevo tema a `body` y a `#preview-content`.
- **Archivos CSS**: los estilos de temas y secciones vienen de:
  - **`dist/output.css`**: salida de Tailwind (incluye utilidades y posibles temas).
  - **`public/css/sections.css`**: estilos de secciones y variables/reglas asociadas a clases `.theme-*`.
- **Variables CSS**: cada tema define colores y tipografías mediante variables CSS aplicadas cuando `body` (o el contenedor) tiene la clase correspondiente (ej. `theme-light-minimal`). No se modifican archivos al cambiar de tema; solo se cambia la clase en el DOM.

### Estilos de template (estética del evento)

- **`templateStyles`** en `app.js` (minimal, classic, rustic, luxe) agrupa **templates completos** (páginas HTML enteras), no secciones sueltas. Cada estilo tiene `name`, `icon` y `templates[]` con `{ id, name, url }`.
- Cambiar de “estilo” en el menú lateral muestra otro conjunto de templates; no cambia el tema (colores/fuentes) de las secciones ya colocadas. El tema se cambia aparte en el selector de temas.

---

## SCRIPTS

### ¿Se ejecutan scripts automáticamente para generar las imágenes de preview?

**No.** Ningún script de generación de imágenes se ejecuta de forma automática (por CI, al guardar, etc.). Hay que lanzarlos manualmente.

| Script / comando | Qué hace |
|------------------|----------|
| **`npm run sections:screenshots`** (`node screenshot-generator.cjs`) | Abre `all.html` en Puppeteer (con servidor local), aplica un tema, hace scroll por viewports y genera en **`screenshots/`** imágenes `1.jpg`, `2.jpg`, … (y variantes `-bg` con fondos). El **orden** de los ítems en `all.html` debe coincidir con el **`id`** en el array (`sections` o `tematicas`) para que `screenshots/3.jpg` sea el ítem con `id: 3`. |
| **`npm run templates:screenshots`** (`node template-screenshot-generator.cjs`) | Genera una imagen en scroll por template completo y la guarda en **`templates/previews/{id}.jpg`**. La lista de templates está en el array `TEMPLATES` dentro del script. |
| **`npm run sections:thumbnails`** (`node scripts/generate-sections-thumbnails.mjs`) | Copia **`sections/`** → **`sections_thumbnails/`** y redimensiona URLs de imágenes de Unsplash en el HTML (para miniaturas más ligeras). **No** genera archivos `.jpg`; solo prepara HTML con imágenes más pequeñas. |

Requisitos para `sections:screenshots`: tener el proyecto servido en local (ej. `http://localhost/nine-screen-canvas-flow/`) y que `all.html` exista y contenga los ítems (secciones o temáticas) en el orden correcto según su `id`.

---

## TAREAS PREVIAS DEL PROGRAMADOR

Para **añadir un nuevo ítem** (sección o temática) además del HTML hace falta:

1. **Añadir una entrada en el array** (`sections` o `tematicas`) en `public/js/app.js` con `id`, `name`, `file`, `tags` y `is_pro` (y `hidden` si aplica). Si usas temáticas, el array puede llamarse `tematicas` y tener exactamente la misma estructura.
2. **Crear el archivo HTML** en la carpeta que use el proyecto (`sections/`, `templates/html/`, etc.) con el nombre indicado en `file`, con un único nodo raíz `<section>` o `<footer>` (o el bloque que la app espere).
3. **Incluir el ítem en `all.html`** en la posición que corresponda al `id` (para que las capturas del generador coincidan con `screenshots/{id}.jpg`).
4. **Generar/actualizar screenshots**: ejecutar `npm run sections:screenshots` con el servidor local levantado.
5. **Opcional**: ejecutar `npm run sections:thumbnails` si el ítem usa imágenes Unsplash y quieres versiones reducidas en `sections_thumbnails/`.
6. **Opcional**: si el ítem usa interactividad (carousel, acordeón, etc.), añadir en `preview.html` el `<script>` correspondiente (p. ej. `public/js/sections/fp-theme-xxx.js`).

Para **añadir un nuevo template completo** (página entera): crear el HTML en `templates/html/`, añadirlo al array `TEMPLATES` en `template-screenshot-generator.cjs`, registrarlo en `templateStyles` (o en el array de temáticas si el proyecto usa uno) en `app.js` y ejecutar `npm run templates:screenshots` para generar su preview en `templates/previews/`.

---

## Resumen de archivos clave

| Archivo | Rol |
|---------|-----|
| **`public/js/app.js`** | Lista `sections` o `tematicas`, `categories`, `templateStyles`, `themes`; lógica del menú, añadir ítem al preview, selección de tema, envío de mensajes al iframe. |
| **`public/js/preview.js`** | Código dentro del iframe: recibe `ADD_SECTION`, `SET_THEME`, etc.; inserta nodos en `#preview-content`, aplica tema en `body` y en `#preview-content`, serializa ítems para guardar. |
| **`sections/*.html`** (o `templates/html/*.html`) | HTML de cada ítem (una raíz `<section>` o `<footer>`; o documento completo si son templates). |
| **`sections_thumbnails/*.html`** | Copia con imágenes redimensionadas (generada por `sections:thumbnails`), si se usa. |
| **`all.html`** | Página con todos los ítems (secciones o temáticas) en orden; usada por `screenshot-generator.cjs` para generar `screenshots/{id}.jpg`. |
| **`screenshot-generator.cjs`** | Genera imágenes de preview por viewport desde `all.html`. |
| **`template-screenshot-generator.cjs`** | Genera una imagen por template completo en `templates/previews/`. |
| **`preview.html`** | Página cargada en el iframe; incluye `output.css`, `sections.css` y scripts de secciones. |
| **`dist/output.css`** / **`public/css/sections.css`** | Estilos globales y de temas; las clases `theme-*` en `body` aplican el tema. |
