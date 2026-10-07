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
| `/produccion/variables/remuneracion/:campo` | precios por tarea de cada campo; Berdina y San Pablo arrancaron el 30/09/2026 con la misma lista (`ProduccionVariables`) |
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
- **`conEstado` + `tareasConEstado`** (`herbicida`, `desmalezado`, `fertilizacion` desde el 07/10/2026; el
  `pulverizado` salió el 25/09/2026) — el círculo verde / rojo del parte (`terminado`). En las
  demás tareas se ve gris y no se puede tocar. El lote terminado se muestra en
  blanco sobre verde.

  **Lote completo** (07/10/2026): en la tabla, una jornada que quedó en proceso
  pero cuyo lote ya se terminó en otra jornada (hay un cierre de ese lote y esa
  tarea el mismo día o después, según `cierres-lotes`) muestra el círculo
  **gris, sin relleno y con la cruz** en vez de rojo. Con varios lotes, cuando ninguno sigue
  abierto. En el Excel dice "Lote completo". Es solo cómo se ve: no cambia
  `terminado` ni el reparto (`loteCompleto` y `estaCompleto`).

  El estado **se cambia solo editando el parte** (18/09/2026): en la tabla el
  círculo es un indicador y no se puede clickear. Va como `<span>` y no como
  botón apagado (`soloLectura` en `CirculoEstado`) para que se lea igual que el
  resto de la fila. Por eso ya no existe `PUT /api/partes/:id/terminado`:
  `terminado` viaja en el parte, como cualquier otro campo.
- **`tareasSinCantidad`** (`desmalezado`, `herbicida`, `fertilizacion`) — la cantidad no es
  obligatoria en esas tareas; en el resto sí. El backend controla lo mismo
  (`faltaLaCantidad`).
- **El desmalezado va con la medida del lote** (23/09/2026, regla del
  usuario): un lote medido en hectáreas lleva *Desmalezado x Ha* y no
  *Desmalezado Mecánico*; uno medido en plantas, al revés. Se compara la
  unidad de la tarea con la medida cargada en Variables › Lotes, así que vale
  para cualquier tarea de desmalezado. Un lote sin medida (o con las dos) o
  fuera del padrón no se controla. No deja guardar: en la planilla sale el
  aviso y el backend responde 400 al crear y al editar
  (`desmalezadoFueraDeUnidad`, en `repartoLotes.service.js` y en
  `ProduccionCertificadoMes.jsx`). Al sumarlo quedaron 2 partes del 04/09 en
  Showroom con Desmalezado Mecánico que no cumplen: no se tocaron.
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

Hecho el 18/09/2026. El herbicida, el desmalezado y (desde el 07/10/2026) la
fertilización no se pagan
por jornada: se pagan cuando el lote queda terminado. El círculo verde de la
parte marca ese momento y dispara el reparto al guardarlo.

Todo vive en `TableroBack/src/services/repartoLotes.service.js`.

**Qué se reparte.** La medida del lote, según la unidad de la tarea: las tareas
en Plantas reparten las plantas del padrón y las que están en Hectárea reparten
las hectáreas. Las que están en Tancadas quedan afuera y se siguen cargando a
mano; el sistema no avisa nada en ese caso.

**El pulverizado no entra** (25/09/2026, pedido del usuario): no lleva círculo
y la cantidad se carga siempre a mano, también en los que se miden en Plantas
("Pulverizado con arco", "Pulverizado Metalfor, UltraBajoVolumen").

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

**Terminado un lote no se vuelve a trabajar en él con esa tarea en los días
siguientes.** Si se carga un parte con la misma tarea **dentro de los 3 días
posteriores** al cierre, la planilla avisa con el lote, la fecha del cierre, la
tarea y cuántos días pasaron, y deja elegir entre *Guardar igual* y *Corregir*:
no lo bloquea porque puede ser lo que quedó por terminar. **Más allá del tercer
día no dice nada** (22/09/2026, `DIAS_DE_AVISO`): a un mes del cierre es una
segunda pasada normal, que además se paga aparte, y el aviso era puro ruido.
El aviso también sale al cambiarle la fecha a un parte ya cargado. Los
cierres salen de `GET /api/partes/cierres-de-lotes?establecimiento=san-pablo`
(`[{ lote, tarea, fecha }]`), que la planilla pide una vez al abrir el mes y
vuelve a pedir cuando cambia alguno: así no hay que preguntar en cada parte.

**Dónde queda el número.** En la `cantidad` de cada parte, escrita: no se
calcula al vuelo. Contable - Pagos no se toca, el número queda congelado y se
puede auditar. `ParteDiario.repartido` dice cuáles las escribió el sistema, así
una cantidad cargada a mano no se pisa ni se borra. En la planilla la cantidad
repartida se ve en verde.

**En qué mes se paga.** Todo en la certificación en la que se termina el lote,
y nada en las anteriores (25/09/2026, pedido del usuario). Las horas de todas
las jornadas del grupo, de cualquier mes, cuentan para sacar la parte de cada
uno. Ejemplo: el lote 12 tiene 6234 plantas, Olea hizo 10 hs en agosto y
Pacheco 12 hs en septiembre y lo termina. A Olea le tocan 2833,64 y a Pacheco
3400,36, y las dos cantidades se cobran en septiembre.

**La jornada de agosto se queda en agosto**, con sus horas y sin cantidad. Lo
que le toca se paga con un **renglón de pago** en septiembre: un parte que arma
el reparto, con la misma persona, tarea, lote y cliente, 0 horas, la fecha del
día del cierre, la cantidad que le toca y en observación "Pago por lote
terminado: jornada del 20/08/2026 (10 hs)". `ParteDiario.pagoDe` apunta a la
jornada que paga.
- No es una jornada: no entra en el grupo ni en el reparto, y el informe del
  mes no lo cuenta como día trabajado. Sí suma su cantidad en el informe de
  tareas por personal.
- No se edita ni se borra a mano: la planilla muestra un candado en vez del
  lápiz y el tacho, y el back lo rechaza. Se corrige editando la jornada que
  paga.
- Se rehace con el reparto. Borrar la jornada de agosto borra su renglón, y
  desmarcar el cierre borra todos los renglones del grupo. Un renglón que queda
  sin jornada, por ejemplo porque la jornada se pasó a otro lote, se borra en
  el próximo reparto.

Para saber en qué certificación cae cada jornada se usa su fecha, salvo que
alguien la haya pasado a mano a otro mes con su propia explicación: entonces
cuenta ese mes, y si es el del cierre cobra en su propia fila. El cartel de la
planilla avisa cuántas jornadas son de certificaciones anteriores
(`fueraDeMes` en la respuesta).

Antes (18/09/2026) las jornadas de meses anteriores se mudaban enteras al mes
del cierre, con `motivoFueraDeCierre` = "Pago por lote terminado". Si queda
algún parte así, el próximo reparto lo devuelve a su mes y le arma su renglón.

**Al desmarcar** se borra todo lo del grupo: la cantidad vuelve a estar vacía,
los partes vuelven al mes en el que cae su fecha y se borran los renglones de
pago.

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
propios datos, corre los 47 casos y los borra por `_id`.

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

## Varios lotes en el mismo día

Hecho el 07/10/2026. En herbicida, desmalezado y fertilización la gente dice
"hice el 11, el 12 y el 13" sin saber cuántas horas fueron de cada uno. Se
carga **un solo parte con el horario real del día** y varios lotes:

- En la planilla, con una tarea por lote aparece el botón **+ Lote** al lado
  del círculo. Cada lote que se suma tiene su propio círculo en proceso /
  terminado y una ✕ para sacarlo. La cantidad queda deshabilitada: la arma el
  reparto de cada lote. Con otra tarea los lotes de más no se ven ni se
  guardan, y el backend rechaza varios lotes fuera de esas tres tareas.
- Las horas de la persona cuentan una sola vez (9 h son 9 h, no 27).
- **Para el reparto, las horas del día se dividen entre los lotes según su
  medida** (plantas u hectáreas, la unidad de la tarea): un lote del doble de
  plantas se lleva el doble de horas. Si a alguno le falta la medida, en
  partes iguales. Lo decidió el usuario porque a veces un lote se reparte entre
  varias personas y así es lo más justo (`fraccionDelLote` en
  `repartoLotes.service.js`).
- Cada lote se termina por su lado. Un lote terminado cierra su grupo y deja el
  de los otros lotes del parte como estaba.

Cómo se guarda (`ParteDiario.lotes`, solo con dos lotes o más): cada lote con
`{ lote, terminado, cantidad }`, donde `cantidad` es lo que le tocó del
reparto. `lote` queda como la lista escrita ("11, 12, 13") para mostrar y
buscar, `terminado` dice si hay alguno terminado y `cantidad` es la suma de lo
repartido. Con un solo lote `lotes` va vacío y todo sigue como antes. Lo que
lee los lotes de un parte pasa siempre por `lotesDelParte` (back y front). Lo
que el reparto escribe en un lote va con un update de pipeline por el driver
(`escribirEnLote`): así dos lotes del mismo parte no se pisan y la suma queda
bien. Un renglón de pago de una jornada de varios lotes lleva el lote solo.

En la tabla del mes cada lote terminado va en verde, y el círculo de la fila se
pone verde recién con todos terminados. En el Excel el estado sale por lote. En
el rendimiento, un parte de varios lotes cuenta recién cuando todos tienen lo
suyo (`cuentaParaProduccion`).

Prueba: `node --env-file .env scripts/_pruebaVariosLotes.mjs` (back).

## Pendiente

- El informe de tareas por personal suma bien las cantidades repartidas, pero
  todavía no muestra el detalle del reparto (qué lote, cuántas horas de cada
  uno). Los datos ya viajan: `resumen=1` devuelve `totalHoras`, `lote`,
  `terminado` y `repartido`.
