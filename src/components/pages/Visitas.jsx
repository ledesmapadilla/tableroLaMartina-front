import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Container, Button, Modal, Form, Badge } from "react-bootstrap";
import Swal from "sweetalert2";
import ExcelJS from "exceljs";
import { isMobile } from "../../utils/device";

const API = "/api/visitas";

const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie"];
const MESES_NOMBRE = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const GRUPOS = [
  { label: "Grupo 1",       color: "#4a6fa5", bg: "#eef3fa" },
  { label: "Grupo 2",       color: "#52735a", bg: "#edf5ef" },
  { label: "Grupo 3",       color: "#9e8850", bg: "#fcf8ee" },
  { label: "Grupo 4",       color: "#6b5b7b", bg: "#f6f2f9" },
  { label: "Grupo 5",       color: "#7a5038", bg: "#f9f2ee" },
  { label: "NINGUNO",       color: "#64748b", bg: "#f1f5f9" },
  { label: "Berdina",       color: "#991b1b", bg: "#fef2f2" },
  { label: "San Pablo",     color: "#166534", bg: "#f0fdf4" },
  { label: "Repuestos B.",  color: "#7e22ce", bg: "#faf5ff" },
  { label: "Repuestos SP.", color: "#c2410c", bg: "#fff7ed" },
  { label: "Otro",          color: "#475569", bg: "#f8fafc" },
];

const ITINERARIO = [
  {
    dia: "Día 1",
    manana: { text: "Visita a Campo", color: "#0d9488", bg: "#f0fdfa", border: "#99f6e4" },
    tarde: { text: "Reparaciones S. Pablo", color: "#166534", bg: "#f0fdf4", border: "#86efac" },
  },
  {
    dia: "Día 2",
    manana: { text: "Visita a Campo", color: "#0284c7", bg: "#f0f9ff", border: "#bae6fd" },
    tarde: { text: "Repuestos San Pablo", color: "#c2410c", bg: "#fff7ed", border: "#fed7aa" },
  },
  {
    dia: "Día 3",
    manana: { text: "Visita a Campo", color: "#6366f1", bg: "#eef2ff", border: "#c7d2fe" },
    tarde: { text: "Visita a Campo", color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
  },
  {
    dia: "Día 4",
    manana: { text: "Reparaciones Berdina", color: "#991b1b", bg: "#fef2f2", border: "#fecaca" },
    tarde: { text: "Repuestos Berdina", color: "#7e22ce", bg: "#faf5ff", border: "#e9d5ff" },
  },
  {
    dia: "Día 5",
    manana: { text: "Visita a Campo", color: "#059669", bg: "#ecfdf5", border: "#a7f3d0" },
    tarde: { text: "Resumen semanal", color: "#475569", bg: "#f1f5f9", border: "#cbd5e1" },
  },
];

function colorGrupo(label) {
  const l = (label || "").trim();
  if (l === "Repuestos Berdina" || l === "Repuestos B.") return "#7e22ce";
  if (l === "Repuestos San Pablo" || l === "Repuestos SP.") return "#c2410c";
  return GRUPOS.find((g) => g.label === l)?.color ?? "#475569";
}

function bgGrupo(label) {
  const l = (label || "").trim();
  if (l === "Repuestos Berdina" || l === "Repuestos B.") return "#faf5ff";
  if (l === "Repuestos San Pablo" || l === "Repuestos SP.") return "#fff7ed";
  return GRUPOS.find((g) => g.label === l)?.bg ?? "#f8fafc";
}

function celdasMes(año, mes) {
  const totalDias = new Date(año, mes + 1, 0).getDate();
  const arr = [];
  let offsetSet = false;
  for (let d = 1; d <= totalDias; d++) {
    const dow = new Date(año, mes, d).getDay();
    if (dow === 0 || dow === 6) continue;
    if (!offsetSet) {
      for (let i = 0; i < dow - 1; i++) arr.push(null);
      offsetSet = true;
    }
    arr.push(d);
  }
  return arr;
}

function toKey(año, mes, dia) {
  return `${año}-${String(mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

const formVacio = { grupo: "", otroGrupo: "", cc: "", observaciones: "" };

function getGruppoNumFromLabel(grupoLabel) {
  if (grupoLabel === "Grupo 1") return 1;
  if (grupoLabel === "Grupo 2") return 2;
  if (grupoLabel === "Grupo 3") return 3;
  if (grupoLabel === "Grupo 4") return 4;
  if (grupoLabel === "Grupo 5") return 5;
  if (grupoLabel === "Berdina" || grupoLabel === "Repuestos B.") return 6;
  if (grupoLabel === "San Pablo" || grupoLabel === "Repuestos SP.") return 7;
  return null;
}

function Visitas() {
  const navigate = useNavigate();
  const hoy = new Date();

  const [año, setAño] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth());
  const [visitas, setVisitas] = useState({});
  const [diaModal, setDiaModal] = useState(null);
  const [form, setForm] = useState(formVacio);
  const [error, setError] = useState(false);
  const [tractores, setTractores] = useState([]);
  const [mostrarItinerario, setMostrarItinerario] = useState(false);
  const [mostrarResumen, setMostrarResumen] = useState(false);
  const [tabResumen, setTabResumen] = useState("grupos");
  const [ccModalOpen, setCcModalOpen] = useState(false);
  const [ccSeleccionadosTemp, setCcSeleccionadosTemp] = useState([]);

  const esMinimoMes = año === 2026 && mes === 4;

  const retroceder = () => {
    if (esMinimoMes) return;
    if (mes === 0) {
      setMes(11);
      setAño((a) => a - 1);
    } else {
      setMes((m) => m - 1);
    }
  };

  const avanzar = () => {
    if (mes === 11) {
      setMes(0);
      setAño((a) => a + 1);
    } else {
      setMes((m) => m + 1);
    }
  };

  const cargar = async () => {
    try {
      const res = await fetch(API);
      const data = await res.json();
      const agrupadas = {};
      (Array.isArray(data) ? data : []).forEach((v) => {
        (agrupadas[v.fecha] ??= []).push(v);
      });
      setVisitas(agrupadas);
    } catch {
      setVisitas({});
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  useEffect(() => {
    fetch("/api/tractores")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setTractores(Array.isArray(d) ? d : []))
      .catch(() => setTractores([]));
  }, []);

  const abrirDia = (dia) => {
    setDiaModal(dia);
    setForm(formVacio);
    setError(false);
  };

  const grupoRequiereCC = (grupoNombre) => {
    if (
      !grupoNombre ||
      grupoNombre === "Otro" ||
      grupoNombre === "Repuestos B." ||
      grupoNombre === "Repuestos SP." ||
      grupoNombre === "NINGUNO"
    ) {
      return false;
    }
    const gNum = getGruppoNumFromLabel(grupoNombre);
    const tractoresDelGrupo = tractores.filter((t) => gNum === null || (t.gruppo ?? 6) === gNum);
    return tractoresDelGrupo.length > 0;
  };

  const handleCancelarCC = () => {
    if (!form.cc) {
      setForm((f) => ({ ...f, grupo: "", otroGrupo: "", cc: "" }));
    }
    setCcModalOpen(false);
  };

  const handleGrupoChange = (e) => {
    const nuevoGrupo = e.target.value;
    setError(false);

    if (grupoRequiereCC(nuevoGrupo)) {
      setForm((f) => ({ ...f, grupo: nuevoGrupo, otroGrupo: "", cc: "" }));
      const gNum = getGruppoNumFromLabel(nuevoGrupo);
      const tractoresDelGrupo = tractores.filter((t) => gNum === null || (t.gruppo ?? 6) === gNum);
      const opciones = ["Ninguno", ...tractoresDelGrupo.map((t) => t.cc).filter(Boolean)];
      setCcSeleccionadosTemp([]);
      setCcModalOpen(true);
    } else {
      setForm((f) => ({ ...f, grupo: nuevoGrupo, cc: "" }));
    }
  };

  const agregarVisita = async () => {
    const grupoFinal = form.grupo === "Otro" ? form.otroGrupo.trim() : form.grupo;
    if (!grupoFinal) {
      setError(true);
      return;
    }
    const fecha = toKey(año, mes, diaModal);
    const payload = {
      fecha,
      grupo: grupoFinal,
      cc: form.cc,
      observaciones: form.observaciones.trim(),
    };
    try {
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setForm(formVacio);
        setError(false);
        cargar();
      }
    } catch {
      Swal.fire({ icon: "error", title: "Error", text: "No se pudo guardar la visita" });
    }
  };

  const eliminarVisita = async (key, idx) => {
    const visita = visitas[key]?.[idx];
    if (!visita?._id) return;
    try {
      await fetch(`${API}/${visita._id}`, { method: "DELETE" });
      cargar();
    } catch {
      Swal.fire({ icon: "error", title: "Error", text: "No se pudo eliminar la visita" });
    }
  };

  const dias = celdasMes(año, mes);
  const hoyKey = toKey(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const keyModal = diaModal ? toKey(año, mes, diaModal) : null;
  const visitasModal = keyModal ? visitas[keyModal] ?? [] : [];

  // Conteo de visitas por grupo y CC
  const counts = {};
  GRUPOS.forEach((g) => {
    counts[g.label] = 0;
  });

  const countsCC = {};
  const targetPrefix = `${año}-${String(mes + 1).padStart(2, "0")}-`;
  Object.entries(visitas).forEach(([key, list]) => {
    if (key.startsWith(targetPrefix)) {
      list.forEach((v) => {
        if (counts[v.grupo] !== undefined) {
          counts[v.grupo]++;
        } else {
          counts[v.grupo] = (counts[v.grupo] || 0) + 1;
        }
        if (v.cc) {
          const ccs = v.cc.split(",").map((s) => s.trim()).filter(Boolean);
          ccs.forEach((c) => {
            countsCC[c] = (countsCC[c] || 0) + 1;
          });
        }
      });
    }
  });

  // Cálculo de Objetivos Teóricos según días hábiles del mes e Itinerario semanal
  const totalDiasMes = new Date(año, mes + 1, 0).getDate();
  let lunesCount = 0;
  let martesCount = 0;
  let miercolesCount = 0;
  let juevesCount = 0;
  let viernesCount = 0;

  for (let d = 1; d <= totalDiasMes; d++) {
    const dow = new Date(año, mes, d).getDay();
    if (dow === 1) lunesCount++;
    else if (dow === 2) martesCount++;
    else if (dow === 3) miercolesCount++;
    else if (dow === 4) juevesCount++;
    else if (dow === 5) viernesCount++;
  }

  // 1- Visitas a Campo: Lunes (1) + Martes (1) + Miércoles (2) + Viernes (1)
  const campoTeorico = lunesCount * 1 + martesCount * 1 + miercolesCount * 2 + viernesCount * 1;
  // 2- Visitas a Talleres (San Pablo y Berdina): Lunes Tarde (1) + Jueves Mañana (1)
  const talleresTeorico = lunesCount * 1 + juevesCount * 1;
  // 3- Repuestos (San Pablo y Berdina): Martes Tarde (1) + Jueves Tarde (1)
  const repuestosTeorico = martesCount * 1 + juevesCount * 1;
  const totalTeorico = campoTeorico + talleresTeorico + repuestosTeorico;

  // Conteo de lo hecho en el mes
  let campoHecho = 0;
  let talleresHecho = 0;
  let repuestosHecho = 0;

  const gruposCampo = new Set([
    "grupo 1",
    "grupo 2",
    "grupo 3",
    "grupo 4",
    "grupo 5",
  ]);
  const gruposTalleres = new Set([
    "berdina",
    "san pablo",
    "reparaciones berdina",
    "reparaciones san pablo",
    "reparaciones s. pablo",
  ]);
  const gruposRepuestos = new Set([
    "repuestos b.",
    "repuestos berdina",
    "repuestos sp.",
    "repuestos san pablo",
  ]);

  Object.entries(visitas).forEach(([key, list]) => {
    if (key.startsWith(targetPrefix)) {
      list.forEach((v) => {
        const gLow = (v.grupo || "").trim().toLowerCase();
        if (gruposCampo.has(gLow)) {
          campoHecho++;
        } else if (gruposTalleres.has(gLow)) {
          talleresHecho++;
        } else if (gruposRepuestos.has(gLow)) {
          repuestosHecho++;
        }
      });
    }
  });
  const totalHecho = campoHecho + talleresHecho + repuestosHecho;

  const filasGeneral = [
    {
      num: "1",
      tipo: "Visitas a campo",
      descripcion: "Marcadas con cualquiera de los 5 grupos",
      icono: "bi-tree-fill",
      color: "#0d9488",
      bg: "#f0fdfa",
      border: "#99f6e4",
      teorico: campoTeorico,
      hecho: campoHecho,
    },
    {
      num: "2",
      tipo: "Visitas a talleres",
      descripcion: "Marcadas con Berdina o San Pablo",
      icono: "bi-tools",
      color: "#166534",
      bg: "#f0fdf4",
      border: "#86efac",
      teorico: talleresTeorico,
      hecho: talleresHecho,
    },
    {
      num: "3",
      tipo: "Repuestos",
      descripcion: "Marcadas con Repuestos Berdina o San Pablo",
      icono: "bi-gear-wide-connected",
      color: "#c2410c",
      bg: "#fff7ed",
      border: "#fed7aa",
      teorico: repuestosTeorico,
      hecho: repuestosHecho,
    },
  ];

  const ccsOrdenados = [
    ...new Set([...tractores.map((t) => t.cc).filter(Boolean), ...Object.keys(countsCC)]),
  ].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const exportarExcelGrupos = async () => {
    try {
      const nombreMes = MESES_NOMBRE[mes];
      const titulo = `Resumen de Visitas por Grupo - ${nombreMes} ${año}`;
      const fechaHoy = new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
      const columnas = ["Grupo", "Cantidad de Visitas"];
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Visitas por Grupo");

      ws.mergeCells(1, 1, 1, 2);
      const celdaTitulo = ws.getCell("A1");
      celdaTitulo.value = titulo;
      celdaTitulo.font = { bold: true, size: 14 };
      celdaTitulo.alignment = { horizontal: "center", vertical: "middle" };
      ws.getRow(1).height = 24;

      ws.mergeCells(2, 1, 2, 2);
      const celdaFecha = ws.getCell("A2");
      celdaFecha.value = `Fecha: ${fechaHoy}`;
      celdaFecha.font = { italic: true, size: 10, color: { argb: "FF555555" } };
      celdaFecha.alignment = { horizontal: "center", vertical: "middle" };
      ws.getRow(2).height = 18;

      ws.addRow([]);

      const filaEncabezado = ws.addRow(columnas);
      filaEncabezado.height = 22;
      filaEncabezado.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
        cell.alignment = { horizontal: "center", vertical: "middle" };
      });

      const listaGruposFinal = [
        ...GRUPOS.map((g) => g.label),
        ...Object.keys(counts).filter((k) => !GRUPOS.some((g) => g.label === k)),
      ];

      listaGruposFinal.forEach((grupoLabel, idx) => {
        const count = counts[grupoLabel] || 0;
        const row = ws.addRow([grupoLabel, count]);
        row.height = 20;
        row.getCell(1).alignment = { horizontal: "left", vertical: "middle" };
        row.getCell(2).alignment = { horizontal: "center", vertical: "middle" };
        if (idx % 2 === 1) {
          row.eachCell((cell) => {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
          });
        }
      });

      const totalVal = Object.values(counts).reduce((a, b) => a + b, 0);
      const rowTotal = ws.addRow(["Total", totalVal]);
      rowTotal.height = 22;
      rowTotal.eachCell((cell) => {
        cell.font = { bold: true };
      });
      rowTotal.getCell(1).alignment = { horizontal: "left", vertical: "middle" };
      rowTotal.getCell(2).alignment = { horizontal: "center", vertical: "middle" };

      ws.getColumn(1).width = 25;
      ws.getColumn(2).width = 20;

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Resumen_Visitas_Grupos_${nombreMes}_${año}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      Swal.fire({ icon: "error", title: "Error", text: "No se pudo exportar a Excel" });
    }
  };

  const exportarExcelCC = async () => {
    try {
      const nombreMes = MESES_NOMBRE[mes];
      const titulo = `Resumen de Visitas por Centro de Costo (CC) - ${nombreMes} ${año}`;
      const fechaHoy = new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
      const columnas = ["Centro de Costo (CC)", "Descripción", "Cantidad de Visitas"];
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Visitas por CC");

      ws.mergeCells(1, 1, 1, 3);
      const celdaTitulo = ws.getCell("A1");
      celdaTitulo.value = titulo;
      celdaTitulo.font = { bold: true, size: 14 };
      celdaTitulo.alignment = { horizontal: "center", vertical: "middle" };
      ws.getRow(1).height = 24;

      ws.mergeCells(2, 1, 2, 3);
      const celdaFecha = ws.getCell("A2");
      celdaFecha.value = `Fecha: ${fechaHoy}`;
      celdaFecha.font = { italic: true, size: 10, color: { argb: "FF555555" } };
      celdaFecha.alignment = { horizontal: "center", vertical: "middle" };
      ws.getRow(2).height = 18;

      ws.addRow([]);

      const filaEncabezado = ws.addRow(columnas);
      filaEncabezado.height = 22;
      filaEncabezado.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
        cell.alignment = { horizontal: "center", vertical: "middle" };
      });

      ccsOrdenados.forEach((cc, idx) => {
        const count = countsCC[cc] || 0;
        const tracInfo = tractores.find((t) => t.cc === cc);
        const desc = tracInfo?.descripcion || "-";
        const row = ws.addRow([cc, desc, count]);
        row.height = 20;
        row.getCell(1).alignment = { horizontal: "left", vertical: "middle" };
        row.getCell(2).alignment = { horizontal: "left", vertical: "middle" };
        row.getCell(3).alignment = { horizontal: "center", vertical: "middle" };
        if (idx % 2 === 1) {
          row.eachCell((cell) => {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
          });
        }
      });

      const totalVal = Object.values(countsCC).reduce((a, b) => a + b, 0);
      const rowTotal = ws.addRow(["Total", "", totalVal]);
      rowTotal.height = 22;
      rowTotal.eachCell((cell) => {
        cell.font = { bold: true };
      });
      rowTotal.getCell(1).alignment = { horizontal: "left", vertical: "middle" };
      rowTotal.getCell(3).alignment = { horizontal: "center", vertical: "middle" };

      ws.getColumn(1).width = 22;
      ws.getColumn(2).width = 35;
      ws.getColumn(3).width = 20;

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Resumen_Visitas_CC_${nombreMes}_${año}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      Swal.fire({ icon: "error", title: "Error", text: "No se pudo exportar a Excel" });
    }
  };

  const exportarExcelGeneral = async () => {
    try {
      const nombreMes = MESES_NOMBRE[mes];
      const titulo = `Resumen General: Objetivos vs Realizados - ${nombreMes} ${año}`;
      const fechaHoy = new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
      const columnas = ["Objetivo", "Teórico (Itinerario)", "Realizado (Hecho)", "Diferencia", "% Cumplimiento"];
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Resumen General");

      ws.mergeCells(1, 1, 1, 5);
      const celdaTitulo = ws.getCell("A1");
      celdaTitulo.value = titulo;
      celdaTitulo.font = { bold: true, size: 14 };
      celdaTitulo.alignment = { horizontal: "center", vertical: "middle" };
      ws.getRow(1).height = 24;

      ws.mergeCells(2, 1, 2, 5);
      const celdaFecha = ws.getCell("A2");
      celdaFecha.value = `Fecha: ${fechaHoy}`;
      celdaFecha.font = { italic: true, size: 10, color: { argb: "FF555555" } };
      celdaFecha.alignment = { horizontal: "center", vertical: "middle" };
      ws.getRow(2).height = 18;

      ws.addRow([]);

      const filaEncabezado = ws.addRow(columnas);
      filaEncabezado.height = 22;
      filaEncabezado.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
        cell.alignment = { horizontal: "center", vertical: "middle" };
      });

      filasGeneral.forEach((r, idx) => {
        const dif = r.hecho - r.teorico;
        const pct = r.teorico > 0 ? `${Math.round((r.hecho / r.teorico) * 100)}%` : "—";
        const row = ws.addRow([r.tipo, r.teorico, r.hecho, dif > 0 ? `+${dif}` : dif, pct]);
        row.height = 20;
        row.getCell(1).alignment = { horizontal: "left", vertical: "middle" };
        row.getCell(2).alignment = { horizontal: "center", vertical: "middle" };
        row.getCell(3).alignment = { horizontal: "center", vertical: "middle" };
        row.getCell(4).alignment = { horizontal: "center", vertical: "middle" };
        row.getCell(5).alignment = { horizontal: "center", vertical: "middle" };
        if (idx % 2 === 1) {
          row.eachCell((cell) => {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
          });
        }
      });

      const totalDif = totalHecho - totalTeorico;
      const totalPct = totalTeorico > 0 ? `${Math.round((totalHecho / totalTeorico) * 100)}%` : "—";
      const rowTotal = ws.addRow(["Total General", totalTeorico, totalHecho, totalDif > 0 ? `+${totalDif}` : totalDif, totalPct]);
      rowTotal.height = 22;
      rowTotal.eachCell((cell) => {
        cell.font = { bold: true };
      });
      rowTotal.getCell(1).alignment = { horizontal: "left", vertical: "middle" };
      rowTotal.getCell(2).alignment = { horizontal: "center", vertical: "middle" };
      rowTotal.getCell(3).alignment = { horizontal: "center", vertical: "middle" };
      rowTotal.getCell(4).alignment = { horizontal: "center", vertical: "middle" };
      rowTotal.getCell(5).alignment = { horizontal: "center", vertical: "middle" };

      ws.getColumn(1).width = 25;
      ws.getColumn(2).width = 20;
      ws.getColumn(3).width = 20;
      ws.getColumn(4).width = 16;
      ws.getColumn(5).width = 18;

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Resumen_General_Visitas_${nombreMes}_${año}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      Swal.fire({ icon: "error", title: "Error", text: "No se pudo exportar a Excel" });
    }
  };

  const añosDisponibles = Array.from({ length: 11 }, (_, i) => 2026 + i);

  const getModalTitle = () => {
    if (!diaModal) return "";
    const dateObj = new Date(año, mes, diaModal);
    const diasSemana = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
    const nombreDia = diasSemana[dateObj.getDay()];
    return `${nombreDia}, ${diaModal} de ${MESES_NOMBRE[mes]} de ${año}`;
  };

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#f8f9fa",
        minHeight: "100%",
        overflowX: "hidden",
      }}
    >
      {/* Barra de Cabecera: solo en escritorio */}
      {!isMobile && (
        <div
          className="d-flex align-items-center justify-content-between px-3 px-md-4 py-2 border-bottom shadow-sm flex-shrink-0"
          style={{ backgroundColor: "#1e293b", color: "#fff", height: "54px", position: "relative" }}
        >
          {/* Lado Izquierdo: Icono */}
          <div className="d-flex align-items-center gap-2">
            <div
              className="rounded-3 d-flex align-items-center justify-content-center"
              style={{
                width: "34px",
                height: "34px",
                backgroundColor: "#3b82f6",
                color: "#fff",
                fontSize: "1.15rem",
                boxShadow: "0 2px 8px rgba(59, 130, 246, 0.3)",
              }}
            >
              <i className="bi bi-calendar4-week"></i>
            </div>
            <span className="text-light opacity-75 small">Visitas</span>
          </div>

          {/* Título Centrado */}
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              textAlign: "center",
              width: "max-content",
              pointerEvents: "none",
            }}
          >
            <span className="text-white fw-normal" style={{ fontSize: "1.05rem", letterSpacing: "0.3px" }}>
              Planificación de Visitas
            </span>
          </div>

          {/* Botones de Navegación */}
          <div className="d-flex align-items-center gap-2">
            <button
              onClick={() => navigate("/")}
              className="btn btn-sm btn-light text-dark d-flex align-items-center gap-1 rounded-3 px-2.5 py-1"
              style={{ fontSize: "0.82rem" }}
            >
              <i className="bi bi-house-door-fill"></i>
              <span>General</span>
            </button>
          </div>
        </div>
      )}

      {/* Encabezado limpio para celulares (sin navbar) */}
      {isMobile && (
        <div className="px-3 pt-2 pb-1 d-flex align-items-center justify-content-between">
          <h4 className="fw-bold mb-0 text-dark" style={{ fontSize: "1.25rem" }}>
            Visitas
          </h4>
        </div>
      )}

      {/* Contenedor Principal */}
      <Container
        fluid
        className="px-2 px-md-4 py-3 d-flex flex-column flex-grow-1"
        style={{ maxWidth: "980px", width: "100%", margin: "0 auto" }}
      >
        {/* Barra de Navegación de Mes y Año + Acciones */}
        <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
          {/* Selector de Mes / Año */}
          <div className="d-flex align-items-center gap-2">
            <button
              onClick={retroceder}
              className="btn btn-sm d-flex align-items-center justify-content-center rounded-3 text-white shadow-sm"
              style={{
                backgroundColor: "#1e293b",
                border: "1px solid #475569",
                width: "34px",
                height: "34px",
                opacity: esMinimoMes ? 0.35 : 1,
                cursor: esMinimoMes ? "default" : "pointer",
              }}
              disabled={esMinimoMes}
              title="Mes anterior"
            >
              <i className="bi bi-chevron-left"></i>
            </button>

            <div className="d-flex align-items-center gap-1.5 bg-white border rounded-3 p-1 shadow-sm" style={{ borderColor: "#cbd5e1" }}>
              <Form.Select
                value={mes}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (año === 2026 && val < 4) {
                    setMes(4);
                  } else {
                    setMes(val);
                  }
                }}
                size="sm"
                className="border-0 fw-bold text-dark"
                style={{
                  fontSize: isMobile ? "0.86rem" : "0.92rem",
                  width: isMobile ? "115px" : "135px",
                  cursor: "pointer",
                  backgroundColor: "transparent",
                }}
              >
                {MESES_NOMBRE.map((mNombre, idx) => (
                  <option key={idx} value={idx} disabled={año === 2026 && idx < 4}>
                    {mNombre}
                  </option>
                ))}
              </Form.Select>

              <Form.Select
                value={año}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (val === 2026 && mes < 4) {
                    setMes(4);
                  }
                  setAño(val);
                }}
                size="sm"
                className="border-0 fw-bold text-dark"
                style={{
                  fontSize: isMobile ? "0.86rem" : "0.92rem",
                  width: isMobile ? "80px" : "90px",
                  cursor: "pointer",
                  backgroundColor: "transparent",
                }}
              >
                {añosDisponibles.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </Form.Select>
            </div>

            <button
              onClick={avanzar}
              className="btn btn-sm d-flex align-items-center justify-content-center rounded-3 text-white shadow-sm"
              style={{
                backgroundColor: "#1e293b",
                border: "1px solid #475569",
                width: "34px",
                height: "34px",
                cursor: "pointer",
              }}
              title="Mes siguiente"
            >
              <i className="bi bi-chevron-right"></i>
            </button>
          </div>

          {/* Botones Itinerario y Resumen */}
          <div className="d-flex align-items-center gap-2">
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={() => setMostrarItinerario(true)}
              className="d-inline-flex align-items-center gap-1.5 rounded-3 px-3 py-1.5 shadow-sm fw-semibold"
              style={{
                borderColor: "#cbd5e1",
                backgroundColor: "#fff",
                color: "#1e293b",
                fontSize: "0.82rem",
              }}
            >
              <i className="bi bi-journal-text text-primary"></i>
              <span>Itinerario</span>
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setMostrarResumen(true)}
              className="d-inline-flex align-items-center gap-1.5 rounded-3 px-3 py-1.5 shadow-sm fw-semibold"
              style={{
                backgroundColor: "#1e293b",
                borderColor: "#1e293b",
                fontSize: "0.82rem",
              }}
            >
              <i className="bi bi-bar-chart-fill text-info"></i>
              <span>Resumen</span>
            </Button>
          </div>
        </div>

        {/* Calendario Semanal (Lun - Vie) */}
        <div
          className="shadow-sm rounded-3 bg-white p-2 p-md-3 mb-3"
          style={{ border: "1px solid #cbd5e1" }}
        >
          {/* Cabecera de Días */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
              gap: isMobile ? "4px" : "8px",
              marginBottom: isMobile ? "4px" : "8px",
            }}
          >
            {DIAS.map((d) => (
              <div
                key={d}
                className="py-1.5 text-center fw-bold rounded-2 text-white"
                style={{
                  backgroundColor: "#1e293b",
                  fontSize: isMobile ? "0.74rem" : "0.84rem",
                  letterSpacing: "0.5px",
                }}
              >
                {d}
              </div>
            ))}
          </div>

          {/* Celdas de Días */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
              gap: isMobile ? "4px" : "8px",
            }}
          >
            {dias.map((dia, idx) => {
              if (!dia) {
                return (
                  <div
                    key={`empty-${idx}`}
                    className="rounded-2"
                    style={{
                      backgroundColor: "#f8fafc",
                      border: "1px dashed #e2e8f0",
                      minHeight: isMobile ? "72px" : "105px",
                    }}
                  />
                );
              }

              const key = toKey(año, mes, dia);
              const vDia = visitas[key] ?? [];
              const esHoy = key === hoyKey;

              return (
                <div
                  key={key}
                  onClick={() => abrirDia(dia)}
                  className="rounded-2 p-1.5 d-flex flex-column justify-content-between"
                  style={{
                    border: esHoy ? "2px solid #3b82f6" : "1px solid #e2e8f0",
                    minHeight: isMobile ? "74px" : "105px",
                    cursor: "pointer",
                    backgroundColor: esHoy ? "#eff6ff" : "#ffffff",
                    transition: "all 0.15s ease",
                    boxShadow: esHoy ? "0 0 0 1px #3b82f6" : "none",
                  }}
                  onMouseEnter={(e) => {
                    if (!esHoy) e.currentTarget.style.backgroundColor = "#f8fafc";
                  }}
                  onMouseLeave={(e) => {
                    if (!esHoy) e.currentTarget.style.backgroundColor = "#ffffff";
                  }}
                >
                  {/* Número de Día */}
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <span
                      className={`badge ${esHoy ? "bg-primary text-white" : "text-dark"}`}
                      style={{
                        fontSize: isMobile ? "0.72rem" : "0.82rem",
                        fontWeight: esHoy ? 700 : 600,
                        padding: esHoy ? "2px 6px" : 0,
                      }}
                    >
                      {dia}
                    </span>
                    {esHoy && (
                      <span className="badge bg-primary-subtle text-primary border border-primary-subtle d-none d-md-inline" style={{ fontSize: "0.65rem" }}>
                        Hoy
                      </span>
                    )}
                  </div>

                  {/* Pastillas de Visitas */}
                  <div className="d-flex flex-column gap-1 overflow-hidden flex-grow-1">
                    {vDia.slice(0, 2).map((v, i) => (
                      <div
                        key={i}
                        className="text-truncate px-1 py-0.5 rounded text-center fw-semibold"
                        style={{
                          backgroundColor: bgGrupo(v.grupo),
                          color: colorGrupo(v.grupo),
                          border: `1px solid ${colorGrupo(v.grupo)}30`,
                          fontSize: isMobile ? "0.64rem" : "0.74rem",
                          lineHeight: "1.2",
                        }}
                        title={`${v.grupo}${v.cc ? ` (${v.cc})` : ""}${v.observaciones ? ` - ${v.observaciones}` : ""}`}
                      >
                        {v.grupo}
                      </div>
                    ))}
                    {vDia.length > 2 && (
                      <div
                        className="text-muted text-center fw-semibold mt-auto"
                        style={{ fontSize: isMobile ? "0.6rem" : "0.68rem" }}
                      >
                        +{vDia.length - 2} más
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Leyenda de Supervisores */}
        <div
          className="shadow-sm rounded-3 bg-white p-3 border"
          style={{ borderColor: "#cbd5e1" }}
        >
          <h6 className="fw-bold text-dark mb-2" style={{ fontSize: "0.88rem" }}>
            Supervisores por Grupo
          </h6>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(5, 1fr)",
              gap: "8px 12px",
            }}
          >
            {[1, 2, 3, 4, 5].map((g) => {
              const label = `Grupo ${g}`;
              const sups = [
                ...new Set(
                  tractores
                    .filter((t) => (t.gruppo ?? 6) === g)
                    .map((t) => (t.supervisor || "").trim())
                    .filter(Boolean)
                ),
              ];
              return (
                <div key={g} className="d-flex align-items-center gap-2">
                  <span
                    style={{
                      width: "12px",
                      height: "12px",
                      borderRadius: "3px",
                      backgroundColor: colorGrupo(label),
                      flexShrink: 0,
                    }}
                  />
                  <div className="d-flex flex-column" style={{ fontSize: isMobile ? "0.76rem" : "0.82rem" }}>
                    <span className="fw-bold text-dark">{label}</span>
                    <span className="text-muted text-truncate" style={{ maxWidth: "120px" }}>
                      {sups.length ? sups.join(", ") : "—"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Container>

      {/* Modal: Detalle del Día / Cargar Visita */}
      <Modal show={diaModal !== null} onHide={() => setDiaModal(null)} centered contentClassName="border-0 shadow-lg rounded-4 overflow-visible">
        <Modal.Header
          closeButton
          closeVariant="white"
          style={{ backgroundColor: "#1e293b", color: "#fff", borderTopLeftRadius: "1rem", borderTopRightRadius: "1rem" }}
        >
          <Modal.Title className="fs-6 fw-bold d-flex align-items-center gap-2">
            <i className="bi bi-calendar-event text-info"></i>
            <span>{getModalTitle()}</span>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-3 p-md-4">
          {/* Visitas registradas en el día */}
          {visitasModal.length > 0 && (
            <div className="mb-3">
              <h6 className="fw-bold text-dark small mb-2">Visitas asignadas:</h6>
              <div className="d-flex flex-column gap-2">
                {visitasModal.map((v, i) => (
                  <div
                    key={i}
                    className="p-2.5 rounded-3 d-flex justify-content-between align-items-center border"
                    style={{
                      backgroundColor: bgGrupo(v.grupo),
                      borderColor: `${colorGrupo(v.grupo)}40`,
                      borderLeft: `4px solid ${colorGrupo(v.grupo)}`,
                    }}
                  >
                    <div className="d-flex flex-column">
                      <div className="d-flex align-items-center gap-2 flex-wrap">
                        <span className="fw-bold" style={{ color: colorGrupo(v.grupo), fontSize: "0.92rem" }}>
                          {v.grupo}
                        </span>
                        {v.cc && (
                          <Badge bg="dark" className="fw-normal" style={{ fontSize: "0.72rem" }}>
                            CC: {v.cc}
                          </Badge>
                        )}
                      </div>
                      {v.observaciones && (
                        <span className="text-secondary small mt-0.5" style={{ fontSize: "0.8rem" }}>
                          {v.observaciones}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => eliminarVisita(keyModal, i)}
                      className="btn btn-sm btn-outline-danger border-0 p-1"
                      title="Eliminar visita"
                    >
                      <i className="bi bi-trash fs-6"></i>
                    </button>
                  </div>
                ))}
              </div>
              <hr className="my-3 text-muted" />
            </div>
          )}

          {/* Formulario de Nueva Visita */}
          <h6 className="fw-bold text-dark small mb-2">
            {visitasModal.length > 0 ? "Agregar otra visita:" : "Registrar visita:"}
          </h6>

          <Form.Group className="mb-3">
            <Form.Label className="fw-semibold small text-dark mb-1">Grupo de destino *</Form.Label>
            <Form.Select
              value={form.grupo}
              onChange={handleGrupoChange}
              isInvalid={error && !form.grupo}
              className="rounded-3"
              style={{ fontSize: "0.85rem" }}
            >
              <option value="">— Seleccionar Grupo —</option>
              {GRUPOS.map((g) => (
                <option key={g.label} value={g.label}>
                  {g.label}
                </option>
              ))}
            </Form.Select>
            {error && !form.grupo && (
              <Form.Control.Feedback type="invalid" style={{ fontSize: "0.78rem" }}>
                Seleccioná un grupo
              </Form.Control.Feedback>
            )}
          </Form.Group>

          {form.grupo === "Otro" && (
            <Form.Group className="mb-3">
              <Form.Label className="fw-semibold small text-dark mb-1">Especificar Grupo *</Form.Label>
              <Form.Control
                type="text"
                placeholder="Nombre del grupo..."
                value={form.otroGrupo || ""}
                onChange={(e) => {
                  setForm((f) => ({ ...f, otroGrupo: e.target.value }));
                  setError(false);
                }}
                isInvalid={error && !form.otroGrupo.trim()}
                className="rounded-3"
                style={{ fontSize: "0.85rem" }}
              />
            </Form.Group>
          )}

          {(() => {
            if (
              !form.grupo ||
              form.grupo === "Repuestos B." ||
              form.grupo === "Repuestos SP." ||
              form.grupo === "NINGUNO"
            )
              return null;
            const gNum = getGruppoNumFromLabel(form.grupo);
            const ccOpciones = tractores.filter((t) => gNum === null || (t.gruppo ?? 6) === gNum);
            if (ccOpciones.length === 0) return null;

            return (
              <Form.Group className="mb-3">
                <Form.Label className="fw-semibold small text-dark mb-1">Centro de Costo (CC)</Form.Label>
                <Button
                  variant="outline-secondary"
                  className="w-100 text-start d-flex justify-content-between align-items-center rounded-3 py-1.5 px-3"
                  style={{ borderColor: "#cbd5e1", backgroundColor: "#fff", fontSize: "0.85rem" }}
                  onClick={() => {
                    const ccsActuales = form.cc
                      ? form.cc.split(", ").map((s) => s.trim()).filter(Boolean)
                      : [];
                    setCcSeleccionadosTemp(ccsActuales);
                    setCcModalOpen(true);
                  }}
                >
                  <span className="text-truncate">
                    {form.cc ? (
                      <span className="fw-bold text-dark">{form.cc}</span>
                    ) : (
                      <span className="text-muted">— Elegir CCs (con tilde) —</span>
                    )}
                  </span>
                  <i className="bi bi-check2-square text-success fs-6 ms-2"></i>
                </Button>
              </Form.Group>
            );
          })()}

          <Form.Group className="mb-1">
            <Form.Label className="fw-semibold small text-dark mb-1">Observaciones</Form.Label>
            <Form.Control
              type="text"
              placeholder="Detalles opcionales..."
              value={form.observaciones}
              onChange={(e) => setForm((f) => ({ ...f, observaciones: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && agregarVisita()}
              className="rounded-3"
              style={{ fontSize: "0.85rem" }}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer className="bg-light border-0 py-2.5 px-4" style={{ borderBottomLeftRadius: "1rem", borderBottomRightRadius: "1rem" }}>
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={() => setDiaModal(null)}
            className="rounded-3 px-3 py-1.5"
            style={{ fontSize: "0.84rem" }}
          >
            Cerrar
          </Button>
          <Button
            variant="success"
            size="sm"
            onClick={agregarVisita}
            className="rounded-3 px-3.5 py-1.5 shadow-sm d-flex align-items-center gap-1.5"
            style={{ backgroundColor: "#15803d", borderColor: "#15803d", fontSize: "0.84rem", fontWeight: 600 }}
          >
            <i className="bi bi-check-lg"></i>
            <span>Guardar</span>
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal: Itinerario de Visitas */}
      <Modal show={mostrarItinerario} onHide={() => setMostrarItinerario(false)} size="lg" centered contentClassName="border-0 shadow-lg rounded-4 overflow-hidden">
        <Modal.Header
          closeButton
          closeVariant="white"
          style={{ backgroundColor: "#1e293b", color: "#fff" }}
        >
          <Modal.Title className="fs-6 fw-bold d-flex align-items-center gap-2">
            <i className="bi bi-journal-text text-info"></i>
            <span>Itinerario Semanal Estándar</span>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className={isMobile ? "p-2" : "p-4"}>
          <div className="rounded-3 border" style={{ borderColor: "#cbd5e1", overflow: "hidden", width: "100%" }}>
            <table className="table table-hover align-middle text-center mb-0" style={{ tableLayout: "fixed", width: "100%", fontSize: isMobile ? "0.72rem" : "0.86rem" }}>
              <thead style={{ backgroundColor: "#1e293b", color: "#fff" }}>
                <tr>
                  <th style={{ backgroundColor: "#1e293b", color: "#fff", padding: isMobile ? "6px 2px" : "8px", width: isMobile ? "18%" : "15%" }}></th>
                  <th style={{ backgroundColor: "#1e293b", color: "#fff", padding: isMobile ? "6px 2px" : "8px", width: isMobile ? "41%" : "42.5%" }}>Mañana</th>
                  <th style={{ backgroundColor: "#1e293b", color: "#fff", padding: isMobile ? "6px 2px" : "8px", width: isMobile ? "41%" : "42.5%" }}>Tarde</th>
                </tr>
              </thead>
              <tbody>
                {ITINERARIO.map((item, idx) => (
                  <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? "#ffffff" : "#f8fafc" }}>
                    <td className="fw-bold text-secondary" style={{ padding: isMobile ? "6px 2px" : "8px", fontSize: isMobile ? "0.7rem" : "0.86rem" }}>
                      {item.dia}
                    </td>
                    <td style={{ padding: isMobile ? "4px 2px" : "8px 6px" }}>
                      <span
                        className="badge rounded-2 border fw-semibold d-block text-wrap"
                        style={{
                          backgroundColor: item.manana.bg,
                          color: item.manana.color,
                          borderColor: item.manana.border,
                          fontSize: isMobile ? "0.66rem" : "0.82rem",
                          padding: isMobile ? "4px 2px" : "6px 12px",
                          lineHeight: "1.15",
                        }}
                      >
                        {item.manana.text}
                      </span>
                    </td>
                    <td style={{ padding: isMobile ? "4px 2px" : "8px 6px" }}>
                      <span
                        className="badge rounded-2 border fw-semibold d-block text-wrap"
                        style={{
                          backgroundColor: item.tarde.bg,
                          color: item.tarde.color,
                          borderColor: item.tarde.border,
                          fontSize: isMobile ? "0.66rem" : "0.82rem",
                          padding: isMobile ? "4px 2px" : "6px 12px",
                          lineHeight: "1.15",
                        }}
                      >
                        {item.tarde.text}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Modal.Body>
        <Modal.Footer className="bg-light border-0 py-2.5 px-4">
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={() => setMostrarItinerario(false)}
            className="rounded-3 px-3"
            style={{ fontSize: "0.84rem" }}
          >
            Cerrar
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal: Resumen Mensual con Pestañas y Excel */}
      <Modal show={mostrarResumen} onHide={() => setMostrarResumen(false)} size="lg" centered contentClassName="border-0 shadow-lg rounded-4 overflow-hidden">
        <Modal.Header
          closeButton
          closeVariant="white"
          style={{ backgroundColor: "#1e293b", color: "#fff" }}
        >
          <Modal.Title className="fs-6 fw-bold d-flex align-items-center gap-2">
            <i className="bi bi-bar-chart-fill text-info"></i>
            <span>Resumen Mensual de Visitas — {MESES_NOMBRE[mes]} {año}</span>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-3 p-md-4">
          {/* Barra de Controles y Botón Excel */}
          <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
            <div className="btn-group btn-group-sm" role="group">
              <button
                type="button"
                className={`btn ${tabResumen === "general" ? "btn-dark fw-bold" : "btn-outline-secondary"}`}
                onClick={() => setTabResumen("general")}
                style={{ fontSize: "0.82rem" }}
              >
                <i className="bi bi-speedometer2 me-1.5"></i>General
              </button>
              <button
                type="button"
                className={`btn ${tabResumen === "grupos" ? "btn-dark fw-bold" : "btn-outline-secondary"}`}
                onClick={() => setTabResumen("grupos")}
                style={{ fontSize: "0.82rem" }}
              >
                <i className="bi bi-people-fill me-1.5"></i>Por Grupo
              </button>
              <button
                type="button"
                className={`btn ${tabResumen === "cc" ? "btn-dark fw-bold" : "btn-outline-secondary"}`}
                onClick={() => setTabResumen("cc")}
                style={{ fontSize: "0.82rem" }}
              >
                <i className="bi bi-geo-alt-fill me-1.5"></i>Por CC
              </button>
            </div>

            <Button
              variant="success"
              size="sm"
              className="d-inline-flex align-items-center gap-1.5 rounded-3 px-3 py-1 shadow-sm"
              style={{ backgroundColor: "#15803d", borderColor: "#15803d", fontSize: "0.82rem", fontWeight: 600 }}
              onClick={
                tabResumen === "general"
                  ? exportarExcelGeneral
                  : tabResumen === "grupos"
                  ? exportarExcelGrupos
                  : exportarExcelCC
              }
              title="Descargar Excel"
            >
              <i className="bi bi-file-earmark-excel-fill"></i>
              <span>Excel</span>
            </Button>
          </div>

          {/* Solapa 1: Resumen General (Objetivos Teóricos vs Hecho) */}
          {tabResumen === "general" && (
            <div className="d-flex flex-column gap-3">
              {/* Card de Objetivos Teóricos según Itinerario */}
              <div
                className="p-3 rounded-3 border shadow-sm"
                style={{ backgroundColor: "#f8fafc", borderColor: "#cbd5e1" }}
              >
                <h6
                  className="fw-bold text-dark text-center d-flex align-items-center justify-content-center gap-2 mb-2.5"
                  style={{ fontSize: isMobile ? "0.85rem" : "0.92rem" }}
                >
                  <i className="bi bi-bullseye text-primary fs-5"></i>
                  <span>Objetivos teóricos del mes</span>
                </h6>
                <div className="d-flex flex-column gap-2" style={{ fontSize: isMobile ? "0.8rem" : "0.86rem" }}>
                  <div className="d-flex align-items-center gap-2">
                    <span
                      className="badge rounded-pill text-white px-2 py-0.5"
                      style={{ backgroundColor: "#0d9488", fontSize: "0.72rem" }}
                    >
                      1
                    </span>
                    <div>
                      <strong className="text-dark">Visitas a campo:</strong>{" "}
                      <span className="fw-bold text-dark">{campoTeorico}</span>
                    </div>
                  </div>
                  <div className="d-flex align-items-center gap-2">
                    <span
                      className="badge rounded-pill text-white px-2 py-0.5"
                      style={{ backgroundColor: "#166534", fontSize: "0.72rem" }}
                    >
                      2
                    </span>
                    <div>
                      <strong className="text-dark">Visitas a talleres:</strong>{" "}
                      <span className="fw-bold text-dark">{talleresTeorico}</span>
                    </div>
                  </div>
                  <div className="d-flex align-items-center gap-2">
                    <span
                      className="badge rounded-pill text-white px-2 py-0.5"
                      style={{ backgroundColor: "#c2410c", fontSize: "0.72rem" }}
                    >
                      3
                    </span>
                    <div>
                      <strong className="text-dark">Repuestos:</strong>{" "}
                      <span className="fw-bold text-dark">{repuestosTeorico}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tabla Comparativa: Lo Hecho vs Lo Teórico */}
              <div className="rounded-3 border shadow-sm" style={{ borderColor: "#cbd5e1", overflow: "hidden", width: "100%" }}>
                <table
                  className="table table-hover align-middle text-center mb-0"
                  style={{ tableLayout: "fixed", width: "100%", fontSize: isMobile ? "0.68rem" : "0.85rem" }}
                >
                  <thead style={{ backgroundColor: "#1e293b", color: "#fff" }}>
                    <tr>
                      <th style={{ backgroundColor: "#1e293b", color: "#fff", padding: isMobile ? "6px 2px" : "8px 12px", textAlign: "left", width: isMobile ? "30%" : "30%" }}>
                        Objetivo
                      </th>
                      <th style={{ backgroundColor: "#1e293b", color: "#fff", padding: isMobile ? "6px 2px" : "8px", width: isMobile ? "16%" : "17%" }}>
                        {isMobile ? "Teór." : "Teórico"}
                      </th>
                      <th style={{ backgroundColor: "#1e293b", color: "#fff", padding: isMobile ? "6px 2px" : "8px", width: isMobile ? "16%" : "17%" }}>
                        Hecho
                      </th>
                      <th style={{ backgroundColor: "#1e293b", color: "#fff", padding: isMobile ? "6px 2px" : "8px", width: isMobile ? "18%" : "18%" }}>
                        {isMobile ? "Dif." : "Diferencia"}
                      </th>
                      <th style={{ backgroundColor: "#1e293b", color: "#fff", padding: isMobile ? "6px 2px" : "8px", width: isMobile ? "20%" : "18%" }}>
                        {isMobile ? "Cumpl." : "% Cumplido"}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filasGeneral.map((r, idx) => {
                      const dif = r.hecho - r.teorico;
                      const pct = r.teorico > 0 ? Math.round((r.hecho / r.teorico) * 100) : 0;
                      return (
                        <tr key={r.tipo} style={{ backgroundColor: idx % 2 === 0 ? "#ffffff" : "#f8fafc" }}>
                          <td className="text-start" style={{ padding: isMobile ? "6px 3px" : "8px 12px" }}>
                            <div className="d-flex align-items-center gap-1.5">
                              <i className={`bi ${r.icono} d-none d-sm-inline`} style={{ color: r.color, fontSize: "0.85rem" }}></i>
                              <div>
                                <div className="fw-bold text-dark" style={{ fontSize: isMobile ? "0.68rem" : "0.85rem" }}>
                                  {isMobile ? (r.tipo === "Visitas a campo" ? "Campo" : r.tipo === "Visitas a talleres" ? "Talleres" : r.tipo) : r.tipo}
                                </div>
                                <div className="text-muted small d-none d-md-block" style={{ fontSize: "0.72rem" }}>
                                  {r.descripcion}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="fw-bold text-secondary" style={{ padding: isMobile ? "6px 2px" : "8px" }}>
                            {r.teorico}
                          </td>
                          <td className="fw-bold" style={{ color: r.hecho > 0 ? "#0f172a" : "#94a3b8", padding: isMobile ? "6px 2px" : "8px" }}>
                            {r.hecho}
                          </td>
                          <td style={{ padding: isMobile ? "6px 2px" : "8px" }}>
                            <span
                              className={`badge ${
                                dif >= 0
                                  ? "bg-success-subtle text-success border border-success-subtle"
                                  : "bg-danger-subtle text-danger border border-danger-subtle"
                              }`}
                              style={{ fontSize: isMobile ? "0.64rem" : "0.76rem", padding: isMobile ? "2px 4px" : "4px 8px" }}
                            >
                              {dif > 0 ? `+${dif}` : dif}
                            </span>
                          </td>
                          <td style={{ padding: isMobile ? "6px 2px" : "8px" }}>
                            <span
                              className="fw-bold"
                              style={{
                                color: pct >= 100 ? "#15803d" : pct >= 50 ? "#d97706" : "#dc2626",
                                fontSize: isMobile ? "0.68rem" : "0.8rem",
                              }}
                            >
                              {pct}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    <tr style={{ backgroundColor: "#f1f5f9" }}>
                      <td className="fw-bold text-start text-dark" style={{ padding: isMobile ? "6px 3px" : "8px 12px", fontSize: isMobile ? "0.68rem" : "0.85rem" }}>
                        Total
                      </td>
                      <td className="fw-bold text-secondary" style={{ padding: isMobile ? "6px 2px" : "8px" }}>
                        {totalTeorico}
                      </td>
                      <td className="fw-bold text-primary" style={{ padding: isMobile ? "6px 2px" : "8px" }}>
                        {totalHecho}
                      </td>
                      <td style={{ padding: isMobile ? "6px 2px" : "8px" }}>
                        {(() => {
                          const totalDif = totalHecho - totalTeorico;
                          return (
                            <span
                              className={`badge ${totalDif >= 0 ? "bg-success text-white" : "bg-danger text-white"}`}
                              style={{ fontSize: isMobile ? "0.64rem" : "0.76rem", padding: isMobile ? "2px 4px" : "4px 8px" }}
                            >
                              {totalDif > 0 ? `+${totalDif}` : totalDif}
                            </span>
                          );
                        })()}
                      </td>
                      <td style={{ padding: isMobile ? "6px 2px" : "8px" }}>
                        <span className="fw-bold" style={{ color: "#1e293b", fontSize: isMobile ? "0.68rem" : "0.82rem" }}>
                          {totalTeorico > 0 ? `${Math.round((totalHecho / totalTeorico) * 100)}%` : "0%"}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tabla: Visitas por Grupo */}
          {tabResumen === "grupos" && (
            <div className="table-responsive rounded-3 border" style={{ borderColor: "#cbd5e1" }}>
              <table className="table table-hover align-middle text-center mb-0" style={{ fontSize: isMobile ? "0.78rem" : "0.86rem" }}>
                <thead style={{ backgroundColor: "#1e293b", color: "#fff" }}>
                  <tr>
                    <th style={{ backgroundColor: "#1e293b", color: "#fff", padding: "8px 12px", textAlign: "left" }}>Grupo</th>
                    <th style={{ backgroundColor: "#1e293b", color: "#fff", padding: "8px", width: "120px" }}>Visitas</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const listaGruposFinal = [
                      ...GRUPOS.map((g) => g.label),
                      ...Object.keys(counts).filter((k) => !GRUPOS.some((g) => g.label === k)),
                    ];
                    return listaGruposFinal.map((grupoLabel, idx) => {
                      const count = counts[grupoLabel] || 0;
                      return (
                        <tr key={grupoLabel} style={{ backgroundColor: idx % 2 === 0 ? "#ffffff" : "#f8fafc" }}>
                          <td className="text-start ps-3">
                            <div className="d-flex align-items-center gap-2">
                              <span
                                style={{
                                  width: "12px",
                                  height: "12px",
                                  borderRadius: "3px",
                                  backgroundColor: colorGrupo(grupoLabel),
                                  flexShrink: 0,
                                }}
                              />
                              <span className="fw-semibold text-dark">{grupoLabel}</span>
                            </div>
                          </td>
                          <td className="fw-bold" style={{ color: count > 0 ? "#1e293b" : "#94a3b8" }}>
                            {count}
                          </td>
                        </tr>
                      );
                    });
                  })()}
                  <tr style={{ backgroundColor: "#f1f5f9" }}>
                    <td className="fw-bold text-start ps-3">Total de Visitas</td>
                    <td className="fw-bold text-primary fs-6">
                      {Object.values(counts).reduce((a, b) => a + b, 0)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Tabla: Visitas por Centro de Costo */}
          {tabResumen === "cc" && (
            <div className="table-responsive rounded-3 border" style={{ borderColor: "#cbd5e1" }}>
              <table className="table table-hover align-middle text-center mb-0" style={{ fontSize: isMobile ? "0.78rem" : "0.86rem" }}>
                <thead style={{ backgroundColor: "#1e293b", color: "#fff" }}>
                  <tr>
                    <th style={{ backgroundColor: "#1e293b", color: "#fff", padding: "8px 12px", textAlign: "left" }}>Centro de Costo (CC)</th>
                    <th style={{ backgroundColor: "#1e293b", color: "#fff", padding: "8px", width: "120px" }}>Visitas</th>
                  </tr>
                </thead>
                <tbody>
                  {ccsOrdenados.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="text-muted py-4">No hay visitas registradas con CC en este mes</td>
                    </tr>
                  ) : (
                    ccsOrdenados.map((cc, idx) => {
                      const count = countsCC[cc] || 0;
                      const tracInfo = tractores.find((t) => t.cc === cc);
                      return (
                        <tr key={cc} style={{ backgroundColor: idx % 2 === 0 ? "#ffffff" : "#f8fafc" }}>
                          <td className="text-start ps-3">
                            <div className="d-flex align-items-center gap-2">
                              <span className="fw-bold text-dark">{cc}</span>
                              {tracInfo?.descripcion && (
                                <span className="text-muted small">— {tracInfo.descripcion}</span>
                              )}
                            </div>
                          </td>
                          <td className="fw-bold" style={{ color: count > 0 ? "#1e293b" : "#94a3b8" }}>
                            {count}
                          </td>
                        </tr>
                      );
                    })
                  )}
                  <tr style={{ backgroundColor: "#f1f5f9" }}>
                    <td className="fw-bold text-start ps-3">Total de Visitas</td>
                    <td className="fw-bold text-primary fs-6">
                      {Object.values(countsCC).reduce((a, b) => a + b, 0)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer className="bg-light border-0 py-2.5 px-4">
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={() => setMostrarResumen(false)}
            className="rounded-3 px-3"
            style={{ fontSize: "0.84rem" }}
          >
            Cerrar
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal: Selección de CCs con Tildes */}
      <Modal show={ccModalOpen} onHide={handleCancelarCC} centered size="md" contentClassName="border-0 shadow-lg rounded-4 overflow-hidden">
        <Modal.Header
          closeButton
          closeVariant="white"
          style={{ backgroundColor: "#1e293b", color: "#fff" }}
        >
          <Modal.Title className="fs-6 fw-bold d-flex align-items-center gap-2">
            <i className="bi bi-check2-square text-info"></i>
            <span>Centros de Costo — {form.grupo}</span>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ maxHeight: "55vh", overflowY: "auto" }} className="p-3">
          {(() => {
            const gNum = getGruppoNumFromLabel(form.grupo);
            const tractoresDelGrupo = tractores.filter(
              (t) => gNum === null || (t.gruppo ?? 6) === gNum
            );
            const opcionesCCModal = [
              { cc: "Ninguno", descripcion: "Sin CC asignado" },
              ...tractoresDelGrupo,
            ];

            return (
              <div className="d-flex flex-column gap-2">
                <div className="d-flex justify-content-between align-items-center mb-1 px-1">
                  <small className="text-muted">Marcar con tilde los CCs deseados:</small>
                  <div className="d-flex gap-2">
                    <Button
                      variant="link"
                      size="sm"
                      className="p-0 text-decoration-none small"
                      onClick={() => setCcSeleccionadosTemp(opcionesCCModal.map((t) => t.cc))}
                    >
                      Marcar todos
                    </Button>
                    <span className="text-muted small">|</span>
                    <Button
                      variant="link"
                      size="sm"
                      className="p-0 text-decoration-none text-danger small"
                      onClick={() => setCcSeleccionadosTemp([])}
                    >
                      Desmarcar
                    </Button>
                  </div>
                </div>
                {opcionesCCModal.map((t) => {
                  const isChecked = ccSeleccionadosTemp.includes(t.cc);
                  return (
                    <div
                      key={t._id || t.cc}
                      className={`p-2 px-3 rounded-3 border d-flex align-items-center justify-content-between ${
                        isChecked ? "border-success bg-success-subtle" : "bg-white"
                      }`}
                      style={{ cursor: "pointer", transition: "all 0.15s ease" }}
                      onClick={() => {
                        setCcSeleccionadosTemp((prev) =>
                          prev.includes(t.cc) ? prev.filter((c) => c !== t.cc) : [...prev, t.cc]
                        );
                      }}
                    >
                      <div className="d-flex align-items-center gap-2.5">
                        <Form.Check
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          style={{ pointerEvents: "none" }}
                        />
                        <div>
                          <span
                            className="fw-bold"
                            style={{ color: t.cc === "Ninguno" ? "#64748b" : "#0f172a", fontSize: "0.9rem" }}
                          >
                            {t.cc}
                          </span>
                          {t.descripcion && (
                            <span className="text-muted ms-2 small">— {t.descripcion}</span>
                          )}
                        </div>
                      </div>
                      {isChecked && <i className="bi bi-check-circle-fill text-success"></i>}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </Modal.Body>
        <Modal.Footer className="bg-light border-0 py-2.5 px-4">
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={handleCancelarCC}
            className="rounded-3 px-3"
            style={{ fontSize: "0.84rem" }}
          >
            Cancelar
          </Button>
          <Button
            variant="success"
            size="sm"
            style={{
              backgroundColor: ccSeleccionadosTemp.length > 0 ? "#15803d" : "#94a3b8",
              borderColor: ccSeleccionadosTemp.length > 0 ? "#15803d" : "#94a3b8",
              fontSize: "0.84rem",
              fontWeight: 600,
              cursor: ccSeleccionadosTemp.length > 0 ? "pointer" : "not-allowed",
            }}
            disabled={ccSeleccionadosTemp.length === 0}
            onClick={() => {
              if (ccSeleccionadosTemp.length === 0) return;
              setForm((f) => ({ ...f, cc: ccSeleccionadosTemp.join(", ") }));
              setCcModalOpen(false);
            }}
          >
            <i className="bi bi-check-lg me-1"></i>
            {ccSeleccionadosTemp.length > 0
              ? `Confirmar (${ccSeleccionadosTemp.length})`
              : "Seleccionar al menos 1 CC"}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

export default Visitas;
