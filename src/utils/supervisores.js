import { useEffect, useState } from "react";
import { api } from "../services/api";

// Los supervisores de los grupos de tractores (los mismos que figuran en
// Tractores). Se les suman los que tengan cargados los tractores y los
// colectivos, así un supervisor nuevo aparece sin tocar esto.
const SUPERVISORES_GRUPOS = [
  "Jorge Rosas",
  "Guillermo Bustos",
  "Carlos Chumiento",
  "brandan alejandro",
  "Elio Rojas",
  "Kevin",
  "Victor",
];

const ordenar = (lista) => [...lista].sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));

/** Todos los supervisores, sin repetir y en orden alfabético. */
export function useSupervisores() {
  const [supervisores, setSupervisores] = useState(() => ordenar(SUPERVISORES_GRUPOS));

  useEffect(() => {
    Promise.all(["/tractores", "/colectivos"].map((ruta) => api.get(ruta).catch(() => []))).then((listas) => {
      const porClave = new Map();
      for (const nombre of [...SUPERVISORES_GRUPOS, ...listas.flat().map((u) => u?.supervisor)]) {
        const limpio = String(nombre || "").trim();
        if (limpio && !porClave.has(limpio.toLowerCase())) porClave.set(limpio.toLowerCase(), limpio);
      }
      setSupervisores(ordenar([...porClave.values()]));
    });
  }, []);

  return supervisores;
}

/**
 * Las opciones del select: si el valor guardado ya no está en la lista se
 * ofrece igual, así al editar no se borra.
 */
export const opcionesSupervisor = (supervisores, valor) =>
  valor && !supervisores.includes(valor) ? [valor, ...supervisores] : supervisores;
