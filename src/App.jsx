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
import InicioCompras from "./components/compras/Inicio";
import Berdina from "./components/compras/Berdina";
import BerdinaPedidos from "./components/compras/BerdinaPedidos";
import NuevoPedido from "./components/compras/NuevoPedido";
import Pendientes from "./components/compras/Pendientes";
import SanPabloCompras from "./components/compras/SanPablo";
import SanPabloPedidos from "./components/compras/SanPabloPedidos";
import SanPabloNuevoPedido from "./components/compras/SanPabloNuevoPedido";
import Analista from "./components/compras/Analista";
import AnalistaPedidos from "./components/compras/AnalistaPedidos";
import AnalistaPendientes from "./components/compras/AnalistaPendientes";
import AnalizarItem from "./components/compras/AnalizarItem";
import OrdenPago from "./components/compras/OrdenPago";
import Gerencia from "./components/compras/Gerencia";
import GerenciaHistorial from "./components/compras/GerenciaHistorial";
import VerOP from "./components/compras/VerOP";
import Usuarios from "./components/compras/Usuarios";
import Roles from "./components/compras/Roles";
import Proveedores from "./components/compras/Proveedores";

import Footer from "./components/shared/Footer";
import PaginaPrincipal from "./components/pages/PaginaPrincipal";
import Inicio from "./components/pages/Inicio";
import AltaCentrosCosto from "./components/pages/AltaCentrosCosto";
import ProduccionAltaPersonal from "./components/pages/ProduccionAltaPersonal";
import ProduccionAltaTareas from "./components/pages/ProduccionAltaTareas";
import ProduccionEstablecimientos from "./components/pages/ProduccionEstablecimientos";
import ProduccionCertificados from "./components/pages/ProduccionCertificados";
import ProduccionCertificadoMenu from "./components/pages/ProduccionCertificadoMenu";
import ProduccionInformesMenu from "./components/pages/ProduccionInformesMenu";
import ProduccionInformeMes from "./components/pages/ProduccionInformeMes";
import ProduccionInformeTareasPersonal from "./components/pages/ProduccionInformeTareasPersonal";
import ProduccionCertificadoMes from "./components/pages/ProduccionCertificadoMes";
import ProduccionVariables from "./components/pages/ProduccionVariables";
import Error404 from "./components/pages/Error404";
import Camionetas from "./components/pages/Camionetas";
import ReparacionesSanPablo from "./components/pages/ReparacionesSanPablo";
import IngresosSanPablo from "./components/pages/IngresosSanPablo";
import IngresosEscaleras from "./components/pages/IngresosEscaleras";
import CosechasSanPablo from "./components/pages/CosechasSanPablo";
import RutaCosecha from "./components/shared/RutaCosecha";
import TractorIcon from "./components/shared/TractorIcon";
import Colectivo from "./components/pages/Colectivo";
import ColectivosAltas from "./components/pages/ColectivosAltas";
import ColectivosPreventivo from "./components/pages/ColectivosPreventivo";
import ColectivosReparaciones from "./components/pages/ColectivosReparaciones";
import CamionetasAltas from "./components/pages/CamionetasAltas";
import CamionetasCheckList from "./components/pages/CamionetasCheckList";
import ResumenCheckList from "./components/pages/ResumenCheckList";
import CamionetasServices from "./components/pages/CamionetasServices";
import ServicesKilometros from "./components/pages/ServicesKilometros";
import ServicesUltimoService from "./components/pages/ServicesUltimoService";
import ServicesReparaciones from "./components/pages/ServicesReparaciones";
import ReparacionesCamioneta from "./components/pages/ReparacionesCamioneta";
import TareaDetalle from "./components/pages/TareaDetalle";
import ResumenCamionetas from "./components/pages/ResumenCamionetas";
import ResumenReparaciones from "./components/pages/ResumenReparaciones";
import HistorialReparaciones from "./components/pages/HistorialReparaciones";
import Tractores from "./components/pages/Tractores";
import TractoresPreventivo from "./components/pages/TractoresPreventivo";
import TractoresReparaciones from "./components/pages/TractoresReparaciones";
import TractoresRepuestos from "./components/pages/TractoresRepuestos";
import TractoresAltas from "./components/pages/TractoresAltas";
import TractoresGrupo from "./components/pages/TractoresGrupo";
import ReparacionesTractor from "./components/pages/ReparacionesTractor";
import ReportarFallaTractor from "./components/pages/ReportarFallaTractor";
import TareasTractor from "./components/pages/TareasTractor";
import TareasTractorVieja from "./components/pages/TareasTractorVieja";
import TareasTractorNueva from "./components/pages/TareasTractorNueva";
import HistorialTractor from "./components/pages/HistorialTractor";
import ResumenReparacionesTractores from "./components/pages/ResumenReparacionesTractores";
import Visitas from "./components/pages/Visitas";
// Con alias: Compras ya trae su propio Pendientes, que es el de los pedidos.
import PendientesReunion from "./components/pages/Pendientes";
import CamionetasPreventivo from "./components/pages/CamionetasPreventivo";
import CamionetaMenuReparaciones from "./components/pages/CamionetaMenuReparaciones";
import ReportarFallaCamioneta from "./components/pages/ReportarFallaCamioneta";
import BotonTableroFlotante from "./components/shared/BotonTableroFlotante";
import BotonReunionFlotante from "./components/shared/BotonReunionFlotante";
import NavbarProduccion from "./components/shared/NavbarProduccion";

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
              <Routes>
                <Route path="/visitas" element={<Visitas />} />
                <Route path="*" element={<Navigate to="/visitas" replace />} />
              </Routes>
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
        {esMantenimiento && <BotonTableroFlotante />}
        {esMantenimiento && <BotonReunionFlotante />}
        <div className="layout-right">
          {esProduccion && <NavbarProduccion />}
          {esCompras && !esPublica && <MenuCompras />}
          <main>
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

              {/* San Pablo tiene su propia certificación: la grilla de meses y
                  Variables ya son las suyas, con sus propios períodos. Lo que
                  hay adentro de cada mes todavía no está construido. */}
              <Route
                path="/produccion/san-pablo"
                element={
                  <ProduccionCertificados establecimiento="san-pablo" base="/produccion/san-pablo" />
                }
              />
              <Route
                path="/produccion/san-pablo/variables"
                element={<ProduccionVariables establecimiento="san-pablo" />}
              />
              <Route path="/produccion/san-pablo/:anio/:mes" element={<Error404 />} />
              <Route path="/produccion/certificados" element={<ProduccionCertificados />} />
              <Route path="/produccion/certificados/:anio/:mes" element={<ProduccionCertificadoMenu />} />
              <Route path="/produccion/certificados/:anio/:mes/planilla" element={<ProduccionCertificadoMes />} />
              <Route path="/produccion/certificados/:anio/:mes/informes" element={<ProduccionInformesMenu />} />
              <Route path="/produccion/certificados/:anio/:mes/informes/mes" element={<ProduccionInformeMes />} />
              <Route
                path="/produccion/certificados/:anio/:mes/informes/tareas-personal"
                element={<ProduccionInformeTareasPersonal />}
              />
              {/* Variables es una sola para todos los meses: no lleva año ni mes */}
              <Route path="/produccion/certificados/variables" element={<ProduccionVariables />} />
              <Route path="/produccion/altas" element={<Error404 />} />
              {/* Quién ve cada alta sale de la tabla de Roles: lo controla
                  reglaDeRuta, arriba, y el botón Altas usa lo mismo. */}
              <Route path="/produccion/altas/cc" element={<RutaProtegida><AltaCentrosCosto /></RutaProtegida>} />
              <Route path="/produccion/altas/personal" element={<RutaProtegida><ProduccionAltaPersonal /></RutaProtegida>} />
              <Route path="/produccion/altas/tareas" element={<RutaProtegida><ProduccionAltaTareas /></RutaProtegida>} />
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
              {/* La tabla de ingresos de cada tarjeta: qué equipos del padrón
                  de CC ofrece y con qué ícono. */}
              {[
                ["manitous", "Manitous", "Manitou", <TractorIcon size="1.25rem" color="#fff" />],
                ["tolvas", "Tolvas", "Tolva", <i className="bi bi-minecart-loaded"></i>],
                ["carros-porta-escaleras", "Carros porta escaleras", "Carro porta escaleras", <i className="bi bi-ladder"></i>],
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
              {/* Escaleras no tiene alta: entran solas con cada carro porta escaleras. */}
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
          </main>
          <Footer />
        </div>
      </div>
  );
}

export default App;
