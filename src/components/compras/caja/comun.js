import { useEffect } from "react";

/**
 * Lo compartido por las pantallas de Caja del celular (13/11/2026): la misma
 * caja de Contable › Caja (/api/contable/caja), en pantallas de teléfono
 * copiadas de la carga de gasoil del Sistema de Gestión Lepa. Van adentro de
 * Compras porque fuera de /compras el Tablero no se abre en el celular.
 * Permiso: compras.caja (se le tilda al rol celular, javiercel).
 */

export const COLOR = "#164e63";

export const CONCEPTOS = {
  ingreso: { texto: "Ingreso", color: "#15803d", signo: "+ " },
  gasto: { texto: "Gasto", color: "#dc2626", signo: "− " },
};

export const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
export const DIAS_SEMANA = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export const pesos = (n) =>
  `$ ${Number(n || 0).toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export const hoyIso = () => {
  const h = new Date();
  return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, "0")}-${String(h.getDate()).padStart(2, "0")}`;
};

export const dmy = (s) => (s ? s.split("-").reverse().join("/") : "");

// Semanas de viernes a jueves, como la Caja de Contable.
const aIso = (f) => `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}-${String(f.getDate()).padStart(2, "0")}`;
export const aFecha = (s) => {
  const [a, m, d] = s.split("-").map(Number);
  return new Date(a, m - 1, d);
};
export const masDias = (s, n) => {
  const f = aFecha(s);
  f.setDate(f.getDate() + n);
  return aIso(f);
};
/** El viernes que abre la semana de esa fecha. */
export const viernesDe = (s) => masDias(s, -((aFecha(s).getDay() + 2) % 7));
export const ddmm = (s) => s.slice(8, 10) + "/" + s.slice(5, 7);

/**
 * Publica el alto visible de la ventana en --alto-vista (igual que en el SGL):
 * en el celular 100vh cuenta la barra de direcciones y aparece scroll.
 */
export const useAltoVista = () => {
  useEffect(() => {
    const aplicar = () => document.documentElement.style.setProperty("--alto-vista", `${window.innerHeight}px`);
    aplicar();
    window.addEventListener("resize", aplicar);
    window.addEventListener("orientationchange", aplicar);
    return () => {
      window.removeEventListener("resize", aplicar);
      window.removeEventListener("orientationchange", aplicar);
    };
  }, []);
};

/**
 * Si el navegador deja usar la cámara dentro de la página (Camara.jsx): hace
 * falta getUserMedia y https (o localhost).
 */
export const hayCamaraEnPagina = () => Boolean(navigator.mediaDevices?.getUserMedia) && window.isSecureContext;

/**
 * Un monto en los recuadros de arriba (Entradas, Gastos, Saldo), siempre en
 * un renglón (23/11/2026). Si "$ 1.234.567" no entra a la letra de siempre,
 * se achica la letra y el "$" pasa al título ("Entradas $"): `grande` lo dice.
 */
export const montoRecuadro = (valor, base) => {
  const texto = pesos(valor);
  if (texto.length <= 10) return { texto, grande: false, tam: `${base}rem` };
  const numero = texto.replace(/^\$ /, "");
  return { texto: numero, grande: true, tam: `${Math.max(0.55, (base * 9) / numero.length).toFixed(2)}rem` };
};
