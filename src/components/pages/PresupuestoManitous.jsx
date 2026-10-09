import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Container, Table, Button, Modal } from "react-bootstrap";
import { api } from "../../services/api";
import { cosechaDeParam } from "../../utils/cosechas";
import { SISTEMAS_MANITOU, UNIDADES_MANITOU } from "../../utils/sistemasManitou";
import NavbarSanPablo from "../shared/NavbarSanPablo";
import TractorIcon from "../shared/TractorIcon";
import { th as thBase, td, tdCentro, thGrande, tdGrande } from "../compras/formato";
import { Raya } from "../compras/estilos";
import { opcionElegida } from "../compras/precioElegido";
import { exportarPlanilla } from "../../helpers/excel";
import { fmtPresupuesto } from "../compras/presupuestos";
import { fmtNro } from "../compras/nroPedido";

const COLOR = "#1e293b";
const VERDE = "#047857";
const ROJO = "#dc2626";
const GRIS = "#64748b";
const th = { ...thBase, backgroundColor: COLOR };
const thCentro = { ...th, textAlign: "center" };
const tdImporte = { ...tdCentro, whiteSpace: "nowrap" };
// La tabla principal, más grande que la del detalle (formato-tablas).
// Un poco más chica que thGrande/tdGrande.
const thG = { ...thGrande, backgroundColor: COLOR, fontSize: "0.76rem", padding: "7px 10px" };
const thGCentro = { ...thG, textAlign: "center" };
const tdG = { ...tdGrande, fontSize: "0.82rem", padding: "6px 10px" };
const tdGImporte = { ...tdG, textAlign: "center", whiteSpace: "nowrap" };
// La columna Total, destacada: encabezado verde y celdas con fondo.
const thTotal = { ...thGCentro, backgroundColor: VERDE };
const tdTotal = { ...tdGImporte, backgroundColor: "#e8f5ee", color: VERDE, fontWeight: 700 };
// La línea negra antes de los totales (Total, o Presupuestado en la
// comparación) es la clase col-corte de index.css: el borde de la tabla va
// con !important y un estilo en línea no le gana.

const fmtPrecio = (v) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 }).format(v);

// Lo que suma un presupuesto: el precio del proveedor que vale por la
// cantidad que el repuesto tiene hoy en su Manitou (`cantActual`, del back;
// la del presupuesto si el repuesto ya no está), solo si el analista ya lo
// cotizó. Sin IVA, como cotiza.
const importeDe = (p) => {
  if (p.estado !== "Cotizado") return null;
  const precio = opcionElegida(p)?.precio;
  return precio ? precio * (p.cantActual ?? p.cant ?? 0) : null;
};

// Suma por sistema y por Manitou: { [sistema]: { [unidad]: importe } }.
const sumar = (lista, importe, unidad) => {
  const tabla = {};
  for (const x of lista) {
    const v = importe(x);
    if (!v) continue;
    tabla[x.sistema] ??= {};
    tabla[x.sistema][unidad(x)] = (tabla[x.sistema][unidad(x)] || 0) + v;
  }
  const celda = (s, u) => tabla[s]?.[u] ?? 0;
  const porSistema = (s) => UNIDADES_MANITOU.reduce((acc, u) => acc + celda(s, u), 0);
  const porUnidad = (u) => SISTEMAS_MANITOU.reduce((acc, s) => acc + celda(s.id, u), 0);
  const total = SISTEMAS_MANITOU.reduce((acc, s) => acc + porSistema(s.id), 0);
  return { celda, porSistema, porUnidad, total };
};

/**
 * Manitous › General › Presupuesto (09/10/2026): lo cotizado en Presupuestos
 * reparaciones, sistema por sistema (filas) y Manitou por Manitou (columnas),
 * con los totales. Solo suma lo cotizado; lo que espera cotización se cuenta
 * aparte.
 *
 * Con el botón REAL, la comparación: lo presupuestado contra lo gastado de
 * verdad, que sale de las órdenes de pago de los repuestos pedidos desde las
 * Manitou (también sin IVA). Cada número se toca y abre su detalle.
 */
export default function PresupuestoManitous() {
  const { cosecha: param } = useParams();
  const cosecha = cosechaDeParam(param);
  const [presupuestos, setPresupuestos] = useState([]);
  const [reales, setReales] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [vista, setVista] = useState("presupuesto"); // "presupuesto" | "real"
  // El detalle de un número tocado: { tipo: "presupuesto" | "real", titulo, sistema?, unidad? }.
  const [detalle, setDetalle] = useState(null);
  const [proveedores, setProveedores] = useState([]);

  useEffect(() => {
    api
      .get("/proveedores")
      .then((data) => setProveedores(Array.isArray(data) ? data : []))
      .catch(() => setProveedores([]));
  }, []);
  const nombreProveedor = (id) => proveedores.find((p) => p._id === id)?.razonsocial || "";

  useEffect(() => {
    Promise.all([
      api.get("/presupuestos-reparaciones").catch(() => []),
      api.get(`/ingresos-sanpablo/chequeos/real?cosecha=${cosecha}`).catch(() => []),
    ])
      .then(([pres, real]) => {
        setPresupuestos((Array.isArray(pres) ? pres : []).filter((p) => p.cosecha === cosecha));
        setReales(Array.isArray(real) ? real : []);
      })
      .finally(() => setCargando(false));
  }, [cosecha]);

  const pres = sumar(presupuestos, importeDe, (p) => p.cc);
  const real = sumar(reales, (r) => r.total, (r) => r.unidad);
  const sinCotizar = presupuestos.filter((p) => importeDe(p) === null).length;
  const esReal = vista === "real";

  // Cada importe se toca y abre su detalle: lo que lo forma.
  const tocable = (v, d, tipo) =>
    v ? (
      <button
        type="button"
        onClick={() => setDetalle({ ...d, tipo })}
        className="btn btn-link p-0 text-decoration-none"
        style={{ color: "inherit", fontWeight: "inherit", fontSize: "inherit" }}
        title="Ver el detalle"
      >
        {fmtPrecio(v)}
      </button>
    ) : (
      <Raya />
    );
  const importe = (v, d) => tocable(v, d, "presupuesto");
  const importeReal = (v, d) => tocable(v, d, "real");

  // Presupuestado menos gastado: positivo sobra (verde), negativo se pasó (rojo).
  const diferencia = (p, r) => {
    if (!p && !r) return <Raya />;
    const d = p - r;
    return <span style={{ color: d < 0 ? ROJO : VERDE }}>{`${d > 0 ? "+" : ""}${fmtPrecio(d)}`}</span>;
  };

  // En la comparación, cada Manitou muestra las dos cifras: presupuestado
  // arriba (gris) y real abajo (rojo si se pasó).
  const celdaComparada = (p, r, d) =>
    !p && !r ? (
      <Raya />
    ) : (
      <div className="d-flex flex-column align-items-center" style={{ lineHeight: 1.3 }}>
        <span style={{ color: GRIS, fontSize: "0.72rem" }}>P {importe(p, d)}</span>
        <span style={{ fontWeight: 700, color: r > p ? ROJO : COLOR }}>R {importeReal(r, d)}</span>
      </div>
    );

  const tituloSistema = (id) => SISTEMAS_MANITOU.find((s) => s.id === id)?.titulo || id;
  const ordenSistema = (id) => SISTEMAS_MANITOU.findIndex((s) => s.id === id);
  const enDetalle = (sistema, unidad) =>
    (!detalle.sistema || sistema === detalle.sistema) && (!detalle.unidad || unidad === detalle.unidad);

  const lineasPresupuesto =
    detalle?.tipo === "presupuesto"
      ? presupuestos
          .filter((p) => importeDe(p) !== null && UNIDADES_MANITOU.includes(p.cc) && enDetalle(p.sistema, p.cc))
          .sort((a, b) => a.cc.localeCompare(b.cc) || ordenSistema(a.sistema) - ordenSistema(b.sistema) || a.nro - b.nro)
      : [];
  // En el real, un renglón por ítem de OP; un pedido sin OP todavía, uno solo.
  const lineasReal =
    detalle?.tipo === "real"
      ? reales
          .filter((r) => enDetalle(r.sistema, r.unidad))
          .sort((a, b) => a.unidad.localeCompare(b.unidad) || ordenSistema(a.sistema) - ordenSistema(b.sistema))
          .flatMap((r) => (r.ops.length ? r.ops.map((o, i) => ({ r, o, clave: `${r.repuesto}-${i}` })) : [{ r, o: null, clave: r.repuesto }]))
      : [];
  const totalDetalle =
    detalle?.tipo === "real"
      ? lineasReal.reduce((acc, l) => acc + (l.o?.total || 0), 0)
      : lineasPresupuesto.reduce((acc, p) => acc + importeDe(p), 0);

  const exportarExcel = () =>
    esReal
      ? exportarPlanilla({
          titulo: `Reparaciones San Pablo — Manitous: presupuestado vs. real — Cosecha ${param}`,
          columnas: [
            { titulo: "Sistema", ancho: 22 },
            ...UNIDADES_MANITOU.flatMap((u) => [
              { titulo: `${u} presup.`, ancho: 15, moneda: true },
              { titulo: `${u} real`, ancho: 15, moneda: true },
            ]),
            { titulo: "Presupuestado", ancho: 17, moneda: true },
            { titulo: "Real", ancho: 17, moneda: true },
            { titulo: "Diferencia", ancho: 17, moneda: true },
          ],
          filas: [
            ...SISTEMAS_MANITOU.map((s) => [
              s.titulo,
              ...UNIDADES_MANITOU.flatMap((u) => [pres.celda(s.id, u), real.celda(s.id, u)]),
              pres.porSistema(s.id),
              real.porSistema(s.id),
              pres.porSistema(s.id) - real.porSistema(s.id),
            ]),
            [
              "TOTAL",
              ...UNIDADES_MANITOU.flatMap((u) => [pres.porUnidad(u), real.porUnidad(u)]),
              pres.total,
              real.total,
              pres.total - real.total,
            ],
          ],
          hoja: "Comparación",
          archivo: `sanpablo_manitous_presupuesto_vs_real_${param}_${new Date().toISOString().slice(0, 10)}.xlsx`,
        })
      : exportarPlanilla({
          titulo: `Reparaciones San Pablo — Presupuesto Manitous — Cosecha ${param}`,
          columnas: [
            { titulo: "Sistema", ancho: 22 },
            ...UNIDADES_MANITOU.map((u) => ({ titulo: `Manitou ${u}`, ancho: 16, moneda: true })),
            { titulo: "Total", ancho: 18, moneda: true },
          ],
          filas: [
            ...SISTEMAS_MANITOU.map((s) => [s.titulo, ...UNIDADES_MANITOU.map((u) => pres.celda(s.id, u)), pres.porSistema(s.id)]),
            ["TOTAL", ...UNIDADES_MANITOU.map(pres.porUnidad), pres.total],
          ],
          hoja: "Presupuesto",
          archivo: `sanpablo_manitous_presupuesto_${param}_${new Date().toISOString().slice(0, 10)}.xlsx`,
        });

  const columnasTabla = UNIDADES_MANITOU.length + (esReal ? 4 : 2);

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#f8f9fa",
        height: "100%",
        maxHeight: "100vh",
        overflow: "hidden",
      }}
    >
      <NavbarSanPablo
        icono={<i className="bi bi-currency-dollar"></i>}
        volverA={`/reparaciones/sanpablo/${param}/manitous/general`}
      />

      <Container
        fluid
        className="px-3 py-3 d-flex flex-column flex-grow-1"
        style={{ maxWidth: esReal ? "1200px" : "1050px", width: "100%", margin: "0 auto", overflow: "hidden" }}
      >
        <div className="d-flex align-items-center gap-3 mb-3 pb-2 flex-wrap" style={{ borderBottom: `3px solid ${VERDE}` }}>
          <div
            className="d-flex align-items-center justify-content-center"
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "12px",
              background: "linear-gradient(135deg, #064e3b 0%, #047857 100%)",
              boxShadow: "0 6px 16px rgba(4, 120, 87, 0.35)",
              flexShrink: 0,
            }}
          >
            <TractorIcon size="1.6rem" color="#fff" />
          </div>
          <div>
            <div className="fw-bold" style={{ fontSize: "1.5rem", lineHeight: 1, color: VERDE, letterSpacing: "0.02em" }}>
              {esReal ? (
                <>
                  MANITOU · PRESUPUESTADO <span style={{ textTransform: "none" }}>vs.</span> REAL
                </>
              ) : (
                "MANITOU · PRESUPUESTO"
              )}
            </div>
            <div className="text-secondary fw-semibold" style={{ fontSize: "0.82rem" }}>
              {esReal ? "Lo cotizado contra lo pagado en las OP, sin IVA" : "Lo cotizado, sin IVA"} · Cosecha {param}
            </div>
          </div>
          <div className="ms-auto" />
          {/* REAL pasa a la comparación con lo gastado; ahí el botón dice
              PRESUPUESTADO y vuelve al presupuesto. */}
          <Button
            size="sm"
            onClick={() => setVista(esReal ? "presupuesto" : "real")}
            disabled={cargando}
            className="rounded-3 px-3 d-flex align-items-center gap-2"
            style={{
              backgroundColor: "#fff",
              borderColor: COLOR,
              color: COLOR,
              fontSize: "0.78rem",
              height: "30px",
              fontWeight: 700,
            }}
            title={esReal ? "Volver al presupuesto" : "Comparar con lo gastado en las órdenes de pago"}
          >
            <i className={`bi ${esReal ? "bi-currency-dollar" : "bi-receipt"}`}></i>
            <span>{esReal ? "PRESUPUESTADO" : "REAL"}</span>
          </Button>
          <Button
            size="sm"
            onClick={exportarExcel}
            disabled={cargando}
            className="rounded-3 px-3 d-flex align-items-center gap-2"
            style={{ backgroundColor: "#15803d", borderColor: "#15803d", fontSize: "0.78rem", height: "30px", fontWeight: 600 }}
            title="Exportar a Excel"
          >
            <i className="bi bi-file-earmark-excel-fill"></i>
            <span>Excel</span>
          </Button>
        </div>

        <div
          className="shadow-sm rounded-3 bg-white"
          style={{ flex: "0 1 auto", minHeight: 0, maxWidth: "100%", overflow: "auto", border: "1px solid #cbd5e1" }}
        >
          <Table className="mb-0 tabla-informe" style={{ width: "100%" }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 1 }}>
              <tr>
                <th style={thG}>Sistema</th>
                {UNIDADES_MANITOU.map((u) => (
                  <th key={u} style={thGCentro}>
                    Manitou {u}
                  </th>
                ))}
                {esReal ? (
                  <>
                    <th className="col-corte" style={thGCentro}>Presupuestado</th>
                    <th style={thTotal}>Real</th>
                    <th style={thGCentro}>Diferencia</th>
                  </>
                ) : (
                  <th className="col-corte" style={thTotal}>Total</th>
                )}
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr>
                  <td colSpan={columnasTabla} className="text-center text-muted py-4" style={td}>
                    Cargando…
                  </td>
                </tr>
              ) : (
                <>
                  {SISTEMAS_MANITOU.map((s) => {
                    const dSistema = { titulo: `${s.titulo} · Todas las Manitous`, sistema: s.id };
                    return (
                      <tr key={s.id}>
                        <td style={{ ...tdG, fontWeight: 600 }}>{s.titulo}</td>
                        {UNIDADES_MANITOU.map((u) => {
                          const d = { titulo: `${s.titulo} · Manitou ${u}`, sistema: s.id, unidad: u };
                          return (
                            <td key={u} style={tdGImporte}>
                              {esReal ? celdaComparada(pres.celda(s.id, u), real.celda(s.id, u), d) : importe(pres.celda(s.id, u), d)}
                            </td>
                          );
                        })}
                        {esReal ? (
                          <>
                            <td className="col-corte" style={{ ...tdGImporte, color: GRIS }}>{importe(pres.porSistema(s.id), dSistema)}</td>
                            <td style={tdTotal}>{importeReal(real.porSistema(s.id), dSistema)}</td>
                            <td style={{ ...tdGImporte, fontWeight: 700 }}>
                              {diferencia(pres.porSistema(s.id), real.porSistema(s.id))}
                            </td>
                          </>
                        ) : (
                          <td className="col-corte" style={tdTotal}>{importe(pres.porSistema(s.id), dSistema)}</td>
                        )}
                      </tr>
                    );
                  })}
                  <tr className="fila-total">
                    <td style={{ ...tdG, fontWeight: 700, color: COLOR }}>TOTAL</td>
                    {UNIDADES_MANITOU.map((u) => {
                      const d = { titulo: `Manitou ${u} · Todos los sistemas`, unidad: u };
                      return (
                        <td key={u} style={{ ...tdGImporte, fontWeight: 700, color: COLOR }}>
                          {esReal ? celdaComparada(pres.porUnidad(u), real.porUnidad(u), d) : importe(pres.porUnidad(u), d)}
                        </td>
                      );
                    })}
                    {esReal ? (
                      <>
                        <td className="col-corte" style={{ ...tdGImporte, fontWeight: 700, color: GRIS }}>
                          {pres.total ? importe(pres.total, { titulo: "Todas las Manitous" }) : fmtPrecio(0)}
                        </td>
                        <td style={{ ...tdTotal, backgroundColor: "#d1fae5" }}>
                          {real.total ? importeReal(real.total, { titulo: "Todas las Manitous" }) : fmtPrecio(0)}
                        </td>
                        <td style={{ ...tdGImporte, fontWeight: 700 }}>{diferencia(pres.total, real.total)}</td>
                      </>
                    ) : (
                      <td className="col-corte" style={{ ...tdTotal, backgroundColor: "#d1fae5" }}>
                        {pres.total ? importe(pres.total, { titulo: "Todas las Manitous" }) : fmtPrecio(0)}
                      </td>
                    )}
                  </tr>
                </>
              )}
            </tbody>
          </Table>
        </div>

        {!cargando && (
          <div className="text-muted mt-2" style={{ fontSize: "0.76rem" }}>
            {esReal
              ? "P: presupuestado (lo cotizado). R: real (lo pagado en las órdenes de pago de los repuestos pedidos desde las Manitou). Diferencia en rojo: se gastó más de lo presupuestado."
              : sinCotizar > 0 &&
                (sinCotizar === 1
                  ? "1 repuesto mandado a cotizar todavía no tiene precio: no suma."
                  : `${sinCotizar} repuestos mandados a cotizar todavía no tienen precio: no suman.`)}
          </div>
        )}
      </Container>

      {/* El detalle de un número: lo que lo forma, cotizado o pagado. */}
      <Modal
        show={Boolean(detalle)}
        onHide={() => setDetalle(null)}
        centered
        scrollable
        size="xl"
        contentClassName="border-0 shadow-lg rounded-4"
      >
        <Modal.Header
          closeButton
          closeVariant="white"
          style={{
            backgroundColor: COLOR,
            color: "#fff",
            borderTopLeftRadius: "1rem",
            borderTopRightRadius: "1rem",
            borderBottom: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <Modal.Title className="fs-6 fw-normal d-flex align-items-center gap-2 text-white">
            <i className={`bi ${detalle?.tipo === "real" ? "bi-receipt" : "bi-currency-dollar"}`}></i>
            <span>
              {detalle?.tipo === "real" ? "Real" : "Presupuesto"} · {detalle?.titulo}
            </span>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-3">
          <div className="rounded-3 bg-white" style={{ border: "1px solid #cbd5e1", overflowX: "auto" }}>
            {detalle?.tipo === "real" ? (
              <Table className="mb-0 tabla-informe" style={{ width: "100%" }}>
                <thead>
                  <tr>
                    <th style={thCentro}>Pedido</th>
                    {!detalle?.unidad && <th style={thCentro}>Manitou</th>}
                    {!detalle?.sistema && <th style={th}>Sistema</th>}
                    <th style={th}>Ítem</th>
                    <th style={th}>Repuesto</th>
                    <th style={thCentro}>OP</th>
                    <th style={th}>Proveedor</th>
                    <th style={thCentro}>Cant.</th>
                    <th style={thCentro}>Precio unit.</th>
                    <th style={thCentro}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {lineasReal.map(({ r, o, clave }) => (
                    <tr key={clave}>
                      <td style={{ ...tdCentro, whiteSpace: "nowrap" }}>
                        {r.nro_pedido ? fmtNro(r.nro_pedido, "sanpablo", "reparaciones") : <Raya />}
                      </td>
                      {!detalle?.unidad && <td style={tdCentro}>{r.unidad}</td>}
                      {!detalle?.sistema && <td style={td}>{tituloSistema(r.sistema)}</td>}
                      <td style={td}>{r.item || <Raya />}</td>
                      <td style={{ ...td, fontWeight: 600 }}>{r.nombre_repuesto}</td>
                      <td style={{ ...tdCentro, whiteSpace: "nowrap" }}>
                        {o?.op || <span className="text-muted">Sin OP todavía</span>}
                      </td>
                      <td style={td}>{(o && nombreProveedor(o.proveedor)) || <Raya />}</td>
                      <td style={tdCentro}>{o ? `${o.cant ?? ""} ${r.unidad_medida || ""}` : <Raya />}</td>
                      <td style={tdImporte}>{o?.precio_unitario ? fmtPrecio(o.precio_unitario) : <Raya />}</td>
                      <td style={{ ...tdImporte, fontWeight: 700 }}>{o?.total ? fmtPrecio(o.total) : <Raya />}</td>
                    </tr>
                  ))}
                  <tr className="fila-total">
                    <td colSpan={10 - (detalle?.unidad ? 1 : 0) - (detalle?.sistema ? 1 : 0) - 1} style={{ ...td, fontWeight: 700, color: COLOR }}>
                      TOTAL
                    </td>
                    <td style={{ ...tdImporte, fontWeight: 700, color: COLOR }}>{fmtPrecio(totalDetalle)}</td>
                  </tr>
                </tbody>
              </Table>
            ) : (
              <Table className="mb-0 tabla-informe" style={{ width: "100%" }}>
                <thead>
                  <tr>
                    <th style={thCentro}>N°</th>
                    {!detalle?.unidad && <th style={thCentro}>Manitou</th>}
                    {!detalle?.sistema && <th style={th}>Sistema</th>}
                    <th style={th}>Ítem</th>
                    <th style={th}>Repuesto</th>
                    <th style={thCentro}>Cant.</th>
                    <th style={th}>Proveedor</th>
                    <th style={thCentro}>Precio unit.</th>
                    <th style={thCentro}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {lineasPresupuesto.map((p) => (
                    <tr key={p._id}>
                      <td style={{ ...tdCentro, whiteSpace: "nowrap" }}>{fmtPresupuesto(p.nro)}</td>
                      {!detalle?.unidad && <td style={tdCentro}>{p.cc}</td>}
                      {!detalle?.sistema && <td style={td}>{tituloSistema(p.sistema)}</td>}
                      <td style={td}>{p.item || <Raya />}</td>
                      <td style={{ ...td, fontWeight: 600 }}>{p.nombre_repuesto}</td>
                      <td style={tdCentro}>
                        {p.cantActual ?? p.cant} {p.unidad}
                      </td>
                      <td style={td}>{nombreProveedor(opcionElegida(p)?.proveedor) || <Raya />}</td>
                      <td style={tdImporte}>{fmtPrecio(opcionElegida(p).precio)}</td>
                      <td style={{ ...tdImporte, fontWeight: 700 }}>{fmtPrecio(importeDe(p))}</td>
                    </tr>
                  ))}
                  <tr className="fila-total">
                    <td colSpan={9 - (detalle?.unidad ? 1 : 0) - (detalle?.sistema ? 1 : 0) - 1} style={{ ...td, fontWeight: 700, color: COLOR }}>
                      TOTAL
                    </td>
                    <td style={{ ...tdImporte, fontWeight: 700, color: COLOR }}>{fmtPrecio(totalDetalle)}</td>
                  </tr>
                </tbody>
              </Table>
            )}
          </div>
          <div className="mt-2 text-muted" style={{ fontSize: "0.7rem" }}>
            {detalle?.tipo === "real"
              ? "Sin IVA. Lo pagado en las órdenes de pago; un pedido comprado en partes tiene un renglón por OP."
              : "Sin IVA. Precio del proveedor elegido por el analista, por la cantidad de hoy en la Manitou."}
          </div>
        </Modal.Body>
      </Modal>
    </div>
  );
}
