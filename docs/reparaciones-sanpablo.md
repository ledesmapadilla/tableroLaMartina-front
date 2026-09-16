# Reparaciones San Pablo

Taller de la base San Pablo (desde el 16/09/2026). Se entra por la tarjeta de
Mantenimiento.

## Navegación

1. `/reparaciones/sanpablo` — `CosechasSanPablo`: select "Para cosecha" (de 2027
   a cinco años después del actual, `utils/cosechas.js`). Viene marcado el año
   actual; elegir otro entra directo y tocar la tarjeta entra al marcado.
2. `/reparaciones/sanpablo/:cosecha` — `ReparacionesSanPablo`: 7 tarjetas.
3. `/reparaciones/sanpablo/:cosecha/<tipo>` — la tabla de cada tarjeta.
   `RutaCosecha` manda al 404 si la cosecha no es válida. Colectivos, Carros
   porta bines y Pulverizadoras todavía son 404.

Permiso: `sanpablo.ingresos` (Roles › San Pablo).

## Datos

Una sola colección, `IngresoSanPablo` (back: `ingresossanpablo.controller.js`,
ruta `/api/ingresos-sanpablo`). Cada documento tiene `cosecha` y `tipo`.

- **Manitous, Tolvas, Carros porta escaleras** (`IngresosSanPablo.jsx`): equipo
  (CC del padrón con ese equipo), fecha, quién lo ingresa (supervisores,
  `utils/supervisores.js`), revisada y plan de mantenimiento (círculo azul sí /
  rojo no), observaciones. Los carros cargan además la cantidad de escaleras y
  entran una sola vez por cosecha.
- **Escaleras** (`IngresosEscaleras.jsx`), cuatro clases de filas:
  - de un carro (`origen` = ingreso del carro): se crean, cambian y borran con
    el carro; acá se cargan sanas, rotas y reparadas.
  - nuevas (`nuevas`): fecha, cantidad, quién las construye.
  - retiros (`retiro`): fecha, supervisor, carro, cantidad. Cada retiro anota
    una **salida** en Carros porta escaleras (`salida`, `origen` = retiro), que
    solo se toca desde Escaleras.
  - bajas (`baja`): fecha, cantidad, motivo, quién las desecha, a quién se avisa.

  Retiros y bajas no pueden sacar más escaleras de las que quedan en la
  cosecha. El historial muestra, por supervisor, retiradas de la cosecha
  anterior e ingresadas y retiradas de esta (sin nuevas ni bajas).

Todo lo cargado antes de las cosechas quedó en la 2027.
