import { useParams } from "react-router-dom";
import TractorIcon from "../shared/TractorIcon";
import NavbarSanPablo from "../shared/NavbarSanPablo";
import TarjetasSanPablo from "../shared/TarjetasSanPablo";
import { UNIDADES_MANITOU } from "../../utils/sistemasManitou";

// El verde de la tarjeta Manitous de ReparacionesSanPablo.
const verde = {
  bg: "linear-gradient(135deg, #064e3b 0%, #047857 100%)",
  hoverBg: "linear-gradient(135deg, #022c22 0%, #064e3b 100%)",
  accentColor: "#34d399",
};

// Una tarjeta por Manitou y la General (06/10/2026). Todas abren
// ManitouGeneralSanPablo: General es la plantilla y cada Manitou trabaja con
// la copia (09/10/2026).
const tarjetas = [
  ...UNIDADES_MANITOU.map((nro) => ({
    id: nro,
    titulo: `Manitou ${nro}`,
    ...verde,
    tractor: true,
  })),
  {
    id: "general",
    titulo: "General",
    bg: "linear-gradient(135deg, #1e293b 0%, #334155 100%)",
    hoverBg: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
    accentColor: "#34d399",
    icono: "bi bi-grid-fill",
  },
];

function ManitousSanPablo() {
  const { cosecha } = useParams();

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#f8f9fa",
        height: "100%",
        maxHeight: "100vh",
        overflow: "hidden",
      }}
    >
      <NavbarSanPablo
        titulo={`Cosecha ${cosecha} · Manitous`}
        icono={<TractorIcon size="1.25rem" color="#fff" />}
        volverA={`/reparaciones/sanpablo/${cosecha}`}
      />

      {/* Las 6 tarjetas en dos filas de 3, sin scroll. */}
      <TarjetasSanPablo
        tarjetas={tarjetas}
        base={`/reparaciones/sanpablo/${cosecha}/manitous`}
        porFila={3}
        maxWidth="min(780px, calc((100vh - 200px) * 1.5))"
      />
    </div>
  );
}

export default ManitousSanPablo;
