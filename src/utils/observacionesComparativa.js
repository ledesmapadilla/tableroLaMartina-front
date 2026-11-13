import { useCallback, useEffect, useState } from "react";
import { api } from "../services/api";

/**
 * Las observaciones de las filas de la solapa Comparativa de un mes, campo y
 * comparativa (12/11/2026): clave de la fila → [notas]. Los botones y los
 * modales están en components/shared/ObservacionesComparativa.jsx.
 */
export function useObservaciones({ anio, mes, campo, tipo }) {
  const ruta = campo ? `/contable/observaciones/${anio}/${mes}/${campo}/${tipo}` : null;
  const [porClave, setPorClave] = useState(new Map());

  useEffect(() => {
    if (!ruta) return undefined;
    let vigente = true;
    api
      .get(ruta)
      .then((lista) => {
        if (vigente) setPorClave(new Map((Array.isArray(lista) ? lista : []).map((o) => [o.clave, o.notas || []])));
      })
      .catch(() => {});
    return () => {
      vigente = false;
    };
  }, [ruta]);

  const agregar = useCallback(
    async (clave, tarea, texto) => {
      const doc = await api.post(ruta, { clave, tarea, texto });
      setPorClave((ant) => new Map(ant).set(clave, doc?.notas || []));
    },
    [ruta]
  );

  const borrar = useCallback(async (clave, nota) => {
    await api.delete(`/contable/observaciones/nota/${nota._id}`);
    setPorClave((ant) => new Map(ant).set(clave, (ant.get(clave) || []).filter((n) => n._id !== nota._id)));
  }, []);

  return { porClave, agregar, borrar };
}
