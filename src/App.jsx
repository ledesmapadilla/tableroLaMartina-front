import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { isMobile } from "./utils/device";

// ── Compras ──
// Unificada con el Tablero el 06/09/2026. Las pantallas viven en
// components/compras y cuelgan de /compras/*.
import { AuthProvider, useAuth } from "./context/AuthContext";
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
import OrdenCompra from "./components/compras/OrdenCompra";
import Gerencia from "./components/compras/Gerencia";
import GerenciaHistorial from "./components/compras/GerenciaHistorial";
import VerOC from "./components/compras/VerOC";
import Usuarios from "./components/compras/Usuarios";
import Proveedores from "./components/compras/Proveedores";
import CentrosCosto from "./components/compras/CentrosCosto";

import Sidebar from "./components/shared/Sidebar";
import Footer from "./components/shared/Footer";
import PaginaPrincipal from "./components/pages/PaginaPrincipal";
import Inicio from "./components/pages/Inicio";
import ProduccionAltaCC from "./components/pages/ProduccionAltaCC";
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
      <BrowserRouter>
        <LayoutDesktop />
      </BrowserRouter>
    </AuthProvider>
  );
}

function LayoutDesktop() {
  const { pathname } = useLocation();
  const esPaginaPrincipal = pathname === "/";
  // Producción es una sección independiente: sin sidebar, se navega con su propio navbar
  const esProduccion = pathname === "/produccion" || pathname.startsWith("/produccion/");
  // Compras también es independiente: trae su propio Menu superior.
  const esCompras = pathname === "/compras" || pathname.startsWith("/compras/");
  // En las pantallas publicas (login, visitas) no va ninguna navegacion.
  const esPublica = esRutaPublica(pathname);
  const sinSidebar = esPaginaPrincipal || esProduccion || esCompras || esPublica;

  // El login cubre todo el proyecto. Se controla acá, en un solo punto, y no
  // ruta por ruta: así ninguna pantalla nueva puede quedar abierta por olvido.
  // Las excepciones están en RUTAS_PUBLICAS (hoy Visitas y el propio login).
  const { user } = useAuth();
  if (!user && !esRutaPublica(pathname)) {
    return <Navigate to="/login" replace state={{ desde: pathname }} />;
  }

  return (
      <div className="app-wrapper">
        {!sinSidebar && <Sidebar />}
        {!sinSidebar && <BotonTableroFlotante />}
        {!sinSidebar && <BotonReunionFlotante />}
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

              <Route path="/compras/berdina" element={<RutaProtegida roles={PERMISOS.comprasGeneral}><Berdina /></RutaProtegida>} />
              <Route path="/compras/berdina/pedidos" element={<RutaProtegida roles={PERMISOS.comprasGeneral}><BerdinaPedidos /></RutaProtegida>} />
              <Route path="/compras/berdina/pedidos/nuevo" element={<RutaProtegida roles={PERMISOS.comprasGeneral}><NuevoPedido /></RutaProtegida>} />
              <Route path="/compras/berdina/pendientes" element={<RutaProtegida roles={PERMISOS.comprasGeneral}><Pendientes taller="berdina" /></RutaProtegida>} />

              <Route path="/compras/sanpablo" element={<RutaProtegida roles={PERMISOS.comprasGeneral}><SanPabloCompras /></RutaProtegida>} />
              <Route path="/compras/sanpablo/pedidos" element={<RutaProtegida roles={PERMISOS.comprasGeneral}><SanPabloPedidos /></RutaProtegida>} />
              <Route path="/compras/sanpablo/pedidos/nuevo" element={<RutaProtegida roles={PERMISOS.comprasGeneral}><SanPabloNuevoPedido /></RutaProtegida>} />
              <Route path="/compras/sanpablo/pendientes" element={<RutaProtegida roles={PERMISOS.comprasGeneral}><Pendientes taller="sanpablo" /></RutaProtegida>} />

              <Route path="/compras/analista" element={<RutaProtegida roles={PERMISOS.comprasAnalista}><Analista /></RutaProtegida>} />
              <Route path="/compras/analista/pedidos" element={<RutaProtegida roles={PERMISOS.comprasAnalista}><AnalistaPedidos key="analista" /></RutaProtegida>} />
              <Route path="/compras/analista/pendientes" element={<RutaProtegida roles={PERMISOS.comprasAnalista}><AnalistaPendientes /></RutaProtegida>} />
              <Route path="/compras/analista/analizar" element={<RutaProtegida roles={PERMISOS.comprasAnalista}><AnalizarItem /></RutaProtegida>} />

              <Route path="/compras/comprador" element={<RutaProtegida roles={PERMISOS.comprasAnalista}><AnalistaPedidos key="comprador" /></RutaProtegida>} />
              <Route path="/compras/comprador/oc" element={<RutaProtegida roles={PERMISOS.comprasAnalista}><OrdenCompra /></RutaProtegida>} />

              <Route path="/compras/gerencia" element={<RutaProtegida roles={PERMISOS.comprasGerencia}><Gerencia /></RutaProtegida>} />
              <Route path="/compras/gerencia/historial" element={<RutaProtegida roles={PERMISOS.comprasGerencia}><GerenciaHistorial /></RutaProtegida>} />

              <Route path="/compras/oc/ver" element={<RutaProtegida><VerOC /></RutaProtegida>} />
              <Route path="/compras/oc/:nro" element={<RutaProtegida><VerOC /></RutaProtegida>} />

              <Route path="/compras/altas/usuarios" element={<RutaProtegida roles={PERMISOS.comprasUsuarios}><Usuarios /></RutaProtegida>} />
              <Route path="/compras/altas/proveedores" element={<RutaProtegida roles={PERMISOS.comprasAnalista}><Proveedores /></RutaProtegida>} />
              <Route path="/compras/altas/centros-costo" element={<RutaProtegida roles={PERMISOS.comprasAnalista}><CentrosCosto /></RutaProtegida>} />
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
              <Route path="/produccion/altas/cc" element={<ProduccionAltaCC />} />
              <Route path="/produccion/altas/personal" element={<ProduccionAltaPersonal />} />
              <Route path="/produccion/altas/tareas" element={<ProduccionAltaTareas />} />
              <Route path="/camionetas" element={<Camionetas />} />
              <Route path="/camionetas/preventivo" element={<CamionetasPreventivo />} />
              <Route path="/camionetas/reparaciones" element={<Navigate to="/camionetas/services/reparaciones" replace />} />
              <Route path="/camionetas/resumen" element={<ResumenCamionetas />} />
              <Route path="/camionetas/altas" element={<CamionetasAltas />} />
              <Route path="/camionetas/checklist" element={<ResumenCheckList />} />
              <Route path="/camionetas/checklist/form" element={<CamionetasCheckList />} />
              <Route path="/tractores" element={<Tractores />} />
              <Route path="/tractores/preventivo" element={<TractoresPreventivo />} />
              <Route path="/tractores/reparaciones" element={<TractoresReparaciones />} />
              <Route path="/tractores/services/reparaciones" element={<Navigate to="/tractores/reparaciones" replace />} />
              <Route path="/tractores/altas" element={<TractoresAltas />} />
              <Route path="/tractores/grupo/:grupoId" element={<TractoresGrupo />} />
              <Route path="/tractores/grupo/:grupoId/resumen" element={<ResumenReparacionesTractores />} />
              <Route path="/tractores/grupo/:grupoId/reparaciones/:tractorId" element={<ReparacionesTractor />} />
              <Route path="/tractores/grupo/:grupoId/reparaciones/:tractorId/reportar" element={<ReportarFallaTractor />} />
              <Route path="/tractores/grupo/:grupoId/reparaciones/:tractorId/tareas" element={<TareasTractorNueva />} />
              <Route path="/tractores/grupo/:grupoId/reparaciones/:tractorId/tareas/vieja" element={<Error404 />} />
              <Route path="/tractores/grupo/:grupoId/reparaciones/:tractorId/tareas/nueva" element={<TareasTractorNueva />} />
              <Route path="/tractores/grupo/:grupoId/reparaciones/:tractorId/historial" element={<HistorialTractor />} />
              <Route path="/tractores/services/reparaciones/resumen" element={<ResumenReparacionesTractores />} />
              <Route path="/reparaciones/sanpablo" element={<Error404 />} />
              <Route path="/colectivo" element={<Colectivo />} />
              <Route path="/colectivo/preventivo" element={<ColectivosPreventivo />} />
              <Route path="/colectivo/reparaciones" element={<ColectivosReparaciones />} />
              <Route path="/colectivos/altas" element={<ColectivosAltas />} />
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
              {/* Sale del botón de Reunión. La pantalla todavía no existe. */}
              <Route path="/pendientes" element={<Error404 />} />
              <Route path="*" element={<Error404 />} />
            </Routes>
          </main>
          <Footer />
        </div>
      </div>
  );
}

export default App;
