import React from 'react';
import './MainMenu.css';

/**
 * MainMenu Component - VORTEX Web Exergame
 *
 * Reemplazo de menú principal basado en arte conceptual de Boxeador:
 *  - Fondo a pantalla completa usando 'frontend/src/assets/background-menu.png'.
 *  - Título "VORTEX" en la esquina inferior izquierda.
 *  - Botones interactivos con posición absoluta alineados con Puño, Codo y Cintura:
 *      * Puño: "Nueva Partida / Continuar Partida"
 *      * Codo: "Configuración"
 *      * Cintura: "Salir"
 *  - Retículas circulares y líneas de conexión vectoriales con color de acento neón (#B6F532).
 *  - Efectos hover sutiles e interactivos en todos los botones.
 *
 * @param {Function} onStart - Callback para iniciar nueva partida (opcional)
 * @param {Function} onContinue - Callback para continuar partida existente (opcional)
 * @param {Function} onSettings - Callback para abrir configuración (opcional)
 * @param {Function} onExit - Callback para cerrar sesión o salir (opcional)
 * @param {Object} user - Datos del usuario autenticado (opcional)
 */
export default function MainMenu({
  onStart,
  onContinue,
  onSettings,
  onExit,
  user,
}) {
  const handlePlay = (e) => {
    if (typeof onContinue === 'function') {
      onContinue(e);
    } else if (typeof onStart === 'function') {
      onStart(e);
    }
  };

  const handleSettings = (e) => {
    if (typeof onSettings === 'function') {
      onSettings(e);
    }
  };

  const handleExit = (e) => {
    if (typeof onExit === 'function') {
      onExit(e);
    }
  };

  return (
    <div className="vortex-mainmenu-container" role="main">
      {/* Capa de viñeta ambiental sutil para realzar el contraste de la interfaz */}
      <div className="vortex-vignette-overlay" aria-hidden="true" />

      {/* Chip de estado y piloto en el HUD superior */}
      <header className="vortex-top-hud" aria-label="Estado del sistema">
        <div className="vortex-pilot-status-chip">
          <span className="pilot-chip-dot" aria-hidden="true" />
          <span className="pilot-chip-callsign">
            {user?.username ? `PILOTO // ${user.username.toUpperCase()}` : 'SISTEMA VORTEX // EN LÍNEA'}
          </span>
        </div>
      </header>

      {/* ===================================================================
          1. NODO INTERACTIVO: ALINEADO CON EL PUÑO
          Opción: "Nueva Partida / Continuar Partida"
          =================================================================== */}
      <section 
        className="vortex-hud-node node-punch"
        aria-label="Acción de combate principal"
      >
        <div className="hud-connector-wrapper" aria-hidden="true">
          <svg className="hud-connector-svg svg-punch" viewBox="0 0 110 130" fill="none">
            {/* Retícula circular en el puño con pulso y rotación de radar */}
            <circle cx="20" cy="105" r="4" fill="var(--vx-color-neon)" />
            <circle cx="20" cy="105" r="9" stroke="var(--vx-color-neon)" strokeWidth="1.2" strokeDasharray="3 2" className="hud-radar-spin" />
            <circle cx="20" cy="105" r="16" stroke="var(--vx-color-lavender)" strokeWidth="0.8" opacity="0.4" />
            
            {/* Línea fina de conexión hacia el botón */}
            <path d="M 20 105 L 55 35 L 110 35" stroke="var(--vx-color-neon)" strokeWidth="1.5" className="hud-connector-line" />
            <circle cx="108" cy="35" r="2.5" fill="var(--vx-color-neon)" />
            
            {/* Etiqueta táctica HUD */}
            <text x="20" y="125" fill="var(--vx-color-lavender)" fontSize="8.5" letterSpacing="1" fontFamily="var(--vx-font-mono)">
              LOC.01 // PUÑO
            </text>
          </svg>
        </div>

        <button
          type="button"
          className="vortex-interactive-btn btn-action-punch"
          onClick={handlePlay}
          aria-label="Nueva Partida o Continuar Partida"
        >
          <span className="btn-hud-tag">01 // MISIÓN</span>
          <span className="btn-main-label">
            <span>Nueva Partida / Continuar Partida</span>
            <span className="btn-arrow-icon" aria-hidden="true">▸</span>
          </span>
        </button>
      </section>

      {/* ===================================================================
          2. NODO INTERACTIVO: ALINEADO CON EL CODO
          Opción: "Configuración"
          =================================================================== */}
      <section 
        className="vortex-hud-node node-elbow"
        aria-label="Configuración del juego"
      >
        <div className="hud-connector-wrapper" aria-hidden="true">
          <svg className="hud-connector-svg svg-elbow" viewBox="0 0 140 210" fill="none">
            {/* Retícula circular en el codo */}
            <circle cx="20" cy="185" r="4" fill="var(--vx-color-neon)" />
            <circle cx="20" cy="185" r="9" stroke="var(--vx-color-neon)" strokeWidth="1.2" strokeDasharray="3 2" className="hud-radar-spin" />
            <circle cx="20" cy="185" r="16" stroke="var(--vx-color-lavender)" strokeWidth="0.8" opacity="0.4" />
            
            {/* Línea fina de conexión hacia el botón */}
            <path d="M 20 185 L 75 30 L 140 30" stroke="var(--vx-color-neon)" strokeWidth="1.5" className="hud-connector-line" />
            <circle cx="138" cy="30" r="2.5" fill="var(--vx-color-neon)" />
            
            {/* Etiqueta táctica HUD */}
            <text x="20" y="205" fill="var(--vx-color-lavender)" fontSize="8.5" letterSpacing="1" fontFamily="var(--vx-font-mono)">
              LOC.02 // CODO
            </text>
          </svg>
        </div>

        <button
          type="button"
          className="vortex-interactive-btn btn-action-elbow"
          onClick={handleSettings}
          aria-label="Abrir panel de configuración"
        >
          <span className="btn-hud-tag">02 // SISTEMA</span>
          <span className="btn-main-label">
            <span>Configuración</span>
            <span className="btn-arrow-icon" aria-hidden="true">▸</span>
          </span>
        </button>
      </section>

      {/* ===================================================================
          3. NODO INTERACTIVO: ALINEADO CON LA CINTURA
          Opción: "Salir"
          =================================================================== */}
      <section 
        className="vortex-hud-node node-waist"
        aria-label="Cierre de sesión"
      >
        <div className="hud-connector-wrapper" aria-hidden="true">
          <svg className="hud-connector-svg svg-waist" viewBox="0 0 100 125" fill="none">
            {/* Retícula circular en la cintura */}
            <circle cx="45" cy="100" r="4" fill="var(--vx-color-neon)" />
            <circle cx="45" cy="100" r="9" stroke="var(--vx-color-neon)" strokeWidth="1.2" strokeDasharray="3 2" className="hud-radar-spin" />
            <circle cx="45" cy="100" r="16" stroke="var(--vx-color-lavender)" strokeWidth="0.8" opacity="0.4" />
            
            {/* Línea fina de conexión hacia el botón */}
            <path d="M 45 100 L 45 35 L 90 35" stroke="var(--vx-color-neon)" strokeWidth="1.5" className="hud-connector-line" />
            <circle cx="88" cy="35" r="2.5" fill="var(--vx-color-neon)" />
            
            {/* Etiqueta táctica HUD */}
            <text x="45" y="120" textAnchor="middle" fill="var(--vx-color-lavender)" fontSize="8.5" letterSpacing="1" fontFamily="var(--vx-font-mono)">
              LOC.03 // CINTURA
            </text>
          </svg>
        </div>

        <button
          type="button"
          className="vortex-interactive-btn btn-action-waist"
          onClick={handleExit}
          aria-label="Cerrar sesión o salir del juego"
        >
          <span className="btn-hud-tag">03 // TERMINAL</span>
          <span className="btn-main-label">
            <span>Salir</span>
            <span className="btn-arrow-icon" aria-hidden="true">▸</span>
          </span>
        </button>
      </section>

      {/* ===================================================================
          TÍTULO PRINCIPAL "VORTEX" EN LA ESQUINA INFERIOR IZQUIERDA
          =================================================================== */}
      <footer className="vortex-brand-corner">
        <div className="brand-system-badge">
          <span className="brand-badge-dot" aria-hidden="true" />
          <span>MOTOR BIOMECÁNICO ACTIVO</span>
        </div>
        <h1 className="vortex-main-title">VORTEX</h1>
        <p className="vortex-subtitle">ENTRENAMIENTO POR VISIÓN ARTIFICIAL</p>
      </footer>
    </div>
  );
}
