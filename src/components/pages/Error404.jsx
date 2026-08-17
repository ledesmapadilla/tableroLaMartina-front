import { useNavigate } from "react-router-dom";
import tractorCaricaturaImg from "../../assets/tractor-caricatura.jpg";

function Error404() {
  const navigate = useNavigate();

  return (
    <div
      className="d-flex flex-column align-items-center justify-content-between min-vh-100 px-3 py-3 text-center position-relative"
      style={{
        backgroundColor: "#ffffff",
        overflow: "hidden",
      }}
    >
      {/* Barra superior con botones Volver e Ir a General */}
      <div
        className="d-flex justify-content-end align-items-center gap-2 w-100 px-3 pt-2"
        style={{ maxWidth: "800px" }}
      >
        <button
          onClick={() => navigate(-1)}
          className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1.5 rounded-3 px-3 py-2"
          style={{
            fontSize: "0.86rem",
            fontWeight: "400",
          }}
        >
          <i className="bi bi-arrow-left"></i>
          <span>Volver</span>
        </button>
        <button
          onClick={() => navigate("/")}
          className="btn btn-sm btn-dark d-inline-flex align-items-center gap-2 rounded-3 px-3.5 py-2 shadow-sm"
          style={{
            fontSize: "0.86rem",
            fontWeight: "400",
            backgroundColor: "#1e293b",
            borderColor: "#1e293b",
            transition: "transform 0.15s ease, box-shadow 0.15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "scale(1.03)";
            e.currentTarget.style.boxShadow = "0 4px 12px rgba(30, 41, 59, 0.25)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "scale(1)";
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          <i className="bi bi-house-door-fill"></i>
          <span style={{ fontWeight: "400" }}>Ir a General</span>
        </button>
      </div>

      {/* Contenido Central */}
      <div className="d-flex flex-column align-items-center justify-content-center my-auto">
        {/* #404 Grande y Arriba con separación clara */}
        <h1
          className="fw-bold text-dark"
          style={{
            fontSize: "3.5rem",
            letterSpacing: "-1.5px",
            color: "#1e293b",
            lineHeight: 1,
            marginTop: "0.5rem",
            marginBottom: "2.5rem",
          }}
        >
          #404
        </h1>

        {/* Imagen Caricatura recortada fundida 100% con el fondo */}
        <div
          className="position-relative d-flex align-items-center justify-content-center my-2"
          style={{
            maxWidth: "460px",
            width: "100%",
          }}
        >
          <img
            src={tractorCaricaturaImg}
            alt="Tractor Caricatura"
            className="img-fluid"
            style={{
              maxHeight: "350px",
              width: "auto",
              objectFit: "contain",
              mixBlendMode: "multiply",
            }}
          />
        </div>

        {/* Título solicitado */}
        <h2
          className="fw-bold text-dark mb-2"
          style={{
            fontSize: "1.85rem",
            letterSpacing: "-0.5px",
          }}
        >
          Ups! algo salio mal.
        </h2>

        <p
          className="text-secondary mb-2"
          style={{
            fontSize: "0.95rem",
            maxWidth: "420px",
          }}
        >
          Esta sección se encuentra temporalmente en reparación.
        </p>
      </div>

      {/* Espaciador inferior para centrado óptico */}
      <div style={{ height: "20px" }}></div>
    </div>
  );
}

export default Error404;
