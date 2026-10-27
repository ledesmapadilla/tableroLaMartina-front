import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Container } from 'react-bootstrap'
import Swal from 'sweetalert2'
import { api } from '../../services/api'
import { usePermisos } from '../../context/permisos'
import { litros } from './aceites'
import { API_GASOIL, CAMPOS_GASOIL, TIPOS_GASOIL, camposVisibles, tiposDeCampo } from './camposGasoil'
import { useAuth } from '../../context/AuthContext'

/**
 * Compras › Gasoil › Auditorías › Gráfico (27/10/2026): el resultado de cada
 * auditoría en el tiempo, un gráfico por campo. Cada auditoría es un grupo de
 * barras alrededor del cero: arriba sobra, abajo falta. En San Pablo van dos
 * barras por auditoría, Común e Infinia, cada una de su color.
 *
 * Lleva los resultados, así que la ve quien los ve en Auditorías (Ver y
 * Editar en Gasoil).
 */
const COLOR = '#334155'
const GRILLA = '#e2e8f0'
const TEXTO = '#475569'
const TEXTO_SUAVE = '#94a3b8'
// El color de cada tanque en el gráfico: el Común, el del campo; el Infinia,
// el fucsia de la palabra en Auditorías. Verde y fucsia pasan el control de
// daltonismo (validate_palette, 27/10/2026).
const COLOR_INFINIA = '#c026d3'
const colorSerie = (campo, tipo) => (tipo === 'infinia' ? COLOR_INFINIA : campo.color)

const fecha = (f) => (f ? new Date(f).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '')
const fechaCorta = (f) => (f ? new Date(f).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) : '')
const textoResultado = (n) => (n === 0 ? 'Justo' : `${n > 0 ? 'Sobran' : 'Faltan'} ${litros(Math.abs(n))} lts`)
const desviacion = (r) => {
  if (!r.teorico) return ''
  const pct = (r.resultado / Math.abs(r.teorico)) * 100
  return `${pct > 0 ? '+' : ''}${pct.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
}

// El gráfico de un campo. `auditorias`: las que tienen algún resultado en el
// campo, de la más vieja a la más nueva; `tipos`: las series (Común e
// Infinia, o solo Común).
function GraficoCampo({ campo, tipos, auditorias }) {
  const [encima, setEncima] = useState(null)
  const ancho = 760
  const alto = 260
  const margen = { izq: 52, der: 12, arr: 14, aba: 28 }
  const resultadoDe = (a, tipo) => a.cargas.find((c) => c.campo === campo.id && (c.tipo || 'comun') === tipo)?.resultado
  const valores = auditorias.flatMap((a) => tipos.map((t) => resultadoDe(a, t)?.resultado).filter((v) => v != null))
  // Simétrica alrededor del cero, para que sobrar y faltar se lean igual.
  const tope = Math.max(10, ...valores.map(Math.abs)) * 1.15
  const y = (v) => margen.arr + ((tope - v) / (2 * tope)) * (alto - margen.arr - margen.aba)
  const paso = (ancho - margen.izq - margen.der) / Math.max(auditorias.length, 1)
  // Las barras de un grupo, con 2 px de aire entre ellas.
  const anchoBarra = Math.min(32, (paso * 0.7) / tipos.length)
  const separacion = 2
  const anchoGrupo = anchoBarra * tipos.length + separacion * (tipos.length - 1)
  const marcas = [1, 0.5, 0, -0.5, -1].map((k) => Math.round((tope / 1.15) * k))
  const conLeyenda = tipos.length > 1

  return (
    <div className="bg-white rounded-3 shadow-sm mb-3 p-3" style={{ border: '1px solid #cbd5e1', position: 'relative' }}>
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
        <span className="fw-bold" style={{ color: campo.color, fontSize: '0.95rem' }}>
          {campo.titulo}
        </span>
        {/* La leyenda, con dos series: el color nunca va solo. */}
        {conLeyenda && (
          <div className="d-flex gap-3" style={{ fontSize: '0.75rem', color: TEXTO }}>
            {tipos.map((t) => (
              <span key={t} className="d-flex align-items-center gap-1">
                <span style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: colorSerie(campo, t), display: 'inline-block' }} />
                {TIPOS_GASOIL[t]}
              </span>
            ))}
          </div>
        )}
      </div>

      {auditorias.length === 0 ? (
        <div className="text-muted text-center py-4" style={{ fontSize: '0.8rem' }}>
          Todavía no hay auditorías con resultado
        </div>
      ) : (
        <svg
          viewBox={`0 0 ${ancho} ${alto}`}
          style={{ width: '100%', height: 'auto', display: 'block' }}
          role="img"
          aria-label={`Resultado de las auditorías de ${campo.titulo}`}
        >
          {marcas.map((v) => (
            <g key={v}>
              <line x1={margen.izq} x2={ancho - margen.der} y1={y(v)} y2={y(v)} stroke={v === 0 ? TEXTO_SUAVE : GRILLA} strokeWidth={1} />
              <text x={margen.izq - 6} y={y(v) + 3} textAnchor="end" fontSize="10" fill={TEXTO_SUAVE}>
                {v.toLocaleString('es-AR')}
              </text>
            </g>
          ))}
          <text x={12} y={y(tope / 2.3)} fontSize="10" fill={TEXTO_SUAVE} transform={`rotate(-90 12 ${y(tope / 2.3)})`} textAnchor="middle">
            sobra
          </text>
          <text x={12} y={y(-tope / 2.3)} fontSize="10" fill={TEXTO_SUAVE} transform={`rotate(-90 12 ${y(-tope / 2.3)})`} textAnchor="middle">
            falta
          </text>
          {auditorias.map((a, i) => {
            const inicio = margen.izq + paso * i + (paso - anchoGrupo) / 2
            const activa = encima === i
            return (
              <g key={a._id} onMouseEnter={() => setEncima(i)} onMouseLeave={() => setEncima(null)}>
                {/* El blanco del mouse es toda la columna. */}
                <rect x={margen.izq + paso * i} y={margen.arr} width={paso} height={alto - margen.arr - margen.aba} fill={activa ? '#f1f5f9' : 'transparent'} />
                {tipos.map((t, k) => {
                  const v = resultadoDe(a, t)?.resultado
                  if (v == null) return null
                  const x = inicio + k * (anchoBarra + separacion)
                  const arriba = Math.min(y(v), y(0))
                  const altoBarra = Math.max(Math.abs(y(v) - y(0)), 2)
                  return <rect key={t} x={x} y={arriba} width={anchoBarra} height={altoBarra} rx={3} fill={colorSerie(campo, t)} />
                })}
                <text x={margen.izq + paso * i + paso / 2} y={alto - 9} textAnchor="middle" fontSize="10" fill={activa ? TEXTO : TEXTO_SUAVE}>
                  {fechaCorta(a.fechaPedido)}
                </text>
              </g>
            )
          })}
        </svg>
      )}

      {/* El cartel de la auditoría con el mouse encima: la cuenta de cada tanque. */}
      {encima !== null && auditorias[encima] && (
        <div
          className="shadow-sm rounded-3 px-2 py-1 bg-white"
          style={{ position: 'absolute', top: 44, right: 16, border: '1px solid #cbd5e1', fontSize: '0.74rem', color: TEXTO, pointerEvents: 'none' }}
        >
          <div className="fw-semibold mb-1">{fecha(auditorias[encima].fechaPedido)}</div>
          {tipos.map((t) => {
            const r = resultadoDe(auditorias[encima], t)
            if (!r) return null
            return (
              <div key={t} className="d-flex align-items-center gap-1">
                <span style={{ width: 9, height: 9, borderRadius: 2, backgroundColor: colorSerie(campo, t), display: 'inline-block' }} />
                {conLeyenda && <span className="fw-semibold">{TIPOS_GASOIL[t]}:</span>}
                <span>
                  tendría {litros(r.teorico)}, medido {litros(r.medido)} —{' '}
                  <b>
                    {textoResultado(r.resultado)}
                    {desviacion(r) && ` (${desviacion(r)})`}
                  </b>
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function GasoilGraficos() {
  const navigate = useNavigate()
  const { puede } = usePermisos()
  const { user } = useAuth()
  const verResultado = puede('compras.gasoil', 'ver') && puede('compras.gasoil', 'editar')
  const [lista, setLista] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    api
      .get(`${API_GASOIL}/auditorias`)
      .then((data) => setLista(Array.isArray(data) ? data : []))
      .catch((error) => Swal.fire({ icon: 'error', title: 'No se pudo cargar', text: error.message, width: '300px' }))
      .finally(() => setCargando(false))
  }, [])

  // Los campos que ve cada uno (el encargado, solo el suyo), con sus
  // auditorías con resultado de la más vieja a la más nueva.
  const visibles = camposVisibles(user).map((c) => c.id)
  const campos = CAMPOS_GASOIL.filter((c) => visibles.includes(c.id)).map((campo) => ({
    campo,
    tipos: tiposDeCampo(campo.id),
    auditorias: lista
      .filter((a) => a.cargas.some((c) => c.campo === campo.id && c.resultado))
      .sort((a, b) => new Date(a.fechaPedido) - new Date(b.fechaPedido)),
  }))

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#f8f9fa', height: '100%', overflow: 'auto' }}>
      <Container fluid className="px-3 py-2" style={{ maxWidth: '900px', width: '100%', margin: '0 auto' }}>
        <div className="d-flex align-items-center justify-content-between gap-2 mb-3 flex-wrap">
          <div className="d-flex align-items-center gap-2">
            <div
              className="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0"
              style={{ width: '34px', height: '34px', backgroundColor: COLOR, color: '#fff', fontSize: '1.05rem' }}
            >
              <i className="bi bi-bar-chart-fill"></i>
            </div>
            <span className="fw-bold" style={{ color: COLOR, fontSize: '1.05rem', whiteSpace: 'nowrap' }}>
              Gasoil · Gráfico de auditorías
            </span>
          </div>
          <Button
            size="sm"
            onClick={() => navigate('/compras/gasoil/auditorias')}
            className="rounded-3 px-3 d-flex align-items-center gap-2"
            style={{ backgroundColor: '#fff', borderColor: COLOR, color: COLOR, fontSize: '0.78rem', height: '30px', fontWeight: 600 }}
          >
            <i className="bi bi-arrow-left"></i>
            <span>Auditorías</span>
          </Button>
        </div>

        <div className="text-muted mb-2" style={{ fontSize: '0.78rem' }}>
          El resultado de cada auditoría: arriba del cero sobra, abajo falta. Pasá el mouse por una fecha para ver la cuenta.
        </div>

        {!verResultado ? (
          <div className="text-muted text-center py-5">Tu rol no ve los resultados de las auditorías.</div>
        ) : cargando ? (
          <div className="text-muted text-center py-5">Cargando…</div>
        ) : (
          campos.map(({ campo, tipos, auditorias }) => (
            <GraficoCampo key={campo.id} campo={campo} tipos={tipos} auditorias={auditorias} />
          ))
        )}
      </Container>
    </div>
  )
}
