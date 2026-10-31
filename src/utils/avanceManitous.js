import { api } from "../services/api";
import {
  UNIDADES_MANITOU,
  avanceManitou,
} from "./sistemasManitou";
import { FAMILIA_MANITOU } from "./familiasReparacion";

// El avance de la reparación de cada Manitou (21/10/2026), con la misma
// cuenta que su página: trae los pesos de los sistemas y las filas de cada
// una. Devuelve { [unidad]: % }; sin pesos de los sistemas, vacío.
// Lo usan las tarjetas de Manitous y la de Manitous en Reparaciones San Pablo,
// y las de las tolvas (`familia` y `unidades`, 31/10/2026).
export const traerAvancesManitou = async (cosecha, familia = FAMILIA_MANITOU, unidades = UNIDADES_MANITOU) => {
  const [r, ...listas] = await Promise.all([
    api.get(`/ingresos-sanpablo/pesos-manitou?cosecha=${cosecha}${familia.consulta}`).catch(() => ({})),
    ...unidades.map((u) =>
      api.get(`/ingresos-sanpablo/chequeos?cosecha=${cosecha}&seccion=${familia.seccion(u)}`).catch(() => [])
    ),
  ]);
  const pares = unidades.map((u, i) => {
    const lista = Array.isArray(listas[i]) ? listas[i] : [];
    const filas = Object.fromEntries(familia.sistemas.map((s) => [s.id, lista.filter((f) => f.sistema === s.id)]));
    return [u, avanceManitou(filas, r?.pesos || {}, familia.sistemas).total];
  });
  return Object.fromEntries(pares.filter(([, total]) => total !== null));
};

// El avance total: el promedio de todas. Null sin ninguna.
export const avanceTotalManitous = (avances) => {
  const valores = Object.values(avances);
  return valores.length ? valores.reduce((t, n) => t + n, 0) / valores.length : null;
};
