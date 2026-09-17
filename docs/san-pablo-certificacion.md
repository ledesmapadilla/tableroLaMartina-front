# Certificación de San Pablo

Estado al 17/09/2026. San Pablo certifica aparte de Caspinchango: sus propios
partes, períodos, precios y lotes. Las pantallas son las mismas de
Caspinchango, con props que cambian lo que difiere.

## Rutas

| Ruta | Pantalla |
| --- | --- |
| `/produccion/san-pablo` | grilla de meses + tarjeta Variables |
| `/produccion/san-pablo/variables` | menú: Remuneración y Lotes |
| `/produccion/san-pablo/variables/remuneracion` | precios por tarea (`ProduccionVariables`) |
| `/produccion/san-pablo/variables/lotes` | padrón de lotes (`ProduccionLotes`) |
| `/produccion/san-pablo/:anio/:mes` | menú del mes: Datos certificación e Informes |
| `…/:mes/planilla` | carga de partes (`ProduccionCertificadoMes`) |
| `…/:mes/informes` | menú de informes |
| `…/:mes/informes/mes` y `…/tareas-personal` | los dos informes |

Caspinchango no tiene lotes: su Variables sigue entrando directo a los precios.

## Lo que diferencia a San Pablo

Todo sale de props de `ProduccionCertificadoMes`, con las listas en `App.jsx`:

- **`dosTurnos`** — el día se corta al mediodía: Entrada 1, Salida 1, Entrada 2
  y Salida 2. El total suma los dos tramos y lo calcula el backend
  (`calcularTotalHoras`), que guarda `horaIngreso2` y `horaEgreso2`.
- **`conEstado` + `tareasConEstado`** (`herbicida`, `desmalezado`,
  `pulverizado`) — el círculo verde / rojo del parte (`terminado`). En las
  demás tareas se ve gris y no se puede tocar. El lote terminado se muestra en
  blanco sobre verde. Se alterna desde la tabla con `PUT /api/partes/:id/terminado`.
- **`tareasSinCantidad`** (`desmalezado`, `herbicida`) — la cantidad no es
  obligatoria en esas tareas; en el resto sí. El backend controla lo mismo
  (`faltaLaCantidad`).
- **`tareasDestacadas`** — las siete tareas de todos los días van primero y en
  negrita en el desplegable (`SelectBuscador` con `destacada`).
- **`conPadronDeLotes`** — el lote sale de Variables › Lotes; igual se puede
  escribir uno que no esté dado de alta.

## Lotes

`Lote` (back): `establecimiento`, `nombre`, `hectareas`, `plantas`,
`observaciones`. API `/api/lotes`, con el permiso de Variables. El nombre no se
repite dentro del mismo campo ("L 12", "l12" y "L-12" son el mismo).

En el parte el lote sigue guardándose como **texto** (`ParteDiario.lote`), no
como referencia: así los partes viejos no hay que migrarlos. El reparto va a
buscar el lote por nombre normalizado.

## Pendiente: el pago por lote terminado

La parte contable todavía no está hecha. Lo decidido con el usuario
(17/09/2026):

1. Las tareas de **herbicida, desmalezado y pulverizado** se pagan recién
   cuando el lote termina. El círculo del parte marca ese momento.
2. Lo que se reparte es la medida del lote, **según la unidad de la tarea**:
   las tareas en Plantas reparten las plantas del lote y las que están en
   Hectárea reparten las hectáreas. Los pulverizados, que hoy están en
   Tancadas, quedan afuera del reparto y se siguen cargando a mano.
3. El reparto entre las personas que trabajaron es **proporcional a las horas**
   (`totalHoras` de cada parte del grupo).
4. El grupo a repartir es *lote + tarea*, con los partes desde que ese lote se
   terminó la vez anterior (una segunda pasada en el año es un grupo nuevo).
5. Se paga **todo en el mes en que se termina** el lote, aunque haya jornadas
   de meses anteriores ya cerrados.
6. Al marcar terminado, el sistema **escribe la cantidad repartida en cada
   parte** en vez de calcularla al vuelo: Contable - Pagos no se toca, el
   número queda congelado y se puede auditar. Al desmarcar, se borra.

Falta: `resumen=1` de `GET /api/partes` no devuelve `totalHoras`; hay que
sumarlo para que el informe pueda mostrar el detalle del reparto.
