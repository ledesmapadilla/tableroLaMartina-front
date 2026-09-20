# Adjuntos de Compras (19/09/2026)

Un ítem de pedido puede llevar un archivo: el presupuesto que sube el analista
y lo que suma el taller al pedir (un remito, la foto de la pieza).

## Antes: no se guardaban

Hasta acá los adjuntos eran un prototipo de front. `services/archivoPrototipo.js`
los guardaba en el `sessionStorage` del navegador, en base64. Eso quería decir
que el archivo **se perdía al cerrar la pestaña**, no se veía desde otra
computadora, y el link que armaba (`data:…`) lo bloquea Chrome desde 2017, así
que al tocarlo no pasaba nada. El archivo se borró; esto lo reemplaza.

## Ahora: Cloudinary, con la URL guardada en el ítem

El archivo va **del navegador directo a Cloudinary**. El back solo firma la
subida (`GET /api/archivos/firma`): el backend corre en Vercel, donde el cuerpo
de un pedido no puede pasar de unos 4,5 MB, y la foto de un presupuesto sacada
con el celular ya lo supera. El límite que sí ponemos es de 10 MB por archivo,
en `services/archivos.js`.

**Qué se puede adjuntar:** PDF, imágenes, Excel (`.xlsx`, `.xls`, `.csv`) y Word
(`.doc`, `.docx`). Cloudinary guarda las imágenes y los PDF como `image` y el
resto como `raw`; un Excel no se previsualiza en el navegador, se descarga, que
es lo esperable. Para sumar un formato se toca el `accept` del input en las tres
pantallas que adjuntan.

En el ítem queda guardado:

```js
archivo: { url, nombre, publicId, tipo }  // tipo: "image" | "raw" (los PDF)
```

`publicId` y `tipo` son para poder borrarlo después de Cloudinary.

## Configuración (sin esto, adjuntar devuelve 503)

En `TableroBack/.env` —y en las variables de entorno de Vercel—:

```
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

Salen de Cloudinary › Settings › API Keys. **El secret nunca va al front**: con
él se firma en el back, y lo que viaja al navegador es una firma que vale un
rato y solo para la carpeta `la-martina/compras`.

Falta un paso más, que es fácil de pasar por alto: en las cuentas gratuitas
Cloudinary viene con la entrega de PDF y ZIP **bloqueada**. Hay que destrabar
Settings › Security › *"Allow delivery of PDF and ZIP files"*, o el PDF sube
bien pero al abrirlo da error.

## Quién puede adjuntar

Adjuntar es editar, así que pide "Editar" en la tabla de Roles:

- **Taller** (`compras.pedidos`): desde la columna Adjunto de sus pedidos.
- **Analista** (`compras.analista`): desde el análisis del ítem.

El campo `archivo` está en la lista blanca de esos dos permisos
(`TableroBack/src/permisos/pedidos.js`), así que el comprador y Gerencia lo ven
pero no lo cambian. Sin permiso, el botón queda deshabilitado y la firma
devuelve 403.

## Borrado

Quitar el adjunto son dos pasos: primero se lo saca del ítem (el PUT de
siempre, que es el que controla los permisos) y después se borra de Cloudinary.
En ese orden a propósito: si falla el segundo queda un archivo suelto, que no
molesta a nadie, en lugar de un link roto en pantalla.

Cuando se borra un ítem entero, su archivo **queda en Cloudinary**. Es un
pendiente conocido; con el volumen de este proyecto no apura.
