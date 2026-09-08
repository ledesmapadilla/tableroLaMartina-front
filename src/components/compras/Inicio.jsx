export default function Inicio() {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <img src="/logo LM-transp.png" alt="Logo La Martina" style={{ maxWidth: 320, width: '60%' }} />
      <p style={{ marginTop: 12, fontWeight: 700, fontSize: 22, letterSpacing: 6, textTransform: 'uppercase', color: 'var(--color-muted)' }}>
        Compras
      </p>
    </div>
  )
}
