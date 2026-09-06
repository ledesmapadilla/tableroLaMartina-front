import { useEffect, useMemo, useRef, useState } from "react";

// Desplegable con buscador. El <select> nativo solo salta a la opción que
// EMPIEZA con lo tipeado, y acá las tareas, la gente y los turbos se buscan
// por cualquier parte del texto: filtra con include, sin acentos y sin
// distinguir mayúsculas.
const normalizar = (t) =>
  (t ?? "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

function SelectBuscador({
  opciones = [], // [{ valor, texto }]
  valor = "",
  onChange,
  vacio = "—", // texto de la opción que limpia la selección; null la saca
  placeholder = "",
  disabled = false,
  invalido = false,
  // Con `libre`, lo tipeado que no coincida con ninguna opción vale como
  // valor: es para los campos de texto libre que igual ofrecen una lista, como
  // el cliente del parte.
  libre = false,
  style,
  className = "",
  inputRef, // para poder enfocarlo desde afuera
  title,
}) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [marcada, setMarcada] = useState(0);

  const caja = useRef(null);
  const propio = useRef(null);
  const campo = inputRef || propio;
  const lista = useRef(null);

  const elegida = opciones.find((o) => o.valor === valor);
  // En modo libre el valor puede no estar en la lista: se muestra tal cual.
  const textoElegido = elegida ? elegida.texto : libre ? valor || "" : "";

  const filtradas = useMemo(() => {
    const q = normalizar(busqueda);
    if (!q) return opciones;
    return opciones.filter((o) => normalizar(o.texto).includes(q));
  }, [opciones, busqueda]);

  const abrir = () => {
    if (disabled) return;
    setBusqueda("");
    setMarcada(0);
    setAbierto(true);
  };

  const cerrar = () => {
    setAbierto(false);
    setBusqueda("");
  };

  // Un clic afuera cierra sin tocar lo que ya estaba elegido.
  useEffect(() => {
    if (!abierto) return;
    const alClicAfuera = (e) => {
      if (caja.current && !caja.current.contains(e.target)) {
        setAbierto(false);
        setBusqueda("");
      }
    };
    document.addEventListener("mousedown", alClicAfuera);
    return () => document.removeEventListener("mousedown", alClicAfuera);
  }, [abierto]);

  // La opción marcada tiene que quedar a la vista al moverse con las flechas.
  useEffect(() => {
    if (!abierto || !lista.current) return;
    const fila = lista.current.children[marcada];
    fila?.scrollIntoView({ block: "nearest" });
  }, [marcada, abierto]);

  const elegir = (opcion) => {
    onChange?.(opcion ? opcion.valor : "");
    cerrar();
    campo.current?.blur();
  };

  // Modo libre: lo tipeado se toma como valor. Si coincide con una opción se
  // usa la opción, para no guardar dos escrituras del mismo texto.
  const elegirTexto = (texto) => {
    const t = (texto || "").trim();
    const exacta = opciones.find((o) => normalizar(o.texto) === normalizar(t));
    onChange?.(exacta ? exacta.valor : t);
    cerrar();
  };

  const alTeclear = (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!abierto) return abrir();
      const paso = e.key === "ArrowDown" ? 1 : -1;
      const total = filtradas.length;
      if (total) setMarcada((i) => (i + paso + total) % total);
      return;
    }
    if (e.key === "Enter") {
      // Enter adentro del desplegable elige la opción; el guardado del parte
      // que escucha más arriba no se tiene que enterar.
      if (abierto) {
        e.preventDefault();
        e.stopPropagation();
        if (filtradas[marcada]) elegir(filtradas[marcada]);
        else if (libre && busqueda.trim()) elegirTexto(busqueda);
        else cerrar();
      }
      return;
    }
    if (e.key === "Escape") {
      if (abierto) {
        e.preventDefault();
        e.stopPropagation();
        cerrar();
      }
      return;
    }
    if (e.key === "Tab" && abierto) cerrar();
  };

  return (
    <div ref={caja} style={{ position: "relative" }}>
      <input
        ref={campo}
        type="text"
        className={`form-control ${invalido ? "is-invalid" : ""} ${className}`}
        style={{ ...style, paddingRight: "22px" }}
        title={title}
        disabled={disabled}
        autoComplete="off"
        // Cerrado muestra lo elegido; abierto queda vacío para tipear y lo
        // elegido pasa al placeholder, así no se pierde de vista.
        value={abierto ? busqueda : textoElegido}
        placeholder={abierto ? textoElegido || placeholder : placeholder}
        // El clic abre y cierra. No se abre al recibir el foco: al editar un
        // parte la pantalla enfoca este campo sola, y abrirlo ahí tapaba la
        // fila con la lista sin que nadie la hubiera pedido.
        onMouseDown={() => (abierto ? cerrar() : abrir())}
        onChange={(e) => {
          setBusqueda(e.target.value);
          setMarcada(0);
          if (!abierto) setAbierto(true);
        }}
        onKeyDown={alTeclear}
        // En modo libre, salir del campo confirma lo tipeado: si no, el texto
        // que no coincide con ninguna opción se perdería al hacer clic afuera.
        onBlur={() => {
          if (!abierto) return;
          if (libre && busqueda.trim()) elegirTexto(busqueda);
          else cerrar();
        }}
      />

      {/* La flechita del select nativo, para que se lea como un desplegable */}
      <i
        className={`bi bi-chevron-${abierto ? "up" : "down"} position-absolute text-muted`}
        style={{
          right: "7px",
          top: "50%",
          transform: "translateY(-50%)",
          fontSize: "0.7rem",
          pointerEvents: "none",
        }}
      ></i>

      {abierto && (
        <ul
          ref={lista}
          className="list-unstyled bg-white border rounded-3 shadow-sm mb-0 py-1"
          style={{
            position: "absolute",
            top: "calc(100% + 2px)",
            left: 0,
            width: "100%",
            minWidth: "180px",
            maxHeight: "220px",
            overflowY: "auto",
            zIndex: 1080,
          }}
        >
          {vacio !== null && !busqueda && (
            <li
              className="px-2 py-1 text-muted"
              style={{ fontSize: "0.78rem", cursor: "pointer" }}
              // mousedown y no click: el blur del input llega antes que el clic.
              onMouseDown={(e) => {
                e.preventDefault();
                elegir(null);
              }}
            >
              {vacio}
            </li>
          )}

          {filtradas.length === 0 && (
            <li className="px-2 py-1 text-muted" style={{ fontSize: "0.78rem" }}>
              Sin resultados
            </li>
          )}

          {filtradas.map((o, i) => (
            <li
              key={o.valor}
              className="px-2 py-1"
              style={{
                fontSize: "0.78rem",
                cursor: "pointer",
                backgroundColor: i === marcada ? "#e8f5ee" : "transparent",
                color: o.valor === valor ? "#1b4332" : "#1e293b",
                fontWeight: o.valor === valor ? 600 : 400,
              }}
              onMouseEnter={() => setMarcada(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                elegir(o);
              }}
            >
              {o.texto}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default SelectBuscador;
