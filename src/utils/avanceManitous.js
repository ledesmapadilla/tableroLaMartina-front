import { api } from "../services/api";
import {
  UNIDADES_MANITOU,
  SISTEMAS_MANITOU,
  MANITOUS_FUERA_DE_REPARACION,
  seccionManitou,
  avanceManitou,
} from "./sistemasManitou";

// El avance de la reparación de cada Manitou en reparación (21/10/2026), con
// la misma cuenta que su página: trae los pesos de los sistemas y las filas
// de cada una. Devuelve { [unidad]: % }; sin pesos de los sistemas, vacío.
// Lo usan las tarjetas de Manitous y la de Manitous en Reparaciones San Pablo.
export const traerAvancesManitou = async (cosecha) => {
  const enReparacion = UNIDADES_MANITOU.filter((u) => !MANITOUS_FUERA_DE_REPARACION.includes(u));
  const [r, ...listas] = await Promise.all([
    api.get(`/ingresos-sanpablo/pesos-manitou?cosecha=${cosecha}`).catch(() => ({})),
    ...enReparacion.map((u) =>
      api.get(`/ingresos-sanpablo/chequeos?cosecha=${cosecha}&seccion=${seccionManitou(u)}`).catch(() => [])
    ),
  ]);
  const pares = enReparacion.map((u, i) => {
    const lista = Array.isArray(listas[i]) ? listas[i] : [];
    const filas = Object.fromEntries(SISTEMAS_MANITOU.map((s) => [s.id, lista.filter((f) => f.sistema === s.id)]));
    return [u, avanceManitou(filas, r?.pesos || {}).total];
  });
  return Object.fromEntries(pares.filter(([, total]) => total !== null));
};

// El avance total: el promedio de las que están en reparación (la 1100 no
// cuenta). Null sin ninguna.
export const avanceTotalManitous = (avances) => {
  const valores = Object.values(avances);
  return valores.length ? valores.reduce((t, n) => t + n, 0) / valores.length : null;
};
