import { BrowserRouter, Routes, Route } from "react-router-dom";
import Sidebar from "./components/shared/Sidebar";
import Footer from "./components/shared/Footer";
import Inicio from "./components/pages/Inicio";
import Error404 from "./components/pages/Error404";
import Camionetas from "./components/pages/Camionetas";
import ReparacionesSanPablo from "./components/pages/ReparacionesSanPablo";
import ReparacionesBerdina from "./components/pages/ReparacionesBerdina";
import CamionetasAltas from "./components/pages/CamionetasAltas";
import CamionetasCheckList from "./components/pages/CamionetasCheckList";
import ResumenCheckList from "./components/pages/ResumenCheckList";
import CamionetasServices from "./components/pages/CamionetasServices";
import ServicesKilometros from "./components/pages/ServicesKilometros";
import ServicesUltimoService from "./components/pages/ServicesUltimoService";
import ServicesReparaciones from "./components/pages/ServicesReparaciones";
import ReparacionesCamioneta from "./components/pages/ReparacionesCamioneta";
import ResumenCamionetas from "./components/pages/ResumenCamionetas";
import ResumenReparaciones from "./components/pages/ResumenReparaciones";
import Tractores from "./components/pages/Tractores";
import TractoresAltas from "./components/pages/TractoresAltas";

function App() {
  return (
    <BrowserRouter>
      <div className="app-wrapper">
        <Sidebar />
        <div className="layout-right">
          <main>
            <Routes>
              <Route path="/" element={<Inicio />} />
              <Route path="/camionetas/resumen" element={<ResumenCamionetas />} />
              <Route path="/camionetas" element={<Camionetas />} />
              <Route path="/camionetas/altas" element={<CamionetasAltas />} />
              <Route path="/camionetas/checklist" element={<ResumenCheckList />} />
              <Route path="/camionetas/checklist/form" element={<CamionetasCheckList />} />
              <Route path="/tractores" element={<Tractores />} />
              <Route path="/tractores/altas" element={<TractoresAltas />} />
              <Route path="/reparaciones/sanpablo" element={<ReparacionesSanPablo />} />
              <Route path="/reparaciones/berdina" element={<ReparacionesBerdina />} />
              <Route path="/camionetas/services" element={<CamionetasServices />} />
              <Route path="/camionetas/services/kilometros" element={<ServicesKilometros />} />
              <Route path="/camionetas/services/ultimo-service" element={<ServicesUltimoService />} />
              <Route path="/camionetas/services/reparaciones" element={<ServicesReparaciones />} />
              <Route path="/camionetas/services/reparaciones/resumen" element={<ResumenReparaciones />} />
              <Route path="/camionetas/services/reparaciones/:camionetaId" element={<ReparacionesCamioneta />} />
              <Route path="*" element={<Error404 />} />
            </Routes>
          </main>
          <Footer />
        </div>
      </div>
    </BrowserRouter>
  );
}

export default App;
