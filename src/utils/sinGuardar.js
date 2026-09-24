import { useEffect, useId } from "react";

// Pantallas con algo escrito que todavía no se guardó. Lo mira el aviso de
// versión nueva para no recargar la página encima de una carga a medias
// (24/09/2026). Cada pantalla de carga se anota con useSinGuardar.
const pendientes = new Set();

export const haySinGuardar = () => pendientes.size > 0;

export function useSinGuardar(hayAlgo) {
  const id = useId();
  useEffect(() => {
    if (!hayAlgo) return;
    pendientes.add(id);
    return () => pendientes.delete(id);
  }, [id, hayAlgo]);
}
