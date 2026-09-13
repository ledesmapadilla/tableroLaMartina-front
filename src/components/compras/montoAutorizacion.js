import { useCallback, useEffect, useState } from 'react'
import { api } from '../../services/api'

/**
 * El monto desde el que un pedido analizado va a Gerencia para autorizar
 * (precios sin IVA); por debajo pasa directo al comprador. Vive en la
 * configuración global (/api/config) y solo lo cambian gerente y superadmin:
 * el backend lo controla en su propia ruta.
 */
export const MONTO_AUTORIZACION_INICIAL = 200000
export const ROLES_EDITAN_MONTO = ['gerente', 'superadmin']

// Mientras no llega la configuración vale el monto de siempre.
export const useMontoAutorizacion = () => {
  const [monto, setMonto] = useState(MONTO_AUTORIZACION_INICIAL)

  // Se lee al abrir la pantalla y cada vez que la ventana vuelve a tener el
  // foco: si el gerente lo cambió en otra pestaña (Gerencia o Comprador), la
  // otra lo muestra actualizado al volver.
  useEffect(() => {
    let vigente = true
    const leer = () =>
      api
        .get('/config')
        .then((config) => {
          const valor = Number(config?.montoAutorizacion)
          if (vigente && valor > 0) setMonto(valor)
        })
        .catch(() => {})
    leer()
    window.addEventListener('focus', leer)
    return () => {
      vigente = false
      window.removeEventListener('focus', leer)
    }
  }, [])

  const guardar = useCallback(async (nuevo) => {
    const config = await api.put('/config/monto-autorizacion', { montoAutorizacion: nuevo })
    setMonto(Number(config.montoAutorizacion))
    return config
  }, [])

  return { monto, guardar }
}
