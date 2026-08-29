function Produccion() {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#f8f9fa",
        height: "100%",
        overflow: "hidden",
      }}
    >
      <div className="flex-grow-1 d-flex flex-column align-items-center justify-content-center text-center p-4">
        <h2 className="fw-bold mb-1" style={{ color: "#1b4332" }}>
          Producción
        </h2>
        <p className="text-muted mb-0">Elegí una sección desde el menú de arriba</p>
      </div>
    </div>
  );
}

export default Produccion;
