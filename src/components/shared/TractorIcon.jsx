function TractorIcon({ size = "1em", color = "currentColor", style = {} }) {
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
      {/* Rueda trasera grande */}
      <circle cx="5" cy="12.5" r="3" />
      <circle cx="5" cy="12.5" r="1" />

      {/* Rueda delantera chica */}
      <circle cx="13.5" cy="13" r="1.8" />
      <circle cx="13.5" cy="13" r="0.6" />

      {/* Cabina */}
      <rect x="2.5" y="5.5" width="5.5" height="5.5" rx="0.6" />

      {/* Capó */}
      <path d="M8 8 H12.5 L13.5 11.2" />

      {/* Chasis entre ruedas */}
      <line x1="8" y1="12.5" x2="11.7" y2="12.5" />

      {/* Caño de escape */}
      <line x1="7" y1="5.5" x2="7" y2="3" />
      <line x1="6.3" y1="3" x2="7.7" y2="3" />
    </svg>
  );
}

export default TractorIcon;
