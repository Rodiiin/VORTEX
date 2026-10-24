import React, { useRef } from 'react';
import './Levels.css';

/**
 * Levels Component - VORTEX Web Exergame
 *
 * Pantalla de selección de niveles basada en el mockup "Levels.png":
 *  - Fondo negro sólido y tipografía Intel One Mono.
 *  - Cabecera con botón "Atrás" (verde neón) y título "Niveles" centrado.
 *  - Carrusel horizontal de tarjetas (sin barra de scroll nativa).
 *  - Solo el "Tutorial" es interactivo por ahora; los niveles 1-3 son placeholders.
 *
 * @param {Function} onBack - Callback para volver al menú principal
 * @param {Function} onSelectLevel - Callback al seleccionar un nivel jugable (recibe el id)
 */
const LEVELS = [
  { id: 'tutorial', name: 'Tutorial', chapter: 'Capítulo 0', available: true },
  { id: 'level-1', name: 'Nivel 1', chapter: 'Capítulo I', available: false },
  { id: 'level-2', name: 'Nivel 2', chapter: 'Capítulo II', available: false },
  { id: 'level-3', name: 'Nivel 3', chapter: 'Capítulo III', available: false },
];

export default function Levels({ onBack, onSelectLevel }) {
  const carouselRef = useRef(null);
  const wheelLockRef = useRef(false);

  const handleBack = (e) => {
    if (typeof onBack === 'function') {
      onBack(e);
    }
  };

  const handleSelect = (levelId) => {
    if (typeof onSelectLevel === 'function') {
      onSelectLevel(levelId);
    }
  };

  // Permite recorrer el carrusel con la rueda vertical del ratón: avanza una
  // tarjeta por gesto (el bloqueo evita saltos múltiples con trackpads)
  const handleWheel = (e) => {
    const carousel = carouselRef.current;
    if (!carousel || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    if (wheelLockRef.current) return;

    const item = carousel.querySelector('.level-item');
    const gap = parseFloat(getComputedStyle(carousel).columnGap) || 0;
    const step = item ? item.offsetWidth + gap : carousel.clientWidth;

    carousel.scrollBy({ left: Math.sign(e.deltaY) * step });
    wheelLockRef.current = true;
    setTimeout(() => {
      wheelLockRef.current = false;
    }, 450);
  };

  return (
    <div className="vortex-levels-container" role="main">
      {/* Cabecera: botón Atrás + título */}
      <header className="levels-header">
        <button
          type="button"
          className="levels-back-btn"
          onClick={handleBack}
          aria-label="Volver al menú principal"
        >
          Atrás
        </button>
        <h1 className="levels-title">Niveles</h1>
      </header>

      {/* Carrusel horizontal de niveles */}
      <section
        ref={carouselRef}
        className="levels-carousel"
        onWheel={handleWheel}
        aria-label="Selección de niveles"
      >
        {LEVELS.map((level) => (
          <article
            key={level.id}
            className={`level-item ${level.available ? 'is-available' : 'is-locked'}`}
          >
            {level.available ? (
              <button
                type="button"
                className="level-card"
                onClick={() => handleSelect(level.id)}
                aria-label={`Jugar ${level.name}, ${level.chapter}`}
              >
                <span className="level-card-name">{level.name}</span>
                <span className="level-card-score">Puntuación</span>
              </button>
            ) : (
              <div className="level-card" aria-disabled="true">
                <span className="level-card-name">{level.name}</span>
                <span className="level-card-score">Puntuación</span>
              </div>
            )}
            <p className="level-chapter">{level.chapter}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
