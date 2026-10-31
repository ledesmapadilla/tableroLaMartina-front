// El orden de las tarjetas de las unidades (31/10/2026): primero las que tienen
// lugar en la espera, de menor a mayor; después las que tienen fecha límite, de
// la más cercana a la más lejana; y las demás, en el orden en que vinieron.
// General siempre al final. `lugar(t)` y `fecha(t)`: el dato de cada tarjeta.
export const ordenarTarjetas = (tarjetas, lugar, fecha) => {
  const clave = (t) => {
    if (t.id === "general") return [3, 0];
    if (lugar(t)) return [0, lugar(t)];
    if (fecha(t)) return [1, new Date(fecha(t)).getTime()];
    return [2, 0];
  };
  return [...tarjetas].sort((a, b) => {
    const [x, y] = [clave(a), clave(b)];
    return x[0] - y[0] || x[1] - y[1];
  });
};
