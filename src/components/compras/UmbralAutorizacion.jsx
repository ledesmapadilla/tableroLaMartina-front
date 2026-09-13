import Swal from 'sweetalert2'
import { useAuth } from '../../context/AuthContext'
import { BORDO } from './formato'
import { useMontoAutorizacion, ROLES_EDITAN_MONTO } from './montoAutorizacion'

const pesos = (n) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)

// El campo del cartel se escribe como moneda ("$ 250.000"): se guardan solo
// los dígitos, en pesos enteros.
const soloDigitos = (texto) => String(texto ?? '').replace(/\D/g, '')
const comoMoneda = (texto) => {
  const digitos = soloDigitos(texto)
  return digitos ? pesos(Number(digitos)) : ''
}

/**
 * "Desde $200.000 → Autorizar por Gerencia": a partir de qué monto un pedido
 * necesita autorización. Gerente y superadmin ven un lápiz para cambiarlo;
 * el resto solo lo lee (y el backend tampoco les deja guardarlo).
 */
export default function UmbralAutorizacion() {
  const { user } = useAuth()
  const { monto, guardar } = useMontoAutorizacion()
  const puedeEditar = ROLES_EDITAN_MONTO.includes(user?.rol)

  const editar = async () => {
    const { value } = await Swal.fire({
      title: 'Monto de autorización',
      html:
        '<div style="font-size:0.86rem;color:#475569;line-height:1.5">' +
        'Desde este monto (sin IVA) el pedido va a Gerencia para autorizar; ' +
        'por debajo pasa directo al comprador.</div>',
      // Texto y no number: un campo numérico no admite el "$" ni los puntos
      // de miles. En el celular igual abre el teclado numérico.
      input: 'text',
      inputValue: pesos(monto),
      inputAttributes: { inputmode: 'numeric', autocomplete: 'off' },
      didOpen: () => {
        const campo = Swal.getInput()
        campo.addEventListener('input', () => {
          campo.value = comoMoneda(campo.value)
          campo.setSelectionRange(campo.value.length, campo.value.length)
        })
        campo.select()
      },
      showCancelButton: true,
      confirmButtonText: 'Guardar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: BORDO,
      cancelButtonColor: '#64748b',
      inputValidator: (v) => (Number(soloDigitos(v)) > 0 ? undefined : 'Indique un monto mayor a cero'),
    })
    if (value === undefined) return
    const nuevo = Number(soloDigitos(value))

    try {
      await guardar(nuevo)
      Swal.fire({
        icon: 'success',
        title: 'Monto actualizado',
        text: `Desde ${pesos(nuevo)} autoriza Gerencia.`,
        timer: 1800,
        showConfirmButton: false,
      })
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'No se pudo guardar', text: err.message })
    }
  }

  return (
    <div className="mb-2 d-flex align-items-center gap-2" style={{ fontSize: '0.8rem', color: '#64748b' }}>
      {/* "Desde" y no "mayor de": un pedido de exactamente ese monto también
          va a Gerencia. */}
      <span>
        Desde {pesos(monto)} →{' '}
        <span style={{ color: '#dc2626', fontWeight: 700 }}>Autorizar por Gerencia</span>
      </span>
      {puedeEditar && (
        <button
          type="button"
          onClick={editar}
          className="btn btn-link p-0 sin-zoom"
          style={{ color: BORDO, fontSize: '0.82rem', lineHeight: 1, textDecoration: 'none' }}
          title="Cambiar el monto (solo Gerencia y superadmin)"
        >
          <i className="bi bi-pencil-square"></i>
        </button>
      )}
    </div>
  )
}
