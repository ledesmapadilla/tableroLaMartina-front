import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../../services/api";
import { cosechaDeParam } from "../../utils/cosechas";
import { compararCC } from "../../utils/ordenCC";
import NavbarSanPablo from "../shared/NavbarSanPablo";
import TarjetasSanPablo from "../shared/TarjetasSanPablo";

const EQUIPO_CARRO = "Carro porta escaleras";

// El verde de la reparación en Carros porta escaleras / Escaleras.
const verde = {
  bg: "linear-gradient(135deg, #14532d 0%, #15803d 100%)",
  hoverBg: "linear-gradient(135deg, #052e16 0%, #14532d 100%)",
  accentColor: "#86efac",
  icono: "bi bi-truck-flatbed",
};

/**
 * Reparación carros (28/10/2026), desde el botón de Carros porta escaleras /
 * Escaleras: una tarjeta por carro porta escaleras del padrón de CC y una
 * General. Las páginas de cada una todavía no están: caen en el 404. La
 * reparación de las escaleras se carga desde los totales de la página de
 * escaleras (tocando Rotas).
 */
export default function ReparacionCarros() {
  const { cosecha: param } = useParams();
  const cosecha = cosechaDeParam(param);
  const [carros, setCarros] = useState([]);

  useEffect(() => {
    api
      .get("/centros-costo")
      .then((data) =>
        setCarros(
          (Array.isArray(data) ? data : [])
            .filter((c) => (c.equipo || "").trim() === EQUIPO_CARRO)
            .sort((a, b) => compararCC(a.cc, b.cc))
        )
      )
      .catch(() => setCarros([]));
  }, []);

  const tarjetas = [
    ...carros.map((c) => ({
      // El código va en la dirección: "S/N" lleva una barra.
      id: encodeURIComponent(c.cc),
      titulo: `Carro ${c.cc}`,
      ...(c.descripcion && { subtitulo: c.descripcion }),
      ...verde,
    })),
    {
      id: "general",
      titulo: "General",
      bg: "linear-gradient(135deg, #1e293b 0%, #334155 100%)",
      hoverBg: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
      accentColor: "#86efac",
      icono: "bi bi-grid-fill",
    },
  ];

  // Son 23 carros más la General: seis por fila, en cuatro filas, y el
  // ancho atado al alto para que entren sin scroll.
  const porFila = 6;
  const filas = Math.max(1, Math.ceil(tarjetas.length / porFila));

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
        titulo="Reparación carros"
        sinSeccion
        cosecha={cosecha}
        icono={<i className="bi bi-tools"></i>}
        volverA={`/reparaciones/sanpablo/${param}/escaleras`}
      />

      <TarjetasSanPablo
        tarjetas={tarjetas}
        base={`/reparaciones/sanpablo/${param}/escaleras/reparacion`}
        porFila={porFila}
        maxWidth={`min(1100px, calc((100vh - 170px) * ${porFila / filas}))`}
        chicas
      />
    </div>
  );
}
