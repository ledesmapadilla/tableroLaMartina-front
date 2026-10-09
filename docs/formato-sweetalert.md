# Formato de los SweetAlert

Relevado el 08/10/2026 sobre los ~420 `Swal.fire` del front. Todo aviso nuevo
sigue esto; no inventar tamaños, colores ni tiempos propios.

## 0. Lo que ya está puesto para todos

`src/index.css` (bloque "Estilos globales SweetAlert2") ya da el borde
redondeado de 18px, la sombra, el título en 1.1rem, el texto en 0.88rem gris,
los botones de 0.84rem con esquinas de 10px y el ícono achicado al 85%. **No se
pisa con estilos inline.** Lo único que se pone en cada llamada es lo de abajo.

Siempre centrado (sin `toast` ni `position`).

## 1. Aviso de éxito (se cierra solo)

```js
Swal.fire({
  icon: "success",
  title: "Guardado",          // corto: qué pasó
  text: "...",                // opcional, una línea de detalle
  timer: 1500,                // 1400–1500
  showConfirmButton: false,
  width: "300px",
});
```

Después de una acción que el usuario pidió (guardar, cotizar, pedir) va **solo
este aviso, sin confirmación previa** (pedido del usuario, 08/10/2026).

## 2. Error

```js
Swal.fire({ icon: "error", title: "No se pudo guardar", text: err.message, width: "300px" });
```

El título dice qué falló ("No se pudo borrar", "Sin conexión"); el detalle va
en `text`. Si lleva botón, `confirmButtonColor: "#1e293b"`.

## 3. Aviso con botón (info o advertencia que hay que leer)

```js
Swal.fire({
  icon: "info",               // o "warning"
  title: "La camioneta está parada",
  text: "Para ponerla en servicio, terminá la tarea en Reparaciones.",
  width: "320px",
  confirmButtonColor: "#1e293b",
});
```

## 4. Confirmación

Solo para lo que no se deshace (borrar, rechazar, sacar algo cargado). Lo demás
no se confirma.

```js
const { isConfirmed } = await Swal.fire({
  icon: "warning",            // "question" si no es destructivo
  title: "¿Borrar el repuesto?",
  text: "Esta acción no se puede deshacer.",
  width: "320px",
  showCancelButton: true,
  confirmButtonText: "Sí, borrar",
  cancelButtonText: "Cancelar",
  confirmButtonColor: "#dc2626", // rojo para borrar; "#1e293b" para el resto
  cancelButtonColor: "#64748b",
});
if (!isConfirmed) return;
```

- Título como pregunta: "¿Borrar…?", "¿Eliminar…?".
- Botón: "Sí, borrar" / "Sí, eliminar" / el verbo de la acción ("Rechazar").
- Si pide un motivo, `input: "textarea"` con `inputLabel` y `preConfirm` que
  valide (ver `rechazar` en `compras/AnalistaPedidos.jsx`).

## 4 bis. Escribir un texto (observaciones, notas)

Más ancho que una confirmación, para que el texto se lea entero, y **sin
placeholder** (pedido del usuario, 08/10/2026).

```js
const { value, isConfirmed } = await Swal.fire({
  title: "Observaciones",
  text: nombreDelItem,          // de qué es
  input: "textarea",
  inputValue: lo que ya tenía || "",
  width: "440px",
  showCancelButton: true,
  confirmButtonText: "Guardar",
  cancelButtonText: "Cancelar",
  confirmButtonColor: "#1e293b",
  cancelButtonColor: "#64748b",
});
```

Para solo leerlo (sin permiso de editar), el mismo ancho con un botón
"Cerrar".

## 5. Listas largas (detalle, historial)

No se arman a mano: `verDetallePedido` y `verHistorialPedido` de
`compras/detallePedido.js` (ancho `min(640px, 95vw)`, con scroll).

## Excepciones conocidas

- Los de Gerencia (`compras/Gerencia.jsx`, `GerenciaHistorial.jsx`) van en
  340–380 porque muestran fichas de pedidos y Gerencia se usa en el celular
  (tiene que entrar en ~360px).
- Compras tiene algunos con `buttonsStyling: false` y botones
  `btn btn-outline-*` (motivos de rechazo y revisión). No copiarlos en
  pantallas nuevas: van con los colores de arriba.
