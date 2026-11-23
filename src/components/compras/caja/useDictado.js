import { useEffect, useRef, useState } from "react";

/**
 * Dictar la descripción en la carga de caja del celular (23/11/2026): el
 * reconocimiento de voz que trae el navegador (Chrome, y Safari en iPhone),
 * en castellano de Argentina. Corta solo cuando se deja de hablar y se queda
 * con las primeras MAX_PALABRAS. Necesita conexión: el audio lo procesa el
 * navegador (Google o Apple). Donde no existe (Firefox), `soportado` es false
 * y el botón no se muestra.
 */
export const MAX_PALABRAS = 5;

const Reconocimiento = typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

const recortar = (texto) => {
  const palabras = String(texto || "").trim().split(/\s+/).filter(Boolean).slice(0, MAX_PALABRAS);
  const t = palabras.join(" ");
  return t ? t[0].toUpperCase() + t.slice(1) : "";
};

/**
 * `alTexto(texto)` recibe lo dictado (ya recortado) mientras se habla y al
 * terminar; `alError(mensaje)` si no se pudo.
 */
export default function useDictado({ alTexto, alError }) {
  const [escuchando, setEscuchando] = useState(false);
  const rec = useRef(null);
  // Los callbacks del momento, sin volver a armar el reconocimiento.
  const avisos = useRef({ alTexto, alError });
  useEffect(() => {
    avisos.current = { alTexto, alError };
  });

  useEffect(() => () => rec.current?.abort(), []);

  const empezar = () => {
    if (!Reconocimiento || escuchando) return;
    const r = new Reconocimiento();
    r.lang = "es-AR";
    r.continuous = false;
    r.interimResults = true;
    r.maxAlternatives = 1;
    r.onresult = (e) => {
      const texto = [...e.results].map((x) => x[0]?.transcript || "").join(" ");
      avisos.current.alTexto(recortar(texto));
    };
    r.onerror = (e) => {
      if (e.error === "aborted" || e.error === "no-speech") return;
      const mensaje =
        e.error === "not-allowed" || e.error === "service-not-allowed"
          ? "No hay permiso para usar el micrófono. Habilitalo en la configuración del sitio."
          : e.error === "network"
            ? "Hace falta conexión a internet para dictar."
            : "No se pudo escuchar. Probá de nuevo.";
      avisos.current.alError(mensaje);
    };
    r.onend = () => {
      setEscuchando(false);
      rec.current = null;
    };
    rec.current = r;
    setEscuchando(true);
    try {
      r.start();
    } catch {
      setEscuchando(false);
      rec.current = null;
    }
  };

  const parar = () => rec.current?.stop();

  return { soportado: Boolean(Reconocimiento), escuchando, empezar, parar };
}
