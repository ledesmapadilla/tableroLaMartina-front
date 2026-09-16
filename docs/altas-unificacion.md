# Unificar las altas del proyecto

**Estado: etapa 1 y la unión del CC hechas el 13/09/2026 (ver §5). Faltan
las etapas 2 y 3.** Estudio del 13/09/2026, a pedido del usuario: "necesito
unificar todas en un solo botón, que sea común a todo el proyecto y logre que
no haya inconsistencias… creo que hay que tratar que haya un solo botón de
altas, con los submenús existentes".

Las secciones 1 y 2 describen cómo estaba **antes** del cambio.

---

## 1. Lo que hay hoy

Nueve páginas de alta, tres menús para llegar y tres estilos.

| Sector | Página | Ruta | API | Menú que la abre |
| --- | --- | --- | --- | --- |
| Compras | `compras/Usuarios.jsx` | `/compras/altas/usuarios` | `/usuarios` | `compras/Menu.jsx` → "Altas" (filtra por rol) |
| Compras | `compras/Proveedores.jsx` | `/compras/altas/proveedores` | `/proveedores` | ídem |
| Compras | `compras/CentrosCosto.jsx` | `/compras/altas/centros-costo` | `/centros-costo` | ídem |
| Producción | `pages/ProduccionAltaCC.jsx` | `/produccion/altas/cc` | `/centros-costo` | `shared/NavbarProduccion.jsx` → "Altas" |
| Producción | `pages/ProduccionAltaPersonal.jsx` | `/produccion/altas/personal` | `/personal` | ídem |
| Producción | `pages/ProduccionAltaTareas.jsx` | `/produccion/altas/tareas` | `/tareas` | ídem |
| Mantenimiento | `pages/CamionetasAltas.jsx` | `/camionetas/altas` | `/camionetas` | `shared/Sidebar.jsx` → Camionetas → "Alta Flota" (y un botón en `ResumenCheckList`) |
| Mantenimiento | `pages/TractoresAltas.jsx` | `/tractores/altas` | `/tractores`, `/historial-tractor` | `Sidebar` → Tractores → "Alta Tractores" |
| Mantenimiento | `pages/ColectivosAltas.jsx` | `/colectivos/altas` | `/colectivos` | `Sidebar` → Colectivos → "Alta Colectivos" |

El marco de cada página lo decide `LayoutDesktop` en `App.jsx` por el prefijo
de la URL: `/compras` lleva el `Menu` bordó, `/produccion` el
`NavbarProduccion` verde y el resto el `Sidebar` (las altas de Mantenimiento
además dibujan su propia barra oscura `#1e293b`).

## 2. Inconsistencias encontradas

1. **Dos pantallas para el mismo padrón de CC.** `CentroCosto` es un solo
   modelo (fusionado al unificar, ver `_claude/unificacion-compras-tablero.md`),
   pero se edita desde dos lados con campos distintos:
   - Compras: `cc`, `grupo`, `marca`, `observaciones`.
   - Producción: `cc`, `equipo`, `descripcion` (y el vínculo `tractor`).
   Nadie ve la ficha completa, y borrar desde un lado lo borra del otro sin
   aviso. El back ya separa `CAMPOS_COMPRAS` (editables en cualquier CC) de
   `CAMPOS_EQUIPO` (bloqueados en los CC que manejan Tractores/Camionetas).
2. **Usuarios cuelga de Compras**, pero el login es de todo el proyecto.
3. **Permisos desparejos.**
   - Front: las altas de Compras tienen `RutaProtegida` con roles; las de
     Producción y Mantenimiento solo piden estar logueado (incluso un
     solicitante entra). `PERMISOS.produccion` y `PERMISOS.mantenimiento`
     existen en `utils/permisos.js` pero no se usan en ningún lado.
   - Back: ningún padrón controla roles (`soloRoles` solo está en
     `PUT /config/monto-autorizacion`). Cualquiera con sesión puede crear
     usuarios por la API aunque la pantalla se lo esconda.
4. **Tres estilos.** Compras usa el formato común (`tabla-informe
   tabla-compras`, `formato.js`, `estilos.jsx`). Producción arma los `th` a
   mano en verde sin `tabla-informe`. Mantenimiento tiene su barra oscura y
   `th` a mano.
5. **Funciones distintas.** Excel en Producción y Mantenimiento (no en Compras
   ni en Camionetas); modales, confirmación de borrado y buscador distintos en
   cada una. Las de Compras llaman con `api`; el resto con `fetch` (anda igual
   por `utils/fetchConToken.js`).
6. **Celular.** `App.jsx` manda todo lo que no es `/compras` a `/visitas` en el
   teléfono. Hoy Proveedores se abre desde el celular solo porque vive bajo
   `/compras`.

## 3. Plan propuesto

### Etapa 1 — un solo botón (poco riesgo, no mueve rutas)
- Un solo archivo con la lista de altas (como `permisos.js`): ruta, nombre,
  ícono, grupo y roles de cada una.
- Un componente `MenuAltas` con los submenús agrupados:
  - **Generales:** Usuarios, Centros de costo
  - **Compras:** Proveedores
  - **Producción:** Personal, Tareas
  - **Flota:** Camionetas, Tractores, Colectivos
- El mismo botón en `Sidebar`, `NavbarProduccion`, `compras/Menu.jsx` y en la
  `PaginaPrincipal`. Cada uno ve lo que su rol le permite.
- Salen los tres menús actuales de altas (el "Altas" de Compras, el de
  Producción y los "Alta …" del Sidebar).

### Etapa 2 — sección Altas propia
- Rutas `/altas/usuarios`, `/altas/centros-costo`, `/altas/proveedores`,
  `/altas/personal`, `/altas/tareas`, `/altas/camionetas`, `/altas/tractores`,
  `/altas/colectivos`, con `<Navigate>` desde las viejas (hay un link en
  `ResumenCheckList.jsx` a `/camionetas/altas`).
- Un navbar propio de Altas en `LayoutDesktop` (sumarla a `sinSidebar`).
- **Una sola pantalla de CC** con todos los campos (cc, equipo, descripción,
  grupo, marca, observaciones), respetando los bloqueos del back para los CC
  de Tractores y Camionetas.

### Etapa 3 — mismo formato y mismos permisos
- Una plantilla común (`PaginaAlta`): encabezado con contador y Excel,
  buscador, `tabla-informe`, el mismo modal de alta/edición y la misma
  confirmación de borrado. Lo más pesado es `TractoresAltas.jsx` (1223 líneas).
- Permisos por padrón en `permisos.js`, aplicados en rutas, menú y **back**
  (`soloRoles` en POST/PUT/DELETE de cada router). Cierra el hueco de
  `/usuarios`.

Recomendación: arrancar por la etapa 1 más la unión del CC.

## 4. Decisiones que tiene que tomar el usuario

1. Dónde va el botón: en los tres navbars y en la principal (recomendado) o
   solo en la principal.
2. Qué rol puede editar cada padrón (la definición de roles quedó pendiente
   al unificar el login).
3. Si se unen las dos pantallas de CC (recomendado: sí).
4. Color o identidad de la sección Altas: uno propio o el de cada sector.
5. Si alguna alta se tiene que poder abrir desde el celular (hoy Proveedores
   se puede).

Decidido el 13/09/2026: (1) navbars + principal, (2) se mantienen los permisos
de hoy, (3) sí, un solo CC. Quedan para la etapa 2: (4) color de Altas y
(5) celular.

## 5. Hecho el 13/09/2026 (etapa 1 + CC)

- **`src/utils/altas.js`**: la lista única (grupo, nombre, ícono, ruta, roles)
  y los ayudantes `altasDe`, `altasPorGrupo`, `rutaDeAlta`, `esRutaDeAlta`.
  Para sumar o sacar un alta, o cambiar quién la ve, se toca solo esto.
- **`src/components/shared/MenuAltas.jsx`**: el botón "Altas" con el
  desplegable agrupado. Va en `NavbarProduccion`, en `compras/Menu.jsx`
  (`seccion="compras"`) y en `PaginaPrincipal`. El `Sidebar` arma su submenú
  "Altas" con la misma lista; los "Alta …" de cada vehículo se sacaron y
  Camionetas, Tractores y Colectivos quedaron como links directos.
- En el panel del celular de Compras van solo las altas que viven bajo
  `/compras` (Usuarios, Proveedores, CC): fuera de `/compras` el Tablero no
  se abre en el teléfono.
- **Permisos (los de antes):** Usuarios solo superadmin; CC y Proveedores
  todos menos solicitante (`comprasAnalista`); Personal y Tareas todos menos
  solicitante (`produccion`); Camionetas, Tractores y Colectivos todos
  (`mantenimiento`). Ahora `App.jsx` protege también las rutas de Producción y
  Flota con esos roles, así que el solicitante ya no entra a Personal, Tareas
  ni CC por la dirección.
- **Un solo CC:** `src/components/pages/AltaCentrosCosto.jsx` reemplaza a
  `compras/CentrosCosto.jsx` y `pages/ProduccionAltaCC.jsx` (borradas). Ficha
  entera (CC, equipo, descripción, grupo, marca, observaciones), formato común
  de tablas, Excel con todas las columnas, grupo con sugerencias de los que ya
  existen. En los CC de Tractores y Camionetas solo se editan grupo, marca y
  observaciones, y no se borran (candado), igual que en el back. Se abre en
  `/produccion/altas/cc` y en `/compras/altas/centros-costo`, cada una con la
  barra y el color de su sección.

Pendiente: etapa 2 (sección `/altas/...` con su navbar y redirecciones) y
etapa 3 (plantilla común para las demás altas y permisos en el back).

## 6. Sin sidebar (15/09/2026)

A pedido del usuario ("el slide bar ya no tiene sentido") se sacó
`shared/Sidebar.jsx` y sus estilos. No se pierde nada: cada pantalla de
Mantenimiento vuelve a la principal con el logo del centro o con "General", y
el botón Altas y la sesión (`SesionUsuario`) están en la principal y ahora
también en la cabecera de Mantenimiento (`pages/Inicio.jsx`). Los botones
flotantes (Tablero y Reunión) siguen en las pantallas de Mantenimiento.

## 7. El CC es la única alta (15/09/2026)

Pedido del usuario: "la única forma de dar de alta cualquier centro de costo
es desde centros de costo… en flota solo se puede administrar y agrupar
centros de costos dados de alta en alta centros de costo". Hasta acá era al
revés: Tractores y Camionetas creaban (y borraban) su CC, y el padrón no dejaba
crear CC de esos equipos.

- **Alta:** solo en Centros de costo. Un CC de equipo Tractor o Camión aparece
  solo en Tractores (con km si es Camión), uno de Camioneta en Camionetas y uno
  de Colectivo en Colectivos (`crearUnidad` en `centroscosto.controller.js`).
  También al ponerle uno de esos equipos a un CC que ya estaba en el padrón.
  Camionetas y colectivos: el código del CC es la patente (va en mayúsculas).
- **Flota:** sin "Nuevo" ni papelera. Solo se edita (grupo, supervisor,
  descripción…). El CC se ve pero no se cambia. En el back se sacaron los
  POST y DELETE de `/tractores`, `/camionetas` y `/colectivos`, y el PUT
  rechaza un cambio de CC o patente. Cada pantalla tiene un botón "Altas y
  bajas en Centros de costo".
- **Código y equipo fijos** en un CC con unidad: horómetros, services e
  historial guardan una copia del código. La descripción se edita en Flota y
  se refleja en el CC.
- **Baja:** solo en Centros de costo. Sin historial se borran el CC y la
  unidad. Con historial no se borra nada: el tractor pasa a "En desuso" (el CC
  queda, porque los partes lo referencian); una camioneta, un colectivo o un
  CC con partes de Producción no se pueden borrar.
- **Colectivos:** el CC es la patente y el número interno (250–283) se borró.
  `Colectivo.cc` pasa a tener la patente y sale el campo `patente`; sus
  services y kilómetros se pasan al código nuevo. Migración:
  `npm run colectivos-patente [--dry-run]` (en el back).
- **Grupo del tractor:** al dar de alta un CC de equipo Tractor o Camión se
  elige el grupo (1 a 5, Berdina o San Pablo), obligatorio; antes nacía en el
  6 (Berdina) por el valor por defecto del modelo. Después se lo mueve desde
  Tractores.
- Los 3 colectivos cuya patente no coincidía con el padrón (FYF 939, FVT 300,
  FWN 856) toman el código del padrón (FFY 939, FTV300, FWN): decisión del
  usuario.

Queda por analizar: los **grupos de tractores** (1 a 5, Berdina, San Pablo, En
desuso) no son un alta. El número vive en `Tractor.gruppo` y el nombre y el
supervisor de cada grupo están escritos a mano en unos diez archivos del front
(`TractoresAltas`, `TractoresReparaciones`, `TractoresGrupo`,
`ReparacionesTractor`, `HistorialTractor`, `TareasTractor`,
`TareasTractorNueva`, `ReportarFallaTractor`, `ResumenReparacionesTractores`,
`Visitas`, `ColectivosAltas`) y en scripts del back.
