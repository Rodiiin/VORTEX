import React from 'react';
import { useSettings } from '../context/SettingsContext';
import './Configuracion.css';

/**
 * Configuracion Component - VORTEX Web Exergame
 *
 * Pantalla de configuración:
 *  - Fondo negro sólido y tipografía Intel One Mono.
 *  - Recuadro central con borde blanco fino y título "Configuración".
 *  - Opciones: Idioma (Español / Inglés), Volumen (0-100) y Calibrar los sensores.
 *  - Botón "Atrás" en la esquina inferior derecha del recuadro.
 *
 * El idioma y el volumen son globales (SettingsContext) y persisten en localStorage.
 *
 * @param {Function} onBack - Callback para volver al menú principal
 */
const LANGUAGES = [
  { id: 'es', labelKey: 'idioma_es' },
  { id: 'en', labelKey: 'idioma_en' },
];

export default function Configuracion({ onBack }) {
  const { language, setLanguage, volume, setVolume, t } = useSettings();

  const handleBack = (e) => {
    if (typeof onBack === 'function') {
      onBack(e);
    }
  };

  const handleCalibrate = () => {
    console.log('Iniciar calibración manual');
  };

  return (
    <div className="vortex-config-container" role="main">
      <section className="config-box" aria-labelledby="config-title">
        <h1 id="config-title" className="config-title">{t('titulo_config')}</h1>

        <div className="config-options">
          {/* IDIOMA: toggle segmentado Español / Inglés */}
          <div className="config-row">
            <span className="config-label" id="config-language-label">{t('idioma')}</span>
            <div
              className="config-toggle"
              role="radiogroup"
              aria-labelledby="config-language-label"
            >
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.id}
                  type="button"
                  role="radio"
                  aria-checked={language === lang.id}
                  className={`config-toggle-option ${language === lang.id ? 'is-selected' : ''}`}
                  onClick={() => setLanguage(lang.id)}
                >
                  {t(lang.labelKey)}
                </button>
              ))}
            </div>
          </div>

          {/* VOLUMEN: slider 0-100 con estilo personalizado */}
          <div className="config-row">
            <label className="config-label" htmlFor="config-volume">{t('volumen')}</label>
            <div className="config-volume">
              <input
                id="config-volume"
                type="range"
                min="0"
                max="100"
                step="1"
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="config-range"
                style={{ '--range-fill': `${volume}%` }}
              />
              <span className="config-volume-value" aria-hidden="true">{volume}</span>
            </div>
          </div>

          {/* CALIBRAR LOS SENSORES */}
          <div className="config-row">
            <button
              type="button"
              className="config-link-btn"
              onClick={handleCalibrate}
            >
              {t('calibrar')}
            </button>
          </div>
        </div>

        <button
          type="button"
          className="config-back-btn"
          onClick={handleBack}
          aria-label={t('aria_atras_menu')}
        >
          {t('atras')}
        </button>
      </section>
    </div>
  );
}
