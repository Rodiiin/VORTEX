import React, { useState, useEffect } from 'react';
import './Login.css';
import './DashboardPlaceholder.css';

/**
 * DashboardPlaceholder Component - VORTEX Post-Login View
 *
 * @param {Object|string} user - Current user object or username
 * @param {Function} onLogout - Callback invoked when the user logs out
 * @param {string} apiBaseUrl - Base URL for the FastAPI backend (optional)
 */
export default function DashboardPlaceholder({ user, onLogout, apiBaseUrl }) {
  const [dbStatus, setDbStatus] = useState('Verificando...');
  const baseUrl = apiBaseUrl || import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

  // Extraer el nombre de usuario desde props o de localStorage
  const getUsername = () => {
    if (typeof user === 'string') return user;
    if (user?.username) return user.username;
    try {
      const saved = localStorage.getItem('vortex_user');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.username) return parsed.username;
      }
    } catch {
      // Ignorar errores de parsing
    }
    return 'Piloto VORTEX';
  };

  const username = getUsername();

  // Verificar estado de la conexión con PostgreSQL en tiempo real
  useEffect(() => {
    let isMounted = true;
    const checkDb = async () => {
      try {
        const res = await fetch(`${baseUrl}/api/health`);
        const data = await res.json();
        if (isMounted) {
          if (res.ok && data?.db_connected) {
            setDbStatus('PostgreSQL Conectada (vortex_db)');
          } else {
            setDbStatus('Error en BD');
          }
        }
      } catch {
        if (isMounted) setDbStatus('En Línea (Sesión Local)');
      }
    };

    checkDb();
    return () => {
      isMounted = false;
    };
  }, [baseUrl]);

  /**
   * Manejador de Cierre de Sesión:
   * Elimina el token y usuario guardados en localStorage y retorna a Login.
   */
  const handleLogoutClick = () => {
    localStorage.removeItem('vortex_token');
    localStorage.removeItem('vortex_user');
    if (typeof onLogout === 'function') {
      onLogout();
    }
  };

  return (
    <div className="vortex-login-wrapper">
      {/* Fondo cyberpunk dinámico */}
      <div className="cyber-grid-overlay" />
      <div className="login-glow-orb login-glow-orb-top-left" />
      <div className="login-glow-orb login-glow-orb-top-right" />
      <div className="login-glow-orb login-glow-orb-bottom-left" />
      <div className="login-glow-orb login-glow-orb-bottom-right" />
      <div className="login-glow-orb login-glow-orb-center" />

      {/* Portal Circular HUD */}
      <div className="vortex-circle-portal">
        <div className="portal-ring portal-ring-outer" />
        <div className="portal-ring portal-ring-middle" />
        <div className="portal-ring portal-ring-glow" />

        <div className="vortex-login-card-circle">
          <div className="circle-content-safe-area dashboard-card-inner">
            
            {/* Header del Centro de Mando */}
            <header className="login-header" style={{ marginBottom: '0.5rem' }}>
              <h1 className="login-title">VORTEX</h1>
              <h2 className="login-subtitle">Centro de Control</h2>
            </header>

            {/* Mensaje de Bienvenida Especificado */}
            <div className="dashboard-welcome-banner" role="status">
              <span className="dashboard-welcome-icon" aria-hidden="true">⚡</span>
              <p className="dashboard-welcome-text">
                ¡Bienvenido a VORTEX, <strong>{username}</strong>! La conexión con la base de datos y la sesión está activa.
              </p>
            </div>

            {/* Panel de Estado y Métricas de Sesión */}
            <div className="dashboard-status-panel">
              <div className="dashboard-metric-row">
                <span className="dashboard-metric-label">PILOTO ASIGNADO:</span>
                <span className="dashboard-metric-value dashboard-metric-cyan">
                  {username}
                </span>
              </div>

              <div className="dashboard-metric-row">
                <span className="dashboard-metric-label">ESTADO DE BD:</span>
                <span className="dashboard-metric-value dashboard-metric-emerald">
                  <span className="dashboard-pulse-dot" />
                  {dbStatus}
                </span>
              </div>

              <div className="dashboard-metric-row">
                <span className="dashboard-metric-label">SESIÓN ACTIVA:</span>
                <span className="dashboard-metric-value" style={{ color: '#D2A2F2' }}>
                  {localStorage.getItem('vortex_token') ? 'Token Bearer ✓' : 'Activa'}
                </span>
              </div>

              <div className="dashboard-metric-row">
                <span className="dashboard-metric-label">SISTEMA:</span>
                <span className="dashboard-metric-value" style={{ color: '#f5f6fa' }}>
                  Shadow Boxing AI v1.0
                </span>
              </div>
            </div>

            {/* Acciones principales */}
            <div className="dashboard-btn-group">
              <button
                type="button"
                className="btn-vortex-submit"
                onClick={() => alert('¡Calibración de cámara lista! Preparando modo Shadow Boxing AI.')}
              >
                <span>🥊 INICIAR ENTRENAMIENTO</span>
              </button>

              <button
                type="button"
                className="btn-vortex-logout"
                onClick={handleLogoutClick}
                aria-label="Cerrar Sesión de usuario"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                <span>CERRAR SESIÓN</span>
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
