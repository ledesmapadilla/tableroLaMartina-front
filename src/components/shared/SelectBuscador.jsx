import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

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

// Fondo de la opción marcada y color de la elegida. Por defecto los verdes de
// Producción; Compras le pasa su bordó.
const COLORES = { marcada: "#e8f5ee", elegida: "#1b4332" };

// Alto máximo de la lista abierta.
const ALTO_LISTA = 220;

function SelectBuscador({
  // `detalle` es un texto de ayuda que va en gris al lado de la opción y
  // también se busca, pero no se muestra en el campo al elegirla (el CC del
  // parte muestra solo el número y lista el equipo al costado).
  opciones = [], // [{ valor, texto, destacada?, detalle? }]
  colores = COLORES,
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
  const [posicion, setPosicion] = useState(null);
  // Si se tipeó algo desde que se abrió. En modo libre, tipear y borrar todo
  // vacía el campo; abrirlo y salir sin tocar nada lo deja como estaba.
  const [tipeado, setTipeado] = useState(false);

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
    return opciones.filter(
      (o) => normalizar(o.texto).includes(q) || normalizar(o.detalle).includes(q)
    );
  }, [opciones, busqueda]);

  const abrir = () => {
    if (disabled) return;
    setBusqueda("");
    setTipeado(false);
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

  // La lista va con position: fixed, ubicada sobre el campo. Absoluta, la
  // recortaba cualquier contenedor con overflow hidden (la tarjeta del pedido
  // de Compras la cortaba en su borde y obligaba a scrollear adentro). Si abajo
  // no hay lugar, se abre para arriba. Se reubica al scrollear o redimensionar.
  useLayoutEffect(() => {
    if (!abierto) return;
    const ubicar = (e) => {
      // El scroll de la propia lista no mueve el campo.
      if (e?.target === lista.current) return;
      const r = campo.current?.getBoundingClientRect();
      if (!r) return;
      const MARGEN = 8;
      const abajo = window.innerHeight - r.bottom - MARGEN;
      const arriba = r.top - MARGEN;
      const haciaArriba = abajo < ALTO_LISTA && arriba > abajo;
      setPosicion({
        left: r.left,
        width: r.width,
        // La lista se ensancha hasta el texto más largo (los lotes de San
        // Pablo tienen nombres como "Perímetro de ruta Solano Vera
        // (Country)"), pero sin pasarse del borde derecho de la pantalla.
        maxWidth: Math.max(r.width, window.innerWidth - r.left - MARGEN),
        ...(haciaArriba
          ? { bottom: window.innerHeight - r.top + 2, maxHeight: Math.min(ALTO_LISTA, arriba) }
          : { top: r.bottom + 2, maxHeight: Math.min(ALTO_LISTA, abajo) }),
      });
    };
    ubicar();
    window.addEventListener("resize", ubicar);
    // En captura: el scroll de cualquier contenedor (la página, un modal)
    // también mueve el campo.
    document.addEventListener("scroll", ubicar, true);
    return () => {
      window.removeEventListener("resize", ubicar);
      document.removeEventListener("scroll", ubicar, true);
    };
  }, [abierto, campo]);

  // La opción marcada tiene que quedar a la vista al moverse con las flechas.
  // Se scrollea solo la lista: scrollIntoView movía también la página.
  useEffect(() => {
    if (!abierto || !lista.current) return;
    const l = lista.current;
    const fila = l.children[marcada];
    if (!fila) return;
    if (fila.offsetTop < l.scrollTop) l.scrollTop = fila.offsetTop;
    else if (fila.offsetTop + fila.offsetHeight > l.scrollTop + l.clientHeight) {
      l.scrollTop = fila.offsetTop + fila.offsetHeight - l.clientHeight;
    }
  }, [marcada, abierto]);

  // Mientras se elige una opción, el blur que sigue no confirma lo tipeado. El
  // onBlur todavía ve la lista abierta y el texto a medias ("ret"), y en modo
  // libre pisaba la opción recién elegida ("Retro") con eso (24/09/2026).
  const eligiendo = useRef(false);

  const elegir = (opcion) => {
    eligiendo.current = true;
    onChange?.(opcion ? opcion.valor : "");
    cerrar();
    campo.current?.blur();
    eligiendo.current = false;
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
        // En modo libre, lo tipeado igual a una opción gana sobre la marcada:
        // "90" + Enter es el CC 90 aunque arriba haya quedado otro que lo
        // contiene en el detalle.
        const exacta =
          libre && busqueda.trim()
            ? filtradas.find((o) => normalizar(o.texto) === normalizar(busqueda.trim()))
            : null;
        if (exacta) elegir(exacta);
        else if (libre && tipeado && !busqueda.trim()) elegir(null);
        else if (filtradas[marcada]) elegir(filtradas[marcada]);
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
          setTipeado(true);
          setMarcada(0);
          if (!abierto) setAbierto(true);
        }}
        onKeyDown={alTeclear}
        // En modo libre, salir del campo confirma lo tipeado: si no, el texto
        // que no coincide con ninguna opción se perdería al hacer clic afuera.
        onBlur={() => {
          if (!abierto || eligiendo.current) return;
          if (libre && busqueda.trim()) elegirTexto(busqueda);
          else if (libre && tipeado) elegir(null);
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

      {abierto && posicion && (
        <ul
          ref={lista}
          className="list-unstyled bg-white border rounded-3 shadow-sm mb-0 py-1"
          style={{
            position: "fixed",
            top: posicion.top,
            bottom: posicion.bottom,
            left: posicion.left,
            width: "max-content",
            minWidth: Math.max(posicion.width, 180),
            maxWidth: posicion.maxWidth,
            maxHeight: posicion.maxHeight,
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
                backgroundColor: i === marcada ? colores.marcada : "transparent",
                color: o.valor === valor ? colores.elegida : "#1e293b",
                // Las destacadas (`destacada`) van primero y en negrita, con una
                // rayita que las separa del resto de la lista.
                fontWeight: o.valor === valor || o.destacada ? 700 : 400,
                ...(!o.destacada && filtradas[i - 1]?.destacada
                  ? { borderTop: "1px solid #e2e8f0", marginTop: "2px", paddingTop: "4px" }
                  : null),
              }}
              onMouseEnter={() => setMarcada(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                elegir(o);
              }}
            >
              {o.texto}
              {o.detalle && (
                <span className="ms-2" style={{ color: "#64748b", fontWeight: 400 }}>
                  {o.detalle}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default SelectBuscador;
