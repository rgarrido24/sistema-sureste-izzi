// Componente del logo de RGO
export default function RGOLogo({ size = 120, showText = false, className = '' }) {
  // Usar el nombre exacto del archivo: "LOGO RGO.png" (con mayúsculas)
  // En Vite, los archivos en public/ se sirven desde la raíz
  const logoPath = '/LOGO%20RGO.png';

  return (
    <div className={`flex flex-col items-center ${className}`}>
      {/* Logo como imagen */}
      <img 
        src={logoPath}
        alt="RGO Logo"
        width={size}
        height={size}
        className="mb-2 object-contain"
        style={{ maxWidth: `${size}px`, maxHeight: `${size}px` }}
        onError={(e) => {
          // Si no se encuentra, intentar variaciones
          console.warn('Logo RGO no encontrado en:', logoPath);
          const alternatives = [
            '/LOGO RGO.png',
            '/LOGO%20RGO.png',
            '/logo RGO.png',
            '/logo%20RGO.png',
            '/logo-RGO.png',
            '/logoRGO.png'
          ];
          let currentAlt = 0;
          const tryNext = () => {
            if (currentAlt < alternatives.length) {
              e.target.src = alternatives[currentAlt];
              currentAlt++;
            } else {
              e.target.style.display = 'none';
            }
          };
          tryNext();
        }}
      />
      
      {/* Texto RGO removido según solicitud del usuario */}
    </div>
  );
}

