import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../../services/api";
import { cosechaDeParam } from "../../utils/cosechas";
import { compararCC } from "../../utils/ordenCC";
import { CARROS_REPARACION } from "../../utils/carrosReparacion";
import NavbarSanPablo from "../shared/NavbarSanPablo";
import TarjetasSanPablo from "../shared/TarjetasSanPablo";

// Los carros con letra (29/10/2026) van según su número: el 8C después del 8
// (o del 7 si no hay 8) y no al final, como en compararCC.
const compararCarros = (a, b) => {
  const x = /^(\d+)\s*(.*)$/.exec((a || "").trim());
  const y = /^(\d+)\s*(.*)$/.exec((b || "").trim());
  if (!x || !y) return compararCC(a, b);
  return Number(x[1]) - Number(y[1]) || x[2].localeCompare(y[2], "es", { sensitivity: "base" });
};

/**
 * Reparación carros (28/10/2026), desde el botón de Carros porta escaleras /
 * Escaleras: una tarjeta por carro porta escaleras del padrón de CC y una
 * General. La General tiene la fecha límite (29/10/2026), que se ve en su
 * tarjeta; las de cada carro todavía caen en el 404. La reparación de las
 * escaleras se carga desde los totales de la página de escaleras (tocando
 * Rotas). Desde el 29/10/2026 la misma página sirve a los carros porta bines
 * y porta bolsones, y a las tolvas (`tipo`, ver utils/carrosReparacion.js).
 */
export default function ReparacionCarros({ tipo = "escaleras" }) {
  const config = CARROS_REPARACION[tipo];
  const { cosecha: param } = useParams();
  const cosecha = cosechaDeParam(param);
  const [carros, setCarros] = useState([]);
  // La fecha límite que se carga en General (29/10/2026), en su tarjeta.
  const [fechaLimite, setFechaLimite] = useState(null);

  useEffect(() => {
    api
      .get(`/ingresos-sanpablo/fecha-limite-escaleras?cosecha=${cosecha}`)
      .then((r) => setFechaLimite(r[config.solapa] ?? null))
      .catch(() => setFechaLimite(null));
  }, [cosecha, config.solapa]);

  useEffect(() => {
    api
      .get("/centros-costo")
      .then((data) =>
        setCarros(
          (Array.isArray(data) ? data : [])
            // Sin el "S/N" (29/10/2026): no es un carro, no lleva tarjeta.
            .filter((c) => (c.equipo || "").trim() === config.equipo && (c.cc || "").trim().toUpperCase() !== "S/N")
            .sort((a, b) => compararCarros(a.cc, b.cc))
        )
      )
      .catch(() => setCarros([]));
  }, [config.equipo]);

  const tarjetas = [
    ...carros.map((c) => ({
      // El código va en la dirección: "S/N" lleva una barra.
      id: encodeURIComponent(c.cc),
      titulo: `${config.prefijo ?? "Carro"} ${c.cc}`.trim(),
      ...(c.descripcion && { subtitulo: c.descripcion }),
      ...config.colores,
    })),
    {
      id: "general",
      titulo: "General",
      bg: "linear-gradient(135deg, #1e293b 0%, #334155 100%)",
      hoverBg: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
      accentColor: config.colores.accentColor,
      icono: "bi bi-grid-fill",
      ...(fechaLimite && {
        fechaLimite: fechaLimite.slice(0, 10).split("-").reverse().join("/"),
        fechaEtiqueta: "Límite",
      }),
    },
  ];

  // Son 22 carros más la General: siete por fila (29/10/2026), en cuatro filas, y el
  // ancho atado al alto para que entren sin scroll. Lo que se descuenta del
  // alto (29/10/2026, más grandes): el navbar (54px), el padding de la grilla
  // (48px) y un margen para el salto del hover.
  const porFila = config.porFila ?? 7;
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
        titulo={config.titulo}
        sinSeccion
        cosecha={cosecha}
        icono={<i className={tipo === "escaleras" ? "bi bi-tools" : config.colores.icono}></i>}
        volverA={`/reparaciones/sanpablo/${param}${config.volver ? `/${config.volver}` : ""}`}
      />

      <TarjetasSanPablo
        tarjetas={tarjetas}
        base={`/reparaciones/sanpablo/${param}/${config.ruta}`}
        porFila={porFila}
        maxWidth={`min(1500px, calc((100vh - 115px) * ${porFila / filas}))`}
        chicas
      />
    </div>
  );
}
