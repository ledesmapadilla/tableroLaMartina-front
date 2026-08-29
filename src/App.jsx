import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { isMobile } from "./utils/device";
import Sidebar from "./components/shared/Sidebar";
import Footer from "./components/shared/Footer";
import PaginaPrincipal from "./components/pages/PaginaPrincipal";
import Inicio from "./components/pages/Inicio";
import Produccion from "./components/pages/Produccion";
import ProduccionAltaCC from "./components/pages/ProduccionAltaCC";
import ProduccionAltaPersonal from "./components/pages/ProduccionAltaPersonal";
import ProduccionAltaTareas from "./components/pages/ProduccionAltaTareas";
import ProduccionCertificados from "./components/pages/ProduccionCertificados";
import ProduccionCertificadoMes from "./components/pages/ProduccionCertificadoMes";
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
import NavbarProduccion from "./components/shared/NavbarProduccion";

function App() {
  if (isMobile) {
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

  return (
    <BrowserRouter>
      <LayoutDesktop />
    </BrowserRouter>
  );
}

function LayoutDesktop() {
  const { pathname } = useLocation();
  const esPaginaPrincipal = pathname === "/";
  // Producción es una sección independiente: sin sidebar, se navega con su propio navbar
  const esProduccion = pathname === "/produccion" || pathname.startsWith("/produccion/");
  const sinSidebar = esPaginaPrincipal || esProduccion;

  return (
      <div className="app-wrapper">
        {!sinSidebar && <Sidebar />}
        {!sinSidebar && <BotonTableroFlotante />}
        <div className="layout-right">
          {esProduccion && <NavbarProduccion />}
          <main>
            <Routes>
              <Route path="/" element={<PaginaPrincipal />} />
              <Route path="/inicio" element={<Inicio />} />
              <Route path="/compras" element={<Error404 />} />
              <Route path="/produccion" element={<Produccion />} />
              <Route path="/produccion/certificados" element={<ProduccionCertificados />} />
              <Route path="/produccion/certificados/:anio/:mes" element={<ProduccionCertificadoMes />} />
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
              <Route path="*" element={<Error404 />} />
            </Routes>
          </main>
          <Footer />
        </div>
      </div>
  );
}

export default App;
