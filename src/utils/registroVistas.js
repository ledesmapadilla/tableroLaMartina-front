import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Cada pantalla que abre un usuario queda en el Registro (05/11/2026), para
 * saber qué mira cada uno además de lo que carga, edita o borra.
 *
 * Se manda sola al cambiar de pantalla y sin esperar respuesta: si falla, la
 * pantalla sigue como si nada.
 */

// Cómo se lee cada pedazo de la dirección.
const NOMBRES = {
  compras: "Compras",
  produccion: "Producción",
  caspinchango: "Berdina",
  berdina: "Berdina",
  "san-pablo": "San Pablo",
  sanpablo: "San Pablo",
  op: "Orden de pago",
  cc: "CC",
  "centros-costo": "Centros de costo",
  "presupuestos-reparaciones": "Presupuestos reparaciones",
  "ultimo-service": "Último service",
  "tareas-personal": "Tareas por personal",
  checklist: "Check list",
  manitous: "Manitou",
  analizar: "Analizar",
  nuevo: "Nuevo",
  mes: "Mes",
};

// Un id de Mongo no le dice nada a nadie.
const ES_ID = /^[0-9a-f]{24}$/i;

export const nombrePantalla = (ruta) => {
  const partes = ruta.split("/").filter(Boolean);
  if (!partes.length) return "Principal";
  return partes
    .filter((p) => !ES_ID.test(p))
    .map((p) => {
      const texto = decodeURIComponent(p);
      if (NOMBRES[texto]) return NOMBRES[texto];
      const lindo = texto.replace(/-/g, " ");
      return lindo.charAt(0).toUpperCase() + lindo.slice(1);
    })
    .join(" › ");
};

// La misma pantalla dos veces seguidas en un instante es una sola (el modo
// estricto de React en desarrollo, o un Navigate que rebota).
let ultima = { ruta: "", hora: 0 };

export function AnotarVista() {
  const { pathname } = useLocation();
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token || pathname === "/login") return;
    const ahora = Date.now();
    if (ultima.ruta === pathname && ahora - ultima.hora < 3000) return;
    ultima = { ruta: pathname, hora: ahora };
    fetch("/api/registro/vista", {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ruta: pathname, pantalla: nombrePantalla(pathname) }),
    }).catch(() => {});
  }, [pathname]);
  return null;
}
