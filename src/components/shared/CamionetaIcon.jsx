function CamionetaIcon({ size = "1em", color = "currentColor", style = {} }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="none"
      stroke={color}
      strokeWidth="1.1"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
    >
      {/* Silueta de la camioneta */}
      <path d="M 1,11.5 H 2.5 A 1.5,1.5 0 0 1 5.5,11.5 H 10.5 A 1.5,1.5 0 0 1 13.5,11.5 H 15 V 8.2 H 11 L 9.6,5.2 H 5.8 V 8.2 H 1 Z" />

      {/* Ventana */}
      <path d="M 6.3,5.8 H 8.8 L 9.7,7.8 H 6.3 Z" />

      {/* División de puertas */}
      <line x1="7.8" y1="5.8" x2="7.8" y2="7.8" />

      {/* Rueda trasera */}
      <circle cx="4" cy="11.5" r="1.2" />
      <circle cx="4" cy="11.5" r="0.4" />

      {/* Rueda delantera */}
      <circle cx="12" cy="11.5" r="1.2" />
      <circle cx="12" cy="11.5" r="0.4" />
    </svg>
  );
}

export default CamionetaIcon;
