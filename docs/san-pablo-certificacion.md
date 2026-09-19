# Certificación de San Pablo

Estado al 18/09/2026. San Pablo certifica aparte de Caspinchango: sus propios
partes, períodos y lotes; los precios, desde el 18/09/2026, son únicos para
los dos campos. Las pantallas son las mismas de Caspinchango, con props que
cambian lo que difiere.

## Rutas

| Ruta | Pantalla |
| --- | --- |
| `/produccion/san-pablo` | grilla de meses |
| `/produccion/variables` | Remuneración, Lotes y Valores admisibles (de todo Producción) |
| `/produccion/variables/remuneracion` | precios por tarea, únicos para los dos campos (`ProduccionVariables`) |
| `/produccion/variables/lotes/san-pablo` | padrón de lotes (`ProduccionLotes`) |
| `/produccion/san-pablo/:anio/:mes` | menú del mes: Datos certificación e Informes |
| `…/:mes/planilla` | carga de partes (`ProduccionCertificadoMes`) |
| `…/:mes/informes` | menú de informes |
| `…/:mes/informes/mes` y `…/tareas-personal` | los dos informes |

Variables dejó de colgar de cada campo el 18/09/2026: es la tarjeta chica del
medio en la entrada de Producción y lo que hay adentro vale para los dos
campos. Lo único que sigue siendo de un campo son los lotes, que piden antes
cuál (`ProduccionCampoMenu`).

## Lo que diferencia a San Pablo

Todo sale de props de `ProduccionCertificadoMes`, con las listas en `App.jsx`:

- **`dosTurnos`** — el día se corta al mediodía: Entrada 1, Salida 1, Entrada 2
  y Salida 2. El total suma los dos tramos y lo calcula el backend
  (`calcularTotalHoras`), que guarda `horaIngreso2` y `horaEgreso2`.

  Los dos tramos **no se pueden pisar** (18/09/2026): la Entrada 2 tiene que
  ser posterior a la Salida 1, y el segundo tramo tampoco puede arrancar antes
  que el primero ni dar la vuelta al reloj hasta taparlo. Mientras se pisen,
  los dos campos del segundo tramo van en rojo y el parte no se guarda; el
  backend rechaza lo mismo con 400 al crear y al editar. La cuenta se mide
  desde la Entrada 1, así también vale para un turno que cruzó la medianoche
  (22:00 → 02:00 y después 03:00 → 06:00 es válido). Está en los dos lados:
  `tramosSeSolapan` en `partes.controller.js` y en `ProduccionCertificadoMes.jsx`.
  Prueba: `node scripts/_pruebaTramos.mjs` (back, 16 casos, no toca la base).
- **`conEstado` + `tareasConEstado`** (`herbicida`, `desmalezado`,
  `pulverizado`) — el círculo verde / rojo del parte (`terminado`). En las
  demás tareas se ve gris y no se puede tocar. El lote terminado se muestra en
  blanco sobre verde.

  El estado **se cambia solo editando el parte** (18/09/2026): en la tabla el
  círculo es un indicador y no se puede clickear. Va como `<span>` y no como
  botón apagado (`soloLectura` en `CirculoEstado`) para que se lea igual que el
  resto de la fila. Por eso ya no existe `PUT /api/partes/:id/terminado`:
  `terminado` viaja en el parte, como cualquier otro campo.
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

## El pago por lote terminado

Hecho el 18/09/2026. El herbicida, el desmalezado y el pulverizado no se pagan
por jornada: se pagan cuando el lote queda terminado. El círculo verde de la
parte marca ese momento y dispara el reparto al guardarlo.

Todo vive en `TableroBack/src/services/repartoLotes.service.js`.

**Qué se reparte.** La medida del lote, según la unidad de la tarea: las tareas
en Plantas reparten las plantas del padrón y las que están en Hectárea reparten
las hectáreas. Las que están en Tancadas (casi todos los pulverizados) quedan
afuera y se siguen cargando a mano; el sistema no avisa nada en ese caso.

**Entre quiénes.** Entre las jornadas del grupo, en proporción a las horas de
cada una (`totalHoras`). Si ninguna tiene horas cargadas se reparte en partes
iguales. El sobrante del redondeo (dos decimales) se le suma a la última para
que el total dé la medida exacta.

**El grupo** es *lote + tarea*, desde el cierre anterior hasta el cierre que lo
termina. Una segunda pasada en el año es un grupo nuevo y vuelve a repartir la
medida entera. El lote se compara sin distinguir mayúsculas, espacios ni
guiones: "L 12", "l12" y "L-12" son el mismo.

**El cierre es de un día, no de un parte** (18/09/2026). El mismo lote con la
misma tarea lo pueden dar por terminado dos personas distintas, cada una en su
parte, y eso sigue siendo un solo cierre: un solo grupo y un solo reparto.
Todas las jornadas del día del cierre entran, las hayan marcado o no y sin
importar en qué orden se cargaron. Mientras quede una marcada el lote sigue
terminado; el reparto se deshace recién cuando se desmarca la última.

**Terminado un lote no se vuelve a trabajar en él con esa tarea.** Si se carga
un parte con fecha posterior al cierre, la planilla avisa con el lote, la fecha
del cierre y la tarea, y deja elegir entre *Guardar igual* y *Corregir*: no lo
bloquea porque una segunda pasada más adelante en el año es válida y se paga
aparte. El aviso también sale al cambiarle la fecha a un parte ya cargado. Los
cierres salen de `GET /api/partes/cierres-de-lotes?establecimiento=san-pablo`
(`[{ lote, tarea, fecha }]`), que la planilla pide una vez al abrir el mes y
vuelve a pedir cuando cambia alguno: así no hay que preguntar en cada parte.

**Dónde queda el número.** En la `cantidad` de cada parte, escrita: no se
calcula al vuelo. Contable - Pagos no se toca, el número queda congelado y se
puede auditar. `ParteDiario.repartido` dice cuáles las escribió el sistema, así
una cantidad cargada a mano no se pisa ni se borra. En la planilla la cantidad
repartida se ve en verde.

**En qué mes se paga.** En el del cierre, aunque haya jornadas de meses
anteriores ya cerrados: a esas se les escribe `periodo` con el mes del cierre y
`motivoFueraDeCierre` = "Pago por lote terminado", que es la maquinaria que ya
existía para los partes fuera de cierre. La fila deja de estar en la planilla
del mes viejo y aparece, con sus horas y su cantidad, en la del mes del cierre.
Un parte que alguien ya había movido a mano, con su propia explicación, se deja
donde está.

**Al desmarcar** se borra todo lo del grupo: la cantidad vuelve a estar vacía y
los partes vuelven al mes en el que cae su fecha.

**Cuándo se rehace.** En cada parte que se guarda, se edita o se borra, porque
las horas que se reparten pasan a ser otras. Si el grupo todavía está abierto,
un reparto viejo se limpia. Cambiar un parte de
lote o de tarea rehace los dos grupos, el que deja y el que entra.

**Lo que avisa la pantalla.** Guardar, editar y borrar un parte devuelven
`reparto` junto con la respuesta de siempre. Con `estado` en "repartido" sale
el cartel con la medida, cuántas jornadas la comparten y el mes en que se paga;
con "limpiado", que el lote volvió a estar en proceso y se borraron las
cantidades; con `aviso`, el motivo por el que no se pudo repartir (el lote no
está en el padrón o no tiene cargada la medida). En esos tres casos el cartel
reemplaza al "Parte guardado" de siempre, y la planilla recarga el mes porque
cambiaron también otras filas. En el resto —que es lo habitual— no recarga
nada.

**Prueba:** `node --env-file .env scripts/_pruebaReparto.mjs` (back) arma sus
propios datos, corre los 31 casos y los borra por `_id`.

**Lo que cuesta guardar.** El reparto corre en cada parte que se guarda, así
que está hecho para no pesar: en Caspinchango no hace ni una consulta (la
guarda del establecimiento va primero de todo), y en San Pablo con el lote
abierto es una sola, con el índice `{ establecimiento, tarea, fecha }`. La
tarea del padrón se lee una vez por parte y se comparte con la validación de la
cantidad. La planilla **no recarga el mes** salvo que el backend avise que
rehizo un reparto (`reparto.estado === "repartido"` en la respuesta de guardar,
editar y borrar): esa recarga es casi un segundo.

Para medirlo: `node --env-file .env scripts/_contarConsultas.mjs` cuenta las
idas y vueltas a la base de cada operación. Contra el cluster cada una son
~100/200 ms, y el número no depende de cómo esté la red, así que es la medida
que sirve. Hoy un alta son 4 tandas: las lecturas previas (juntas), el insert,
las dos cosas de después (juntas) y el populate de la respuesta.

## Pendiente

- Los pulverizados que se miden en Plantas ("Pulverizado con arco",
  "Pulverizado Metalfor, UltraBajoVolumen") sí entran en el reparto, pero la
  carga del parte les sigue exigiendo la cantidad a mano y después se la pisa.
  O se los suma a `TAREAS_SIN_CANTIDAD` o se los deja afuera del reparto.
- El informe de tareas por personal suma bien las cantidades repartidas, pero
  todavía no muestra el detalle del reparto (qué lote, cuántas horas de cada
  uno). Los datos ya viajan: `resumen=1` devuelve `totalHoras`, `lote`,
  `terminado` y `repartido`.
