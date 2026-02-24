# webbodas

Ok, vago, aquí lo important:

## Crear base de datos

Nombre: fpstudio
Usuario: root
password: supersecret
puerto: 3306

Puedes ver esta info en la config del `.env`:

```
DB_LOCAL_HOST=xxx
DB_LOCAL_NAME=xxx
DB_LOCAL_USER=xxx
DB_LOCAL_PASS=xxx
DB_LOCAL_PORT=xxx
```

## Crear tablas en base de datos

Tienes que ejecutar estas queries para crear las tablas en la base de datos.

> config/mysql-schema.sql 


## Login:

http://localhost/nine-screen-canvas-flow/auth-wall.html

## Lista de Pages
http://localhost/nine-screen-canvas-flow/pages.php

## Modo dev

Para debugear en local y ver cosas más fácil, creé el "modo developer" que se acceder usando en la URL  el parámetro &developer=1 

Todo lo de developer lo metí en el fichero `dev.js` para separarlo del resto.

## Tips AI

- Decirle que al crear nuevas funcionalidades cree un nuevo archivo JS o CSS para ellas. Así lo separa y puedes incluirlo o no y trabaja mejor con ficheros pequeños.

- Usar modo /plan para planear funcionalidades nuevas o cambios complejos

- Usar el modelo Opus 4.6 para planear la funcionalidad antes de hacer nada.

- Para escribir código el Sonnet 4.6 está bien, es el que uso yo.

- Para pensar como hacer cosas, yo suelo ir a ChatGPT que lo hace muy bien también.

## Como funciona el editor


### Web en iframe

La web se crea en un iframe, que luego es el que al darle a preview se hace grande y tapa el frame principal.

Es decir, la preview tiene que importar sus propios CSS, JS y demás. 

Se comunica con el parent frame a través de mensajes de de window o algo así.

### Undo/Redo

Si añades alguna funcionalidad, simpemente dile que la añada al history manager para poder hacer undo/redo.

### Usando Tailwind

Los bloques ahora usan tailwindcss. Pero definiendo colores usando variables CSS, que están defindas en `public/css/sections.css` 


### Usando packge.json

Esto se usa para definir que componentes usar y para definir nombres de scripts que se pueden ejecutar (de node, gulp y demás)