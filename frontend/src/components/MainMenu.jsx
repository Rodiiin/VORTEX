import React from 'react';
import { useSettings } from '../context/SettingsContext';
import './MainMenu.css';

/**
 * MainMenu Component - VORTEX Web Exergame
 *
 * Reemplazo de menú principal basado en arte conceptual de Boxeador:
 *  - Fondo a pantalla completa usando 'frontend/src/assets/background-menu.png'.
 *  - Título "VORTEX" en la esquina inferior izquierda.
 *  - Nodos interactivos con posición absoluta alineados con Puño, Codo y Cintura:
 *      * Puño: "Nueva Partida / Continuar Partida"
 *      * Codo: "Configuración"
 *      * Cintura: "Salir"
 *  - En reposo solo se ven anillos finos; al hacer hover el anillo pasa a neón (#B6F532),
 *    una línea vertical se despliega hacia abajo y se revela el texto de la opción.
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
  const { t } = useSettings();

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



      {/* ===================================================================
          NODOS INTERACTIVOS (PUÑO, CODO, CINTURA)
          Reposo: solo el anillo fino es visible.
          Hover/Focus: el anillo se vuelve neón, la línea vertical crece
          hacia abajo y se revela el texto de la opción (CSS puro).
          =================================================================== */}
      <button
        type="button"
        className="node-wrapper node-punch"
        onClick={handlePlay}
        aria-label={t('aria_jugar')}
      >
        <span className="node-ring" aria-hidden="true" />
        <span className="node-line" aria-hidden="true" />
        <span className="node-label">
          {t('nueva_partida')} /<br />{t('continuar_partida')}
        </span>
      </button>

      <button
        type="button"
        className="node-wrapper node-elbow"
        onClick={handleSettings}
        aria-label={t('aria_configuracion')}
      >
        <span className="node-ring" aria-hidden="true" />
        <span className="node-line" aria-hidden="true" />
        <span className="node-label">{t('configuracion')}</span>
      </button>

      <button
        type="button"
        className="node-wrapper node-waist"
        onClick={handleExit}
        aria-label={t('aria_salir')}
      >
        <span className="node-ring" aria-hidden="true" />
        <span className="node-line" aria-hidden="true" />
        <span className="node-label">{t('salir')}</span>
      </button>

      {/* ===================================================================
          TÍTULO PRINCIPAL "VORTEX" EN LA ESQUINA INFERIOR IZQUIERDA
          =================================================================== */}
      <footer className="vortex-brand-corner">
        <div className="brand-system-badge">
          <span className="brand-badge-dot" aria-hidden="true" />
          <span></span>
        </div>
        <h1 className="vortex-main-title">VORTEX</h1>
        <p className="vortex-subtitle"></p>
      </footer>
    </div>
  );
}
