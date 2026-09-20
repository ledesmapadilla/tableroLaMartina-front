# Roles y permisos

Desde el 13/09/2026 cada rol tiene, por pantalla, **Ver** y **Editar**. Los
edita el superadmin en **Altas › Usuarios › Roles** (`/compras/altas/usuarios/roles`).

## Piezas

| Qué | Dónde |
| --- | --- |
| Lista de pantallas (catálogo) y grupos de menú (`GRUPO`) | `src/utils/permisosCatalogo.js` |
| Qué permiso pide cada ruta | `src/utils/permisosRutas.js` (`reglaDeRuta`) |
| Permisos del usuario logueado | `src/context/PermisosContext.jsx` + `usePermisos()` en `src/context/permisos.js` |
| Mostrar algo solo con permiso | `src/components/shared/SoloSiPuede.jsx` |
| Pantalla Roles | `src/components/compras/Roles.jsx` |
| Back | `models/Rol.js`, `controllers/roles.controller.js`, `routes/roles.routes.js` (`GET /roles/mio`, `GET /roles` y `PUT /roles/:rol` solo superadmin) |

## Reglas

- **Superadmin** puede todo y no se configura.
- Un rol **sin nada guardado** (o una pantalla que no figura en lo guardado)
  conserva el acceso que tenía antes (`hoy` en el catálogo, sacado de
  `utils/permisos.js`). Sumar una pantalla al catálogo no le quita ni le da
  nada a nadie.
- **Editar implica ver.**
- El front pide los permisos del usuario al entrar, al recargar y **cada vez
  que se vuelve a la pestaña**, y reintenta si el pedido falla. (Hasta el
  13/09/2026 se pedían una sola vez: si ese pedido fallaba, por ejemplo con el
  back reiniciándose, el usuario quedaba con el acceso de antes hasta recargar.)
- **Usuarios y Roles** no están en la tabla: son solo del superadmin
  (`RutaProtegida roles={PERMISOS.comprasUsuarios}`). La lista de usuarios
  muestra las contraseñas.
- **Visitas** es pública (se usa sin usuario en la entrada): su permiso solo
  decide si la tarjeta aparece para quien está logueado.
- **Variables** se partió en sus tres tarjetas (19/09/2026):
  `produccion.variables` es Remuneración (sigue con la clave de antes, así lo
  guardado no se pierde), `produccion.lotes` y `produccion.admisibles`. El menú
  de Variables se ve si el rol ve alguna (`GRUPO.produccionVariables`) y
  muestra solo esas tarjetas. En el back, `/api/variables` pide
  `produccion.variables` y `/api/lotes` pasó a pedir `produccion.lotes`.
  Valores admisibles todavía no está construida (la ruta da 404).
- **Tablero** (19/09/2026) son los dos botones flotantes de Mantenimiento:
  `tablero.camionetas` (Tablero de control, `/camionetas/resumen`) y
  `tablero.reunion` (Reunión, y `/pendientes`, que solo se abre desde ahí). Sin
  el permiso el botón no se muestra, y dentro del modal de Reunión cada
  planilla aparece solo si el rol ve su propia pantalla. **Editar** en
  `tablero.reunion` es cargar, editar y borrar pendientes (`Pendientes.jsx` y
  `escribirSi(["tablero.reunion"])` en `/api/pendientes`); el tablero de
  control es solo lectura, y lo que se abre desde él (check list, kilómetros,
  reparaciones…) sigue pidiendo el permiso de su propia pantalla.

## Cómo se aplica

- **Ver** — `App.jsx` (`LayoutDesktop`) consulta `reglaDeRuta` en un solo
  punto: si el rol no ve la pantalla vuelve a `/`. Los menús y tarjetas llevan
  `permiso` (una clave o una lista: alcanza con una) y se filtran con
  `usePermisos().puede`. El botón Altas (`utils/altas.js`) usa las mismas
  claves.
- **Editar** — los botones de cargar, editar y borrar **no se ocultan: quedan
  a la vista pero deshabilitados** (pedido del usuario, 13/09/2026). Cada
  pantalla calcula `const sinEditar = !puede(clave, "editar")` y lo pone en
  `disabled` (o `deshabilitado` en `BotonAccion`), con el aviso "Sin permiso
  para editar". Las pantallas que son un formulario entero (Tareas de
  camionetas y tractores, detalle de una tarea) envuelven los campos en un
  `<fieldset disabled={sinEditar}>` con un cartel de "Solo lectura". Una regla
  en `index.css` (`.btn:disabled`) deja ver el aviso y el cursor de prohibido
  sobre el botón deshabilitado.
- En el check list el botón de cada mes abre el formulario, que es de carga:
  sin permiso de edición queda deshabilitado y la ruta del formulario pide
  editar.

## El circuito de Compras (19/09/2026)

Compras había quedado afuera del "ver sin editar": sus pantallas no miraban el
permiso y el back pedía "Editar en alguna de las cuatro pantallas del
circuito". Con eso, un analista con solo **Ver** en Comprador entraba a
`/compras/comprador` —que es el mismo componente `AnalistaPedidos`, con el modo
sacado de la URL— y podía mover el circuito; y desde la consola se podía
escribir el número de OP o los precios con editar en cualquiera de las cuatro.

- **Front** — cada pantalla calcula su `sinEditar`: `AnalistaPedidos` con la
  clave de su etapa (`esComprador ? "compras.comprador" : "compras.analista"`),
  `AnalizarItem` con `compras.analista` (cae en su modo "solo ver"), `Gerencia`
  con `compras.gerencia`, `OrdenPago` y `VerOP` con `compras.comprador`, y las
  dos de pedidos del taller con `compras.pedidos`.
- **Back** — `permisos/pedidos.js` dice, campo por campo y estado por estado,
  qué habilita cada permiso, y los dos controllers de pedidos lo consultan
  antes de escribir (`revisarCambioDeItem`). Un campo que no figura no se puede
  escribir por esa ruta. Repetir el estado que el ítem ya tiene no pide
  permiso: las pantallas lo mandan aunque no lo cambien.
- **Los estados** salen del circuito real: el analista cierra el análisis y el
  monto decide —si llega al umbral va a Gerencia ("Autorizar") y si no pasa
  derecho al comprador ("Para hacer OP"), sin autorización—. Hacer la OP es
  otra cosa y otra ruta (`POST /op`, solo `compras.comprador`).
- **Back** (desde el 13/09/2026) — toda escritura (POST/PUT/PATCH/DELETE)
  pide "Editar" en la tabla de Roles, en alguna de las pantallas que escriben
  en ese recurso: `escribirSi(...)` en `TableroBack/src/middleware/permisos.js`,
  aplicado en `routes/index.routes.js` (y en `PUT /config`, dentro de
  `config.routes.js`). Algunos recursos van por método: en
  `trabajos-camioneta` y `trabajos-tractor` crear es de Reportar falla,
  modificar de Tareas y borrar de Tareas/Historial/Planilla; en los pedidos
  crear y borrar es del taller y cambiar ítems también del analista, comprador
  y Gerencia. Sin permiso responde 403 "Tu rol no tiene permiso para editar
  esto".
  - Las **lecturas** solo piden sesión: una pantalla lee datos de otras (la
    planilla de certificación lee Variables), así que exigir "ver" las
    rompería. "Ver" lo controla el front.
  - **`/usuarios`** es solo del superadmin, también para leer (trae las
    contraseñas).
  - El back tiene su copia del catálogo en `TableroBack/src/permisos/catalogo.js`
    (acceso de antes por pantalla): **si se suma una pantalla al catálogo del
    front, va también ahí**. Los permisos de cada rol se guardan 30 segundos
    en memoria (`permisos/resolver.js`); guardar desde Roles limpia esa copia.

## Para sumar una pantalla

1. Una fila en `CATALOGO` (sección, clave, nombre, `hoy`).
2. Su regla en `REGLAS` de `permisosRutas.js`.
3. `permiso` en la tarjeta o link que la abre, y `puede(clave, "editar")` en
   sus botones de edición.

## Rol "Encargado de taller"

Es `solicitante` por dentro (Victor y Kevin). Lo que dictó el usuario el
13/09/2026: Compras › Pedidos y Pendientes ver y editar; Analista, Comprador y
Gerencia nada. Camionetas: Kilómetros, Último service y Check list solo ver;
Reportar falla ver y editar; Tareas e Historial ver. Tractores: Preventivo ver;
Reportar falla ver y editar; Tareas ver. Visitas ver. Producción: Variables
nada; Datos certificación ver y editar; Informe del mes ver; Contable - Pagos
nada. Lo no nombrado: solo ver.
