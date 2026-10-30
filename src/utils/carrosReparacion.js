/**
 * Los tres carros de Reparaciones San Pablo con página de reparación
 * (29/10/2026): una tarjeta por carro del padrón de CC más la General, que
 * tiene la fecha límite. Por cada uno:
 *  - equipo   el equipo del padrón de CC.
 *  - solapa   su fecha límite en /ingresos-sanpablo/fecha-limite-escaleras.
 *  - ruta     la página de las tarjetas, después de /reparaciones/sanpablo/:cosecha/.
 *  - volver   a dónde vuelve esa página.
 *  - tarjeta  el id de su tarjeta en CarrosSanPablo, que muestra la fecha.
 *  - prefijo  lo que va antes del CC en cada tarjeta ("Carro" si no está).
 *  - porFila  cuántas tarjetas por fila (7 si no está).
 * Porta escaleras sigue entrando por el botón de la página de Escaleras.
 */
export const CARROS_REPARACION = {
  escaleras: {
    titulo: "Reparación carros",
    tituloGeneral: "Reparación carros · General",
    equipo: "Carro porta escaleras",
    solapa: "carros",
    ruta: "escaleras/reparacion",
    volver: "escaleras",
    tarjeta: "escaleras",
    colores: {
      bg: "linear-gradient(135deg, #14532d 0%, #15803d 100%)",
      hoverBg: "linear-gradient(135deg, #052e16 0%, #14532d 100%)",
      accentColor: "#86efac",
      icono: "bi bi-truck-flatbed",
    },
  },
  bines: {
    titulo: "Carros porta bines",
    tituloGeneral: "Carros porta bines · General",
    equipo: "Carro porta bines",
    solapa: "bines",
    ruta: "carros-porta-bines",
    volver: "carros",
    tarjeta: "carros-porta-bines",
    colores: {
      bg: "linear-gradient(135deg, #312e81 0%, #4338ca 100%)",
      hoverBg: "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)",
      accentColor: "#818cf8",
      icono: "bi bi-box-seam-fill",
    },
  },
  bolsones: {
    titulo: "Carros porta bolsones",
    tituloGeneral: "Carros porta bolsones · General",
    equipo: "Carro porta bolsones",
    solapa: "bolsones",
    ruta: "carros-porta-bolsones",
    volver: "carros",
    tarjeta: "carros-porta-bolsones",
    colores: {
      bg: "linear-gradient(135deg, #164e63 0%, #0e7490 100%)",
      hoverBg: "linear-gradient(135deg, #083344 0%, #164e63 100%)",
      accentColor: "#22d3ee",
      icono: "bi bi-bag-fill",
    },
  },
  // Las tolvas (29/10/2026), igual que los carros: se entra desde el botón
  // "Reparación tolvas" de su tabla de ingresos, y la fecha se ve en la
  // tarjeta Tolvas de ReparacionesSanPablo.
  tolvas: {
    titulo: "Reparación tolvas",
    tituloGeneral: "Reparación tolvas · General",
    prefijo: "Tolva",
    porFila: 3,
    equipo: "Tolva",
    solapa: "tolvas",
    ruta: "tolvas/reparacion",
    volver: "tolvas",
    colores: {
      bg: "linear-gradient(135deg, #78350f 0%, #92400e 100%)",
      hoverBg: "linear-gradient(135deg, #451a03 0%, #78350f 100%)",
      accentColor: "#f59e0b",
      icono: "bi bi-minecart-loaded",
    },
  },
  // Los colectivos (29/10/2026): la tarjeta Colectivos de ReparacionesSanPablo
  // va directo a sus tarjetas (no tienen tabla de ingresos) y muestra la
  // fecha. Son 29: de a 6 por fila, con la patente sola de título.
  colectivos: {
    titulo: "Colectivos",
    tituloGeneral: "Colectivos · General",
    prefijo: "",
    porFila: 6,
    equipo: "Colectivo",
    solapa: "colectivos",
    ruta: "colectivos",
    volver: "",
    colores: {
      bg: "linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%)",
      hoverBg: "linear-gradient(135deg, #450a0a 0%, #7f1d1d 100%)",
      accentColor: "#f87171",
      icono: "bi bi-bus-front-fill",
    },
  },
};
