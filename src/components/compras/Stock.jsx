import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Container } from 'react-bootstrap'
import { grillaCentrada } from '../../utils/grillaTarjetas'

/**
 * El stock, por rubro (21/09/2026).
 *
 * Antes acá estaba la pantalla del almacén entera (el catálogo de artículos,
 * los ingresos, las entregas y sus movimientos). Se dio de baja: el stock se
 * empieza de nuevo separado por rubro, que es como se mira en el taller.
 *
 * Los seis rubros ya tienen pantalla, y es la misma para todos
 * (StockRubro.jsx): el id de la tarjeta es el que la elige. El catálogo general
 * tiene la suya aparte (StockCatalogo.jsx): no es un rubro, es todo el almacén
 * junto y de solo lectura.
 */
const SECCIONES = [
  {
    id: 'repuestos',
    titulo: 'Repuestos',
    subtitulo: 'Los repuestos de los equipos',
    icono: 'bi bi-gear-wide-connected',
    colores: {
      fondo: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
      fondoHover: 'linear-gradient(135deg, #172554 0%, #1e3a8a 100%)',
      borde: '#60a5fa',
      icono: '#bfdbfe',
      brillo: 'rgba(96,165,250,0.25)',
    },
  },
  {
    id: 'filtros',
    titulo: 'Filtros',
    subtitulo: 'Aceite, aire, combustible e hidráulicos',
    icono: 'bi bi-funnel-fill',
    colores: {
      fondo: 'linear-gradient(135deg, #1b4332 0%, #2d6a4f 100%)',
      fondoHover: 'linear-gradient(135deg, #081c15 0%, #1b4332 100%)',
      borde: '#10b981',
      icono: '#6ee7b7',
      brillo: 'rgba(16,185,129,0.25)',
    },
  },
  {
    // Cubiertas y correas iban en dos tarjetas y se juntaron en una
    // (22/09/2026). Se queda con el verde azulado de Correas: el gris que
    // tenía Cubiertas se perdía contra el fondo oscuro de la pantalla.
    id: 'cubiertas',
    titulo: 'Cubiertas y correas',
    subtitulo: 'Gomería, baterías, correas y cadenas',
    icono: 'bi bi-record-circle-fill',
    colores: {
      fondo: 'linear-gradient(135deg, #134e4a 0%, #0f766e 100%)',
      fondoHover: 'linear-gradient(135deg, #042f2e 0%, #134e4a 100%)',
      borde: '#2dd4bf',
      icono: '#99f6e4',
      brillo: 'rgba(45,212,191,0.25)',
    },
  },
  {
    id: 'ferreteria',
    titulo: 'Ferretería y herrería',
    subtitulo: 'Bulonería, hierro y electrodos',
    icono: 'bi bi-nut-fill',
    colores: {
      fondo: 'linear-gradient(135deg, #7c2d12 0%, #b45309 100%)',
      fondoHover: 'linear-gradient(135deg, #431407 0%, #7c2d12 100%)',
      borde: '#fbbf24',
      icono: '#fde68a',
      brillo: 'rgba(251,191,36,0.25)',
    },
  },
  {
    id: 'electricidad',
    titulo: 'Electricidad',
    subtitulo: 'Cables, luces y material eléctrico',
    icono: 'bi bi-lightning-charge-fill',
    colores: {
      fondo: 'linear-gradient(135deg, #3730a3 0%, #4f46e5 100%)',
      fondoHover: 'linear-gradient(135deg, #1e1b4b 0%, #3730a3 100%)',
      borde: '#818cf8',
      icono: '#c7d2fe',
      brillo: 'rgba(129,140,248,0.25)',
    },
  },
  {
    id: 'herramientas',
    titulo: 'Herramientas',
    subtitulo: 'Las herramientas del taller',
    icono: 'bi bi-tools',
    colores: {
      fondo: 'linear-gradient(135deg, #7a1828 0%, #9d2235 100%)',
      fondoHover: 'linear-gradient(135deg, #4a0812 0%, #7a1828 100%)',
      borde: '#f59e0b',
      icono: '#fcd34d',
      brillo: 'rgba(245,158,11,0.25)',
    },
  },
]

// El catálogo: no es un rubro más, es la lista de todo lo que existe. Por eso
// va arriba y alargada, del ancho de las seis, con el estilo compacto de la
// tarjeta de Variables (solo ícono y título).
const CATALOGO = {
  id: 'catalogo',
  titulo: 'Catálogo general',
  icono: 'bi bi-card-list',
  colores: {
    fondo: 'linear-gradient(135deg, #0e7490 0%, #155e75 100%)',
    fondoHover: 'linear-gradient(135deg, #164e63 0%, #0e7490 100%)',
    borde: '#67e8f9',
    icono: '#67e8f9',
    brillo: 'rgba(6,182,212,0.4)',
  },
}

// La separación entre tarjetas, en rem: de acá sale también el ancho de la
// alargada.
const GAP = 1.25

// Cuántas tarjetas entran por fila. Con seis rubros quedan dos filas parejas
// de tres (22/09/2026, cuando Cubiertas y Correas se juntaron y se fue Stock).
const COLUMNAS = 3

export default function Stock() {
  const navigate = useNavigate()
  const [hovered, setHovered] = useState(null)

  const ir = (id) => navigate(`/compras/analista/stock/${id}`)

  // La grilla manda el ancho. La alargada de arriba mide dos tarjetas: cada
  // una es (W - (C-1) gaps) / C, y van dos más el gap del medio. Sale de la
  // cuenta, no de un número a ojo, así sigue midiendo dos aunque cambien las
  // columnas o la cantidad de rubros.
  const grilla = grillaCentrada(SECCIONES.length, { ancho: 260, maxColumnas: COLUMNAS })
  const anchoDosTarjetas = `calc(${grilla.maxWidth} * 2 / ${COLUMNAS} - ${
    (GAP * (COLUMNAS - 2)) / COLUMNAS
  }rem)`

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        // Fondo oscuro, la única pantalla del Tablero que no va en gris claro:
        // así los colores de las tarjetas se ven de un vistazo.
        backgroundColor: '#0f172a',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      <Container
        fluid
        className="px-4 py-3 d-flex flex-column flex-grow-1"
        style={{ maxWidth: '1040px', width: '100%', margin: '0 auto' }}
      >
        {/* Sin encabezado: las tarjetas hablan solas, igual que en el analista. */}

        <div
          className="flex-grow-1 d-flex flex-column align-items-center justify-content-center"
          style={{ gap: `${GAP}rem` }}
        >
          {/* La alargada: el catálogo de todo lo que existe. */}
          <div
            className="d-flex align-items-center justify-content-center gap-3 px-4"
            style={{
              width: '100%',
              maxWidth: anchoDosTarjetas,
              height: '76px',
              background:
                hovered === CATALOGO.id ? CATALOGO.colores.fondoHover : CATALOGO.colores.fondo,
              borderRadius: '18px',
              color: '#fff',
              cursor: 'pointer',
              border: '2px solid rgba(255,255,255,0.3)',
              boxShadow:
                hovered === CATALOGO.id
                  ? `0 16px 32px rgba(0,0,0,0.5), 0 0 20px ${CATALOGO.colores.brillo}`
                  : '0 8px 24px rgba(0,0,0,0.35)',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              transform: hovered === CATALOGO.id ? 'translateY(-2px)' : 'translateY(0)',
              userSelect: 'none',
            }}
            onClick={() => ir(CATALOGO.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && ir(CATALOGO.id)}
            onMouseEnter={() => setHovered(CATALOGO.id)}
            onMouseLeave={() => setHovered(null)}
          >
            <div
              className="d-flex align-items-center justify-content-center"
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '12px',
                backgroundColor: 'rgba(255,255,255,0.15)',
              }}
            >
              <i
                className={CATALOGO.icono}
                style={{ fontSize: '1.3rem', color: CATALOGO.colores.icono }}
              ></i>
            </div>
            <span style={{ fontSize: '1.1rem', letterSpacing: '0.2px' }}>{CATALOGO.titulo}</span>
          </div>

          {/* Seis tarjetas: tres columnas y dos filas parejas. */}
          <div style={{ ...grilla, gap: `${GAP}rem` }}>
            {SECCIONES.map((s) => {
              const isHovered = hovered === s.id
              return (
                <div
                  key={s.id}
                  className="d-flex flex-column align-items-center justify-content-center text-center p-3"
                  style={{
                    background: isHovered ? s.colores.fondoHover : s.colores.fondo,
                    borderRadius: '20px',
                    height: '185px',
                    color: '#fff',
                    cursor: 'pointer',
                    border: `1px solid ${isHovered ? s.colores.borde : 'rgba(255,255,255,0.12)'}`,
                    boxShadow: isHovered
                      ? `0 18px 30px -10px rgba(0,0,0,0.4), 0 0 16px ${s.colores.brillo}`
                      : '0 8px 18px -6px rgba(0,0,0,0.25)',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    transform: isHovered ? 'translateY(-4px)' : 'translateY(0)',
                    userSelect: 'none',
                  }}
                  onClick={() => ir(s.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && ir(s.id)}
                  onMouseEnter={() => setHovered(s.id)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <div
                    className="mb-2 d-flex align-items-center justify-content-center"
                    style={{
                      width: '54px',
                      height: '54px',
                      borderRadius: '16px',
                      backgroundColor: 'rgba(255,255,255,0.1)',
                      border: '1px solid rgba(255,255,255,0.16)',
                    }}
                  >
                    <i className={s.icono} style={{ fontSize: '1.7rem', color: s.colores.icono }}></i>
                  </div>

                  <span style={{ fontSize: '1.05rem', letterSpacing: '0.2px' }}>
                    {s.titulo}
                  </span>

                  <span
                    className="mt-1 px-1"
                    style={{ fontSize: '0.76rem', color: 'rgba(255,255,255,0.72)' }}
                  >
                    {s.subtitulo}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </Container>
    </div>
  )
}
