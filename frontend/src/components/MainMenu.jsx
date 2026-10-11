import React from 'react';
import './MainMenu.css';

/**
 * MainMenu Component - VORTEX Web Exergame
 *
 * Implements the Main Menu view displayed immediately after user login.
 * Split-screen layout:
 *   - Left side: Visual decorative container simulating concept art / game artwork.
 *   - Right side: Centered options panel with main title "Vortex" and vertical options.
 *
 * @param {Function} onStart - Callback for "Iniciar / Continuar" (optional)
 * @param {Function} onSettings - Callback for "Ajustes" (optional)
 * @param {Function} onExit - Callback for "Salir" (optional)
 * @param {Object|string} user - Current logged-in user details (optional)
 */
export default function MainMenu({
  onStart,
  onContinue,
  onSettings,
  onExit,
}) {
  // Handlers para interactividad estática / extensible
  const handleStart = () => {
    if (typeof onStart === 'function') {
      onStart();
    }
  };

  const handleContinue = () => {
    if (typeof onContinue === 'function') {
      onContinue();
    } else if (typeof onStart === 'function') {
      onStart();
    }
  };

  const handleSettings = () => {
    if (typeof onSettings === 'function') {
      onSettings();
    }
  };

  const handleExit = () => {
    if (typeof onExit === 'function') {
      onExit();
    }
  };

  return (
    <div className="mainmenu-wrapper">
      {/* Fondo cyberpunk dinámico con rejilla y orbes de luz */}
      <div className="mainmenu-grid-overlay" aria-hidden="true" />
      <div className="mainmenu-glow-orb mainmenu-glow-orb-left" aria-hidden="true" />
      <div className="mainmenu-glow-orb mainmenu-glow-orb-right" aria-hidden="true" />

      {/* Contenedor Principal Dividido (Split Layout) */}
      <main className="mainmenu-card-container">
        
        {/* ===================================================================
            LADO IZQUIERDO: CONTENEDOR VISUAL / ESPACIO RESERVADO PARA IMAGEN
            =================================================================== */}
        <section 
          className="mainmenu-left-section"
          aria-label="Espacio de arte conceptual de VORTEX"
        >
          <div className="mainmenu-art-placeholder">
            {/* Brackets tácticos HUD en las esquinas */}
            <span className="corner-bracket bracket-tl" aria-hidden="true" />
            <span className="corner-bracket bracket-tr" aria-hidden="true" />
            <span className="corner-bracket bracket-bl" aria-hidden="true" />
            <span className="corner-bracket bracket-br" aria-hidden="true" />

            {/* Centro: Gráfico temático de Shadow Boxing / Exergame */}
            <div className="art-center-display">
              <div className="art-illustration-wrapper">
                <div className="art-reticle-ring" aria-hidden="true" />
                <div className="art-reticle-inner-ring" aria-hidden="true" />
                
                {/* Silueta vectorial estilizada de Shadow Boxing y Sensor de Movimiento */}
                <svg
                  className="art-boxing-svg"
                  viewBox="0 0 100 100"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  {/* Aura y arcos cinéticos de golpe */}
                  <circle cx="50" cy="50" r="42" stroke="currentColor" strokeWidth="1.2" strokeDasharray="6 4" opacity="0.4" />
                  <path d="M78 35 C 88 45, 88 55, 78 65" stroke="var(--vx-lilac)" strokeWidth="2.5" strokeLinecap="round" opacity="0.8" />
                  <path d="M84 40 C 92 48, 92 52, 84 60" stroke="var(--vx-cyan)" strokeWidth="1.8" strokeLinecap="round" opacity="0.9" />

                  {/* Silueta de Boxeador en Guardia */}
                  <circle cx="48" cy="28" r="8" fill="var(--vx-cyan)" opacity="0.85" />
                  <path d="M42 38 L54 38 L58 60 L38 60 Z" fill="currentColor" opacity="0.75" />
                  <path d="M42 42 L28 44 L22 36" stroke="var(--vx-cyan)" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="21" cy="35" r="4.5" fill="var(--vx-lilac)" />
                  <path d="M54 42 L68 40 L76 34" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="77" cy="33" r="5" fill="var(--vx-cyan)" />
                  <circle cx="77" cy="33" r="8" stroke="var(--vx-lilac)" strokeWidth="1.5" strokeDasharray="3 2" />

                  {/* Piernas */}
                  <path d="M42 60 L36 82" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" />
                  <path d="M54 60 L62 80" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" />

                  {/* Nodos de seguimiento por visión IA */}
                  <circle cx="48" cy="28" r="2" fill="#ffffff" />
                  <circle cx="42" cy="42" r="2" fill="#ffffff" />
                  <circle cx="54" cy="42" r="2" fill="#ffffff" />
                  <circle cx="28" cy="44" r="2" fill="#ffffff" />
                  <circle cx="68" cy="40" r="2" fill="#ffffff" />
                </svg>
              </div>

              {/* Rótulo del Mockup 3 */}
              <div className="art-info-text-group">
                <h2 className="art-title-placeholder">Espacio para imagen</h2>
              </div>
            </div>
          </div>
        </section>

        {/* ===================================================================
            DIVISOR VERTICAL CENTRAL
            =================================================================== */}
        <div className="mainmenu-split-divider" aria-hidden="true" />

        {/* ===================================================================
            LADO DERECHO: PANEL DE OPCIONES
            =================================================================== */}
        <section 
          className="mainmenu-right-section"
          aria-label="Opciones del Menú Principal"
        >
          {/* Título Principal "Vortex" */}
          <header className="mainmenu-header">
            <h1 className="mainmenu-title">Vortex</h1>
          </header>

          {/* Opciones dispuestas verticalmente con efectos hover */}
          <nav className="mainmenu-nav" aria-label="Menú de Navegación">
            
            {/* Nivel 1: Fila con "Iniciar" y "Continuar" (en el mismo nivel, Continuar más llamativo) */}
            <div className="menu-btn-row">
              {/* Botón: Iniciar */}
              <button
                type="button"
                className="menu-btn menu-btn-start"
                onClick={handleStart}
                aria-label="Iniciar nueva partida"
              >
                <span className="menu-btn-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </span>
                <span>Iniciar</span>
              </button>

              {/* Botón: Continuar (Más llamativo) */}
              <button
                type="button"
                className="menu-btn menu-btn-continue"
                onClick={handleContinue}
                aria-label="Continuar partida guardada"
              >
                <span className="menu-btn-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                    <path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z" />
                  </svg>
                </span>
                <span>Continuar</span>
              </button>
            </div>

            {/* 2. Botón Secundario: "Ajustes" */}
            <button
              type="button"
              className="menu-btn menu-btn-secondary"
              onClick={handleSettings}
              aria-label="Abrir ajustes del videojuego"
            >
              <span className="menu-btn-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </span>
              <span>Ajustes</span>
            </button>

            {/* 3. Botón de Salida: "Salir" */}
            <button
              type="button"
              className="menu-btn menu-btn-exit"
              onClick={handleExit}
              aria-label="Cerrar sesión o salir del juego"
            >
              <span className="menu-btn-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </span>
              <span>Salir</span>
            </button>

          </nav>
        </section>

      </main>
    </div>
  );
}
