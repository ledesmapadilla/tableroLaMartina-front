import { useParams } from "react-router-dom";
import NavbarSanPablo from "../shared/NavbarSanPablo";
import TarjetasSanPablo from "../shared/TarjetasSanPablo";

// Los tres carros juntos (28/10/2026), desde la tarjeta Carros de
// ReparacionesSanPablo. Cada una va a la página que ya tenía: porta escaleras,
// a la de Escaleras (los carros se manejan desde ahí, 06/10/2026); porta
// bines todavía no está construida y cae en el 404.
const tarjetas = [
  {
    id: "carros-porta-bines",
    titulo: "Carros porta bines",
    bg: "linear-gradient(135deg, #312e81 0%, #4338ca 100%)",
    hoverBg: "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)",
    accentColor: "#818cf8",
    icono: "bi bi-box-seam-fill",
  },
  {
    id: "carros-porta-bolsones",
    titulo: "Carros porta bolsones",
    bg: "linear-gradient(135deg, #831843 0%, #9d174d 100%)",
    hoverBg: "linear-gradient(135deg, #500724 0%, #831843 100%)",
    accentColor: "#f472b6",
    icono: "bi bi-bag-fill",
  },
  {
    id: "escaleras",
    titulo: "Carros porta escaleras",
    bg: "linear-gradient(135deg, #365314 0%, #4d7c0f 100%)",
    hoverBg: "linear-gradient(135deg, #1a2e05 0%, #365314 100%)",
    accentColor: "#a3e635",
    icono: "bi bi-bar-chart-steps",
  },
];

function CarrosSanPablo() {
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
        titulo={`Cosecha ${cosecha} · Carros`}
        icono={<i className="bi bi-truck-flatbed"></i>}
        volverA={`/reparaciones/sanpablo/${cosecha}`}
      />

      {/* Las 3 tarjetas en una fila. */}
      <TarjetasSanPablo
        tarjetas={tarjetas}
        base={`/reparaciones/sanpablo/${cosecha}`}
        porFila={3}
        maxWidth="min(900px, calc((100vh - 200px) * 3))"
      />
    </div>
  );
}

export default CarrosSanPablo;
