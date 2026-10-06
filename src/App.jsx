import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { isMobile } from "./utils/device";

// ── Compras ──
// Unificada con el Tablero el 06/09/2026. Las pantallas viven en
// components/compras y cuelgan de /compras/*.
import { AuthProvider, useAuth } from "./context/AuthContext";
import { PermisosProvider } from "./context/PermisosContext";
import { usePermisos } from "./context/permisos";
import { reglaDeRuta } from "./utils/permisosRutas";
import MenuCompras from "./components/compras/Menu";
import RutaProtegida from "./components/shared/RutaProtegida";
import Login from "./components/shared/Login";
import { PERMISOS, esRutaPublica } from "./utils/permisos";
const InicioCompras = lazy(() => import("./components/compras/Inicio"));
const Berdina = lazy(() => import("./components/compras/Berdina"));
const BerdinaPedidos = lazy(() => import("./components/compras/BerdinaPedidos"));
const NuevoPedido = lazy(() => import("./components/compras/NuevoPedido"));
const Pendientes = lazy(() => import("./components/compras/Pendientes"));
const SanPabloCompras = lazy(() => import("./components/compras/SanPablo"));
const SanPabloPedidos = lazy(() => import("./components/compras/SanPabloPedidos"));
const SanPabloNuevoPedido = lazy(() => import("./components/compras/SanPabloNuevoPedido"));
const Analista = lazy(() => import("./components/compras/Analista"));
const AnalistaPedidos = lazy(() => import("./components/compras/AnalistaPedidos"));
const AnalistaPendientes = lazy(() => import("./components/compras/AnalistaPendientes"));
// El stock del almacén: los artículos y los movimientos viven en la base.
const Stock = lazy(() => import("./components/compras/Stock"));
const StockRubro = lazy(() => import("./components/compras/StockRubro"));
const StockCatalogo = lazy(() => import("./components/compras/StockCatalogo"));
// La puerta del almacén (aceites o el almacén de siempre) y los aceites, que
// vienen del Sistema de Gestión Lepa.
const Almacen = lazy(() => import("./components/compras/Almacen"));
const StockAceites = lazy(() => import("./components/compras/StockAceites"));
const StockAceitesAlta = lazy(() => import("./components/compras/StockAceitesAlta"));
const StockAceitesCompras = lazy(() => import("./components/compras/StockAceitesCompras"));
const AnalizarItem = lazy(() => import("./components/compras/AnalizarItem"));
const OrdenPago = lazy(() => import("./components/compras/OrdenPago"));
const Gerencia = lazy(() => import("./components/compras/Gerencia"));
const GerenciaHistorial = lazy(() => import("./components/compras/GerenciaHistorial"));
const VerOP = lazy(() => import("./components/compras/VerOP"));
const Usuarios = lazy(() => import("./components/compras/Usuarios"));
const Roles = lazy(() => import("./components/compras/Roles"));
const Proveedores = lazy(() => import("./components/compras/Proveedores"));

import Footer from "./components/shared/Footer";
import PaginaPrincipal from "./components/pages/PaginaPrincipal";
const Inicio = lazy(() => import("./components/pages/Inicio"));
const AltaCentrosCosto = lazy(() => import("./components/pages/AltaCentrosCosto"));
const ProduccionAltaPersonal = lazy(() => import("./components/pages/ProduccionAltaPersonal"));
const ProduccionAltaTareas = lazy(() => import("./components/pages/ProduccionAltaTareas"));
const ProduccionAltaClientes = lazy(() => import("./components/pages/ProduccionAltaClientes"));
const ProduccionEstablecimientos = lazy(() => import("./components/pages/ProduccionEstablecimientos"));
const ProduccionCertificados = lazy(() => import("./components/pages/ProduccionCertificados"));
const ProduccionCertificadoMenu = lazy(() => import("./components/pages/ProduccionCertificadoMenu"));
const ProduccionInformesMenu = lazy(() => import("./components/pages/ProduccionInformesMenu"));
const ProduccionInformeMes = lazy(() => import("./components/pages/ProduccionInformeMes"));
const ProduccionInformeTareasPersonal = lazy(() => import("./components/pages/ProduccionInformeTareasPersonal"));
const ProduccionCertificadoMes = lazy(() => import("./components/pages/ProduccionCertificadoMes"));
const ProduccionVariables = lazy(() => import("./components/pages/ProduccionVariables"));
const ProduccionVariablesMenu = lazy(() => import("./components/pages/ProduccionVariablesMenu"));
const ProduccionLotes = lazy(() => import("./components/pages/ProduccionLotes"));
const ProduccionAdmisibles = lazy(() => import("./components/pages/ProduccionAdmisibles"));
const ProduccionCampoMenu = lazy(() => import("./components/pages/ProduccionCampoMenu"));
const Error404 = lazy(() => import("./components/pages/Error404"));
const Camionetas = lazy(() => import("./components/pages/Camionetas"));
const ReparacionesSanPablo = lazy(() => import("./components/pages/ReparacionesSanPablo"));
const ManitousSanPablo = lazy(() => import("./components/pages/ManitousSanPablo"));
const ManitouGeneralSanPablo = lazy(() => import("./components/pages/ManitouGeneralSanPablo"));
const ChequeosManitou = lazy(() => import("./components/pages/ChequeosManitou"));
const IngresosSanPablo = lazy(() => import("./components/pages/IngresosSanPablo"));
const IngresosEscaleras = lazy(() => import("./components/pages/IngresosEscaleras"));
const CosechasSanPablo = lazy(() => import("./components/pages/CosechasSanPablo"));
import RutaCosecha from "./components/shared/RutaCosecha";
const Colectivo = lazy(() => import("./components/pages/Colectivo"));
const ColectivosAltas = lazy(() => import("./components/pages/ColectivosAltas"));
const ColectivosPreventivo = lazy(() => import("./components/pages/ColectivosPreventivo"));
const ColectivosReparaciones = lazy(() => import("./components/pages/ColectivosReparaciones"));
const CamionetasAltas = lazy(() => import("./components/pages/CamionetasAltas"));
const CamionetasCheckList = lazy(() => import("./components/pages/CamionetasCheckList"));
const ResumenCheckList = lazy(() => import("./components/pages/ResumenCheckList"));
const CamionetasServices = lazy(() => import("./components/pages/CamionetasServices"));
const ServicesKilometros = lazy(() => import("./components/pages/ServicesKilometros"));
const ServicesUltimoService = lazy(() => import("./components/pages/ServicesUltimoService"));
const ServicesReparaciones = lazy(() => import("./components/pages/ServicesReparaciones"));
const ReparacionesCamioneta = lazy(() => import("./components/pages/ReparacionesCamioneta"));
const TareaDetalle = lazy(() => import("./components/pages/TareaDetalle"));
const ResumenCamionetas = lazy(() => import("./components/pages/ResumenCamionetas"));
const ResumenReparaciones = lazy(() => import("./components/pages/ResumenReparaciones"));
const HistorialReparaciones = lazy(() => import("./components/pages/HistorialReparaciones"));
const Tractores = lazy(() => import("./components/pages/Tractores"));
const TractoresPreventivo = lazy(() => import("./components/pages/TractoresPreventivo"));
const TractoresReparaciones = lazy(() => import("./components/pages/TractoresReparaciones"));
const TractoresRepuestos = lazy(() => import("./components/pages/TractoresRepuestos"));
const TractoresAltas = lazy(() => import("./components/pages/TractoresAltas"));
const TractoresGrupo = lazy(() => import("./components/pages/TractoresGrupo"));
const ReparacionesTractor = lazy(() => import("./components/pages/ReparacionesTractor"));
const ReportarFallaTractor = lazy(() => import("./components/pages/ReportarFallaTractor"));
const TareasTractor = lazy(() => import("./components/pages/TareasTractor"));
const TareasTractorVieja = lazy(() => import("./components/pages/TareasTractorVieja"));
const TareasTractorNueva = lazy(() => import("./components/pages/TareasTractorNueva"));
const HistorialTractor = lazy(() => import("./components/pages/HistorialTractor"));
const ResumenReparacionesTractores = lazy(() => import("./components/pages/ResumenReparacionesTractores"));
const Visitas = lazy(() => import("./components/pages/Visitas"));
// Con alias: Compras ya trae su propio Pendientes, que es el de los pedidos.
const PendientesReunion = lazy(() => import("./components/pages/Pendientes"));
const CamionetasPreventivo = lazy(() => import("./components/pages/CamionetasPreventivo"));
const CamionetaMenuReparaciones = lazy(() => import("./components/pages/CamionetaMenuReparaciones"));
const ReportarFallaCamioneta = lazy(() => import("./components/pages/ReportarFallaCamioneta"));
import BotonTableroFlotante from "./components/shared/BotonTableroFlotante";
import BotonReunionFlotante from "./components/shared/BotonReunionFlotante";
import NavbarProduccion from "./components/shared/NavbarProduccion";

// Las pantallas se bajan recién cuando se abren (27/09/2026): antes iban las
// 78 en un solo JS de 1,5 MB que el navegador tenía que bajar y leer antes de
// mostrar nada. Lo que queda con import común es lo que se ve siempre (menús,
// login, la principal, los botones flotantes). Mientras llega una pantalla se
// muestra esto.
function CargandoPantalla() {
  return (
    <div className="d-flex justify-content-center py-5">
      <span className="spinner-border text-secondary" role="status" aria-label="Cargando" />
    </div>
  );
}

// Las tareas de San Pablo que se marcan como en proceso o terminadas. El
// pulverizado salió el 25/09/2026: lleva la cantidad a mano.
const TAREAS_CON_ESTADO = ["herbicida", "desmalezado"];

// El desmalezado y el herbicida de San Pablo se cargan sin cantidad; el resto
// de las tareas la lleva.
const TAREAS_SIN_CANTIDAD = ["desmalezado", "herbicida"];

// Las tareas que más se cargan en San Pablo: van primero y en negrita en el
// desplegable de la planilla (17/09/2026).
const TAREAS_SAN_PABLO = [
  "Herbicida",
  "Desmalezado mecánico",
  "Desmalezado x Ha",
  "Horas tractor",
  "Horas la martina",
  "Horas máquina",
  "Pulverizado FMC",
  "Pulverizado Nodriza",
];

function App() {
  // En celular el Tablero muestra solo Visitas: el resto de sus pantallas son
  // tablas anchas que no entran. Compras es la excepción: era una app aparte
  // que se usaba desde el teléfono, así que al unificarla tiene que seguir
  // llegando. Sin esto, pedir /compras rebotaba a /visitas y no había salida.
  const esCompras =
    window.location.pathname === "/compras" ||
    window.location.pathname.startsWith("/compras/");

  if (isMobile && !esCompras) {
    return (
      <BrowserRouter>
        <div className="app-wrapper" style={{ width: "100%", minHeight: "100vh" }}>
          <div className="layout-right" style={{ width: "100%", marginLeft: 0, padding: 0 }}>
            <main style={{ padding: 0 }}>
              <Suspense fallback={<CargandoPantalla />}>
                <Routes>
                  <Route path="/visitas" element={<Visitas />} />
                  <Route path="*" element={<Navigate to="/visitas" replace />} />
                </Routes>
              </Suspense>
            </main>
            <Footer />
          </div>
        </div>
      </BrowserRouter>
    );
  }

  // AuthProvider envuelve todo: el login cubre el proyecto entero.
  return (
    <AuthProvider>
      {/* Qué ve y qué edita el usuario logueado, según su rol. */}
      <PermisosProvider>
        <BrowserRouter>
          <LayoutDesktop />
        </BrowserRouter>
      </PermisosProvider>
    </AuthProvider>
  );
}

function LayoutDesktop() {
  const { pathname } = useLocation();
  const esPaginaPrincipal = pathname === "/";
  // Producción es una sección independiente: se navega con su propio navbar
  const esProduccion = pathname === "/produccion" || pathname.startsWith("/produccion/");
  // Compras también es independiente: trae su propio Menu superior.
  const esCompras = pathname === "/compras" || pathname.startsWith("/compras/");
  // En las pantallas publicas (login, visitas) no va ninguna navegacion.
  const esPublica = esRutaPublica(pathname);
  // Ya no hay sidebar (sacado el 15/09/2026): cada pantalla de Mantenimiento
  // vuelve a la principal con el logo o "General", y Altas y Salir están en
  // la principal y en Mantenimiento. Los botones flotantes siguen solo acá.
  const esMantenimiento = !(esPaginaPrincipal || esProduccion || esCompras || esPublica);

  // El login cubre todo el proyecto. Se controla acá, en un solo punto, y no
  // ruta por ruta: así ninguna pantalla nueva puede quedar abierta por olvido.
  // Las excepciones están en RUTAS_PUBLICAS (hoy Visitas y el propio login).
  const { user } = useAuth();
  const { puede, cargados } = usePermisos();
  if (!user && !esRutaPublica(pathname)) {
    return <Navigate to="/login" replace state={{ desde: pathname }} />;
  }

  // Qué pantallas ve cada rol (Altas › Usuarios › Roles), también en un solo
  // punto: las reglas están en utils/permisosRutas.js. Mientras llegan los
  // permisos no se muestra nada, para no dejar ver un instante lo que después
  // rebota; si el rol no ve la pantalla, vuelve a la principal.
  const regla = user ? reglaDeRuta(pathname) : null;
  if (regla && !cargados) return null;
  if (regla && !puede(regla.permiso, regla.accion)) return <Navigate to="/" replace />;

  return (
      <div className="app-wrapper">
        {/* Los dos botones flotantes tienen su permiso en la tabla de Roles. */}
        {esMantenimiento && puede("tablero.camionetas") && <BotonTableroFlotante />}
        {esMantenimiento && puede("tablero.reunion") && (
          <BotonReunionFlotante top={puede("tablero.camionetas") ? "calc(25% + 50px)" : "25%"} />
        )}
        <div className="layout-right">
          {esProduccion && <NavbarProduccion />}
          {esCompras && !esPublica && <MenuCompras />}
          <main>
            <Suspense fallback={<CargandoPantalla />}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/" element={<PaginaPrincipal />} />
              <Route path="/inicio" element={<Inicio />} />
              {/* ── Compras ──
                  Se unificó con el Tablero el 06/09/2026. Trae su propio
                  login con roles; el resto del proyecto sigue abierto hasta
                  que se unifique la autenticación. */}
              
              <Route path="/compras" element={<RutaProtegida><InicioCompras /></RutaProtegida>} />

              <Route path="/compras/berdina" element={<RutaProtegida><Berdina /></RutaProtegida>} />
              <Route path="/compras/berdina/pedidos" element={<RutaProtegida><BerdinaPedidos /></RutaProtegida>} />
              <Route path="/compras/berdina/pedidos/nuevo" element={<RutaProtegida><NuevoPedido /></RutaProtegida>} />
              <Route path="/compras/berdina/pendientes" element={<RutaProtegida><Pendientes taller="berdina" /></RutaProtegida>} />

              <Route path="/compras/sanpablo" element={<RutaProtegida><SanPabloCompras /></RutaProtegida>} />
              <Route path="/compras/sanpablo/pedidos" element={<RutaProtegida><SanPabloPedidos /></RutaProtegida>} />
              <Route path="/compras/sanpablo/pedidos/nuevo" element={<RutaProtegida><SanPabloNuevoPedido /></RutaProtegida>} />
              <Route path="/compras/sanpablo/pendientes" element={<RutaProtegida><Pendientes taller="sanpablo" /></RutaProtegida>} />
              {/* El análisis de un pedido, solo para verlo: lo abren los talleres
                  desde "Para autorizar". El que se carga y procesa es /compras/analista/analizar. */}
              <Route path="/compras/pedidos/analisis" element={<RutaProtegida><AnalizarItem soloVer /></RutaProtegida>} />

              <Route path="/compras/analista" element={<RutaProtegida><Analista /></RutaProtegida>} />
              <Route path="/compras/analista/pedidos" element={<RutaProtegida><AnalistaPedidos key="analista" /></RutaProtegida>} />
              <Route path="/compras/analista/pendientes" element={<RutaProtegida><AnalistaPendientes /></RutaProtegida>} />
              <Route path="/compras/analista/almacen" element={<RutaProtegida><Almacen /></RutaProtegida>} />
              <Route path="/compras/analista/aceites" element={<RutaProtegida><StockAceites /></RutaProtegida>} />
              <Route path="/compras/analista/aceites/alta" element={<RutaProtegida><StockAceitesAlta /></RutaProtegida>} />
              <Route path="/compras/analista/aceites/compras" element={<RutaProtegida><StockAceitesCompras /></RutaProtegida>} />
              <Route path="/compras/analista/stock" element={<RutaProtegida><Stock /></RutaProtegida>} />
              {/* El catálogo general no es un rubro: es todo el almacén junto
                  y de solo lectura. Va antes del comodín. */}
              <Route path="/compras/analista/stock/catalogo" element={<RutaProtegida><StockCatalogo /></RutaProtegida>} />
              {/* Todos los rubros se miran con la misma pantalla y cuál es lo
                  dice la tarjeta (rubrosStock.js). Una tarjeta que no sea un
                  rubro cae en el 404 desde adentro. */}
              <Route path="/compras/analista/stock/:seccion" element={<RutaProtegida><StockRubro /></RutaProtegida>} />
              <Route path="/compras/analista/analizar" element={<RutaProtegida><AnalizarItem /></RutaProtegida>} />

              <Route path="/compras/comprador" element={<RutaProtegida><AnalistaPedidos key="comprador" /></RutaProtegida>} />
              <Route path="/compras/comprador/op" element={<RutaProtegida><OrdenPago /></RutaProtegida>} />

              <Route path="/compras/gerencia" element={<RutaProtegida><Gerencia /></RutaProtegida>} />
              <Route path="/compras/gerencia/historial" element={<RutaProtegida><GerenciaHistorial /></RutaProtegida>} />

              <Route path="/compras/op/ver" element={<RutaProtegida><VerOP /></RutaProtegida>} />
              <Route path="/compras/op/:nro" element={<RutaProtegida><VerOP /></RutaProtegida>} />

              <Route path="/compras/altas/usuarios" element={<RutaProtegida roles={PERMISOS.comprasUsuarios}><Usuarios /></RutaProtegida>} />
              {/* Qué ve y qué edita cada rol: solo el superadmin, como Usuarios. */}
              <Route path="/compras/altas/usuarios/roles" element={<RutaProtegida roles={PERMISOS.comprasUsuarios}><Roles /></RutaProtegida>} />
              <Route path="/compras/altas/proveedores" element={<RutaProtegida><Proveedores /></RutaProtegida>} />
              {/* El CC es un solo padrón: la misma pantalla que /produccion/altas/cc,
                  dentro de la barra de Compras (y así llega desde el celular). */}
              <Route path="/compras/altas/centros-costo" element={<RutaProtegida><AltaCentrosCosto /></RutaProtegida>} />
              {/* Producción entra por los establecimientos: todo lo demás
                  cuelga de uno de ellos. */}
              <Route path="/produccion" element={<ProduccionEstablecimientos />} />

              {/* Variables es de todo Producción, no de un campo (18/09/2026):
                  es la tarjeta chica del medio en la entrada. Remuneración
                  entra directo; Lotes pide antes de qué campo son. */}
              <Route path="/produccion/variables" element={<ProduccionVariablesMenu />} />
              {/* Remuneración vuelve a ser de cada campo (30/09/2026): pide el
                  campo antes, como Lotes. */}
              <Route
                path="/produccion/variables/remuneracion"
                element={
                  <ProduccionCampoMenu
                    titulo="Remuneración"
                    subtitulo="De qué campo son los precios"
                    base="/produccion/variables/remuneracion"
                  />
                }
              />
              <Route
                path="/produccion/variables/remuneracion/caspinchango"
                element={<ProduccionVariables establecimiento="caspinchango" />}
              />
              <Route
                path="/produccion/variables/remuneracion/san-pablo"
                element={<ProduccionVariables establecimiento="san-pablo" />}
              />
              <Route
                path="/produccion/variables/lotes"
                element={
                  <ProduccionCampoMenu
                    titulo="Lotes"
                    subtitulo="De qué campo son los lotes"
                    base="/produccion/variables/lotes"
                  />
                }
              />
              <Route
                path="/produccion/variables/lotes/caspinchango"
                element={<ProduccionLotes establecimiento="caspinchango" />}
              />
              <Route
                path="/produccion/variables/lotes/san-pablo"
                element={<ProduccionLotes establecimiento="san-pablo" />}
              />
              {/* Una sola para todos los campos, como Remuneración (24/09/2026). */}
              <Route path="/produccion/variables/admisibles" element={<ProduccionAdmisibles />} />

              {/* San Pablo tiene su propia certificación: grilla de meses,
                  Variables y la carga de datos, con sus propios períodos. Los
                  informes todavía no están construidos (17/09/2026). */}
              <Route
                path="/produccion/san-pablo"
                element={
                  <ProduccionCertificados establecimiento="san-pablo" base="/produccion/san-pablo" />
                }
              />
              <Route
                path="/produccion/san-pablo/:anio/:mes"
                element={<ProduccionCertificadoMenu base="/produccion/san-pablo" />}
              />
              {/* En San Pablo se corta al mediodía: el turno va en dos tramos. */}
              <Route
                path="/produccion/san-pablo/:anio/:mes/planilla"
                element={
                  <ProduccionCertificadoMes
                    establecimiento="san-pablo"
                    dosTurnos
                    conEstado
                    conPadronDeLotes
                    tareasConEstado={TAREAS_CON_ESTADO}
                    tareasDestacadas={TAREAS_SAN_PABLO}
                    tareasSinCantidad={TAREAS_SIN_CANTIDAD}
                  />
                }
              />
              <Route
                path="/produccion/san-pablo/:anio/:mes/informes"
                element={<ProduccionInformesMenu base="/produccion/san-pablo" />}
              />
              <Route
                path="/produccion/san-pablo/:anio/:mes/informes/mes"
                element={<ProduccionInformeMes establecimiento="san-pablo" />}
              />
              {/* El botón Resumen de la planilla: solo el resumen por personal. */}
              <Route
                path="/produccion/san-pablo/:anio/:mes/informes/resumen"
                element={<ProduccionInformeMes establecimiento="san-pablo" soloPersonal />}
              />
              <Route
                path="/produccion/san-pablo/:anio/:mes/informes/tareas-personal"
                element={<ProduccionInformeTareasPersonal establecimiento="san-pablo" />}
              />
              <Route path="/produccion/certificados" element={<ProduccionCertificados />} />
              <Route path="/produccion/certificados/:anio/:mes" element={<ProduccionCertificadoMenu />} />
              <Route path="/produccion/certificados/:anio/:mes/planilla" element={<ProduccionCertificadoMes />} />
              <Route path="/produccion/certificados/:anio/:mes/informes" element={<ProduccionInformesMenu />} />
              <Route path="/produccion/certificados/:anio/:mes/informes/mes" element={<ProduccionInformeMes />} />
              <Route path="/produccion/certificados/:anio/:mes/informes/resumen" element={<ProduccionInformeMes soloPersonal />} />
              <Route
                path="/produccion/certificados/:anio/:mes/informes/tareas-personal"
                element={<ProduccionInformeTareasPersonal />}
              />
              {/* Variables es una sola para todos los meses: no lleva año ni mes */}
              <Route path="/produccion/altas" element={<Error404 />} />
              {/* Quién ve cada alta sale de la tabla de Roles: lo controla
                  reglaDeRuta, arriba, y el botón Altas usa lo mismo. */}
              <Route path="/produccion/altas/cc" element={<RutaProtegida><AltaCentrosCosto /></RutaProtegida>} />
              <Route path="/produccion/altas/personal" element={<RutaProtegida><ProduccionAltaPersonal /></RutaProtegida>} />
              <Route path="/produccion/altas/tareas" element={<RutaProtegida><ProduccionAltaTareas /></RutaProtegida>} />
              <Route path="/produccion/altas/clientes" element={<RutaProtegida><ProduccionAltaClientes /></RutaProtegida>} />
              <Route path="/camionetas" element={<Camionetas />} />
              <Route path="/camionetas/preventivo" element={<CamionetasPreventivo />} />
              <Route path="/camionetas/reparaciones" element={<Navigate to="/camionetas/services/reparaciones" replace />} />
              <Route path="/camionetas/resumen" element={<ResumenCamionetas />} />
              <Route path="/camionetas/altas" element={<RutaProtegida><CamionetasAltas /></RutaProtegida>} />
              <Route path="/camionetas/checklist" element={<ResumenCheckList />} />
              <Route path="/camionetas/checklist/form" element={<CamionetasCheckList />} />
              <Route path="/tractores" element={<Tractores />} />
              <Route path="/tractores/preventivo" element={<TractoresPreventivo />} />
              <Route path="/tractores/reparaciones" element={<TractoresReparaciones />} />
              <Route path="/tractores/repuestos" element={<TractoresRepuestos />} />
              <Route path="/tractores/services/reparaciones" element={<Navigate to="/tractores/reparaciones" replace />} />
              <Route path="/tractores/altas" element={<RutaProtegida><TractoresAltas /></RutaProtegida>} />
              <Route path="/tractores/grupo/:grupoId" element={<TractoresGrupo />} />
              <Route path="/tractores/grupo/:grupoId/resumen" element={<ResumenReparacionesTractores />} />
              <Route path="/tractores/grupo/:grupoId/reparaciones/:tractorId" element={<ReparacionesTractor />} />
              <Route path="/tractores/grupo/:grupoId/reparaciones/:tractorId/reportar" element={<ReportarFallaTractor />} />
              <Route path="/tractores/grupo/:grupoId/reparaciones/:tractorId/tareas" element={<TareasTractorNueva />} />
              <Route path="/tractores/grupo/:grupoId/reparaciones/:tractorId/tareas/vieja" element={<Error404 />} />
              <Route path="/tractores/grupo/:grupoId/reparaciones/:tractorId/tareas/nueva" element={<TareasTractorNueva />} />
              <Route path="/tractores/grupo/:grupoId/reparaciones/:tractorId/historial" element={<HistorialTractor />} />
              <Route path="/tractores/services/reparaciones/resumen" element={<ResumenReparacionesTractores />} />
              {/* Reparaciones San Pablo: primero la cosecha y adentro las tarjetas. */}
              <Route path="/reparaciones/sanpablo" element={<CosechasSanPablo />} />
              <Route
                path="/reparaciones/sanpablo/:cosecha"
                element={<RutaCosecha><ReparacionesSanPablo /></RutaCosecha>}
              />
              {/* Manitous: una tarjeta por unidad (al 404 por ahora) y la General
                  (06/10/2026). La tabla de ingresos de Manitous
                  quedó sin entrada. */}
              <Route
                path="/reparaciones/sanpablo/:cosecha/manitous"
                element={<RutaCosecha><ManitousSanPablo /></RutaCosecha>}
              />
              <Route path="/reparaciones/sanpablo/:cosecha/manitous/:unidad" element={<Error404 />} />
              {/* General: una tarjeta por sistema, cada una con su tabla de chequeo. */}
              <Route
                path="/reparaciones/sanpablo/:cosecha/manitous/general"
                element={<RutaCosecha><ManitouGeneralSanPablo /></RutaCosecha>}
              />
              <Route
                path="/reparaciones/sanpablo/:cosecha/manitous/general/:sistema"
                element={<RutaCosecha><ChequeosManitou /></RutaCosecha>}
              />
              {/* La tabla de ingresos de cada tarjeta: qué equipos del padrón
                  de CC ofrece y con qué ícono. */}
              {[
                ["tolvas", "Tolvas", "Tolva", <i className="bi bi-minecart-loaded"></i>],
                ["carros-porta-bolsones", "Carros porta bolsones", "Carro porta bolsones", <i className="bi bi-bag-fill"></i>],
              ].map(([tipo, titulo, equipo, icono]) => (
                <Route
                  key={tipo}
                  path={`/reparaciones/sanpablo/:cosecha/${tipo}`}
                  element={
                    <RutaCosecha>
                      <IngresosSanPablo key={tipo} tipo={tipo} titulo={titulo} equipos={[equipo]} icono={icono} />
                    </RutaCosecha>
                  }
                />
              ))}
              {/* Carros porta escaleras / Escaleras: los carros se manejan desde acá
                  (06/10/2026); /carros-porta-escaleras cae en el 404. */}
              <Route
                path="/reparaciones/sanpablo/:cosecha/escaleras"
                element={
                  <RutaCosecha>
                    <IngresosEscaleras icono={<i className="bi bi-bar-chart-steps"></i>} />
                  </RutaCosecha>
                }
              />
              {/* Colectivos, carros porta bines y pulverizadoras: todavía no
                  están construidas. */}
              <Route path="/reparaciones/sanpablo/:cosecha/:tipo" element={<Error404 />} />
              <Route path="/colectivo" element={<Colectivo />} />
              <Route path="/colectivo/preventivo" element={<ColectivosPreventivo />} />
              <Route path="/colectivo/reparaciones" element={<ColectivosReparaciones />} />
              <Route path="/colectivos/altas" element={<RutaProtegida><ColectivosAltas /></RutaProtegida>} />
              <Route path="/camionetas/services" element={<CamionetasServices />} />
              <Route path="/camionetas/services/kilometros" element={<ServicesKilometros />} />
              <Route path="/camionetas/services/ultimo-service" element={<ServicesUltimoService />} />
              <Route path="/camionetas/services/reparaciones" element={<ServicesReparaciones />} />
              <Route path="/camionetas/services/reparaciones/resumen" element={<ResumenReparaciones />} />
              <Route path="/camionetas/services/reparaciones/:camionetaId" element={<CamionetaMenuReparaciones />} />
              <Route path="/camionetas/services/reparaciones/:camionetaId/reportar" element={<ReportarFallaCamioneta />} />
              <Route path="/camionetas/services/reparaciones/:camionetaId/tareas" element={<ReparacionesCamioneta />} />
              <Route path="/camionetas/services/reparaciones/:camionetaId/tarea/:trabajoId" element={<TareaDetalle />} />
              <Route path="/camionetas/services/reparaciones/:camionetaId/historial" element={<HistorialReparaciones />} />
              <Route path="/visitas" element={<Visitas />} />
              {/* Sale del botón de Reunión. */}
              <Route path="/pendientes" element={<PendientesReunion />} />
              <Route path="*" element={<Error404 />} />
            </Routes>
            </Suspense>
          </main>
          <Footer />
        </div>
      </div>
  );
}

export default App;
