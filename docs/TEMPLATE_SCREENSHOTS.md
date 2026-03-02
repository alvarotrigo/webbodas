# Template screenshot generator

Misma lógica que el generador de secciones (`screenshot-generator.cjs`), pero para **templates HTML completos**. Genera **una imagen en scroll** del template entero (viewport a viewport, unida en una sola imagen vertical) y la guarda en `templates/previews/<id>.jpg`.

## Uso

1. **Servidor local corriendo** (por ejemplo la raíz del proyecto servida en `http://localhost/nine-screen-canvas-flow/`).

2. **Generar todas las previews** (el generador descubre automáticamente los HTML en `templates/html/`):
   ```bash
   npm run templates:screenshots
   ```
   o:
   ```bash
   node template-screenshot-generator.cjs
   ```

3. **Generar solo un template** (p. ej. `template1`):
   ```bash
   node template-screenshot-generator.cjs template1
   ```

## Añadir un template nuevo (flujo automatizado)

1. **Crea el HTML** del template y guárdalo en `templates/html/` (p. ej. `template2.html`) o en una subcarpeta (p. ej. `templates/html/mi-evento/index.html`).

2. **Añade en el `<head>`** del mismo archivo dos meta tags para el nombre y la categoría (estilos):
   ```html
   <meta name="template-name" content="Mi boda">
   <meta name="template-styles" content="minimal">
   ```
   - **template-name**: nombre que se muestra en la tarjeta. Si no lo pones, se usará el id (nombre del archivo o de la carpeta).
   - **template-styles**: uno o más estilos separados por coma. Valores válidos: `minimal`, `classic`, `rustic`, `luxe`. Un template puede estar en varios (p. ej. `content="minimal,classic"`).

3. **Opcional**: ejecuta `npm run templates:screenshots` para generar la imagen de preview. La app carga la lista de templates desde `api/list-templates.php` al abrir; no hace falta editar `app.js` ni el generador.

## Detalles

- **Descubrimiento**: la app usa `api/list-templates.php` (escanea `templates/html/`, lee las meta tags y devuelve JSON). El generador de screenshots descubre los mismos archivos por filesystem (raíz: `*.html`; subcarpetas: `*/index.html`).
- **Viewport**: 1920×1080 (desktop), igual que el generador de secciones.
- **Tiempos de espera**: 2000 ms tras cargar, 1000 ms tras cada scroll (animaciones).
- **Menú fijo/sticky**: para que el menú no se repita en cada tramo de la tira, el generador inyecta CSS que convierte temporalmente todos los elementos `position: fixed` y `position: sticky` en `position: static` durante la captura. El menú sale solo una vez en su posición en el flujo del documento.
- **Salida**: una sola imagen JPG por template (max width 700 px, calidad 85 %), lista para mostrar en la tarjeta 2:3 con scroll al hover.
- **Lazy load**: en la app las imágenes usan `loading="lazy"`.
