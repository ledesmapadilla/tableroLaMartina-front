import { useCallback, useEffect, useState } from "react";

/**
 * Clientes de Producción.
 *
 * Desde el 04/10/2026 hay padrón: se dan de alta en Altas › Clientes
 * (/produccion/altas/clientes) y el parte y el precio solo dejan elegir de
 * ahí. El parte y el precio guardan el NOMBRE del cliente, no el id.
 */

// El cliente que viene puesto en cada parte nuevo, y con el que cuentan un
// parte o un precio viejo sin cliente.
export const CLIENTE_POR_DEFECTO = "Citrusvil";

// Para comparar clientes: sin mayúsculas, tildes ni espacios de más
// ("Citrusvil" y "citrusvil " son el mismo). Es la misma cuenta que la clave
// del padrón en el backend.
export const claveCliente = (cliente) =>
  (cliente || "")
    .toString()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

// El cliente de un precio o de un parte. Sin cliente cuenta como Citrusvil:
// es el que viene puesto en cada parte, y los precios de antes de separarlos
// por cliente (04/10/2026) pasaron a él.
export const clienteDe = (registro) => (registro?.cliente || "").trim() || CLIENTE_POR_DEFECTO;

export const mismoCliente = (a, b) => claveCliente(clienteDe(a)) === claveCliente(clienteDe(b));

/**
 * El padrón de clientes. `activos` son los nombres que se ofrecen en las
 * cargas; `todos` trae también los inactivos (sus partes y precios siguen
 * valiendo). `recargar` lo vuelve a pedir.
 */
export const useClientes = () => {
  const [lista, setLista] = useState([]);

  const recargar = useCallback(
    () =>
      fetch("/api/clientes")
        .then((res) => (res.ok ? res.json() : []))
        .then((datos) => setLista(Array.isArray(datos) ? datos : []))
        .catch(() => setLista([])),
    []
  );

  useEffect(() => {
    fetch("/api/clientes")
      .then((res) => (res.ok ? res.json() : []))
      .then((datos) => setLista(Array.isArray(datos) ? datos : []))
      .catch(() => setLista([]));
  }, []);

  return {
    todos: lista,
    activos: lista.filter((c) => c.activo !== false).map((c) => c.nombre),
    recargar,
  };
};

/**
 * Las opciones de un desplegable de clientes: los activos y, si el valor que
 * ya tiene la carga es de un cliente inactivo, también ese (si no, al editar
 * un parte viejo el campo quedaría vacío).
 */
export const opcionesDeClientes = (activos, valorActual = "") => {
  const lista = [...activos];
  const actual = (valorActual || "").trim();
  if (actual && !lista.some((c) => claveCliente(c) === claveCliente(actual))) lista.push(actual);
  return lista.map((c) => ({ valor: c, texto: c }));
};
