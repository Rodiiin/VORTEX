import React, { useState } from 'react';
import './Login.css';

/**
 * Login Component - VORTEX (Circular HUD Portal)
 *
 * @param {Function} onLoginSuccess - Callback invoked when login succeeds: (data) => void
 * @param {Function} onNavigateRegister - Callback to navigate to Register screen
 * @param {string} apiBaseUrl - Custom base URL for FastAPI backend (optional)
 * @param {string} redirectUrl - Fallback URL to redirect if no callback provided (default: '/dashboard')
 */
export default function Login({
  onLoginSuccess,
  onNavigateRegister,
  apiBaseUrl,
  redirectUrl = '/dashboard',
}) {
  // Form input state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // UI state
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [focusedField, setFocusedField] = useState(null);

  // Determine active API base URL
  const baseUrl = apiBaseUrl || import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

  /**
   * Handle Input change and clear active error on typing
   */
  const handleUsernameChange = (e) => {
    setUsername(e.target.value);
    if (errorMessage) setErrorMessage('');
  };

  const handlePasswordChange = (e) => {
    setPassword(e.target.value);
    if (errorMessage) setErrorMessage('');
  };

  /**
   * Form Submission & Backend Authentication
   */
  const handleSubmit = async (e) => {
    e.preventDefault();

    setErrorMessage('');
    setSuccessMessage('');

    // Pre-flight Client Validation
    const cleanUsername = username.trim();
    if (!cleanUsername) {
      setErrorMessage('Por favor, ingresa tu usuario o correo electrónico.');
      return;
    }

    if (!password) {
      setErrorMessage('Por favor, ingresa tu contraseña.');
      return;
    }

    setIsLoading(true);

    try {
      const endpoint = `${baseUrl}/api/auth/login`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          username: cleanUsername,
          password: password,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error(data?.detail || 'Credenciales inválidas. Verifica tus datos.');
        } else if (response.status === 404) {
          throw new Error('Servicio de autenticación no disponible (404).');
        } else if (response.status === 422) {
          throw new Error(data?.detail?.[0]?.msg || 'Formato de credenciales incorrecto.');
        } else {
          throw new Error(data?.detail || data?.message || `Error del servidor (${response.status})`);
        }
      }

      // Successful Authentication (200 OK)
      const token = data?.access_token || data?.token || data?.jwt || data?.session_token;

      if (token) {
        localStorage.setItem('vortex_token', token);
      }

      if (data?.user) {
        localStorage.setItem('vortex_user', JSON.stringify(data.user));
      }

      setSuccessMessage('¡Acceso concedido! Entrando a VORTEX...');

      setTimeout(() => {
        if (typeof onLoginSuccess === 'function') {
          onLoginSuccess(data || { token, username: cleanUsername });
        } else {
          window.location.href = redirectUrl;
        }
      }, 700);

    } catch (err) {
      console.error('VORTEX Login Error:', err);
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        setErrorMessage('Error de conexión: No se pudo conectar con el servidor VORTEX.');
      } else {
        setErrorMessage(err.message || 'Error inesperado al iniciar sesión.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="vortex-login-wrapper">
      {/* Full-screen Cyber Grid & Ambient Glows */}
      <div className="cyber-grid-overlay" />
      <div className="login-glow-orb login-glow-orb-top-left" />
      <div className="login-glow-orb login-glow-orb-top-right" />
      <div className="login-glow-orb login-glow-orb-bottom-left" />
      <div className="login-glow-orb login-glow-orb-bottom-right" />
      <div className="login-glow-orb login-glow-orb-center" />

      {/* Circular HUD Frame Container */}
      <div className="vortex-circle-portal">
        {/* Outer Rotating Energy Rings */}
        <div className="portal-ring portal-ring-outer" />
        <div className="portal-ring portal-ring-middle" />
        <div className="portal-ring portal-ring-glow" />

        {/* Central Circular Card */}
        <div className="vortex-login-card-circle">
          {/* Inner Content Area */}
          <div className="circle-content-safe-area">
            {/* Header */}
            <header className="login-header">
              <h1 className="login-title">VORTEX</h1>
              <h2 className="login-subtitle">Iniciar Sesión</h2>
            </header>

            {/* Floating Alert / Notifications */}
            {errorMessage && (
              <div className="login-alert login-alert-error" role="alert">
                <span className="login-alert-icon">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                </span>
                <span className="login-alert-text">{errorMessage}</span>
                <button
                  type="button"
                  className="login-alert-close"
                  onClick={() => setErrorMessage('')}
                  aria-label="Cerrar notificación"
                >
                  ✕
                </button>
              </div>
            )}

            {successMessage && (
              <div className="login-alert login-alert-success" role="status">
                <span className="login-alert-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
                <span className="login-alert-text">{successMessage}</span>
              </div>
            )}

            {/* Login Form */}
            <form className="login-form" onSubmit={handleSubmit} noValidate>
              {/* Field 1: Usuario o Correo Electrónico */}
              <div className="form-group">
                <label htmlFor="vortex-username" className="form-label">
                  Usuario o Correo Electrónico
                </label>
                <div
                  className={`cyber-input-wrapper ${
                    focusedField === 'username' ? 'is-focused' : ''
                  } ${isLoading ? 'is-disabled' : ''} ${
                    errorMessage && !username.trim() ? 'has-error' : ''
                  }`}
                >
                  <span className="input-icon-left">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </span>
                  <input
                    id="vortex-username"
                    name="username"
                    type="text"
                    className="cyber-input"
                    placeholder="Ingresa tu usuario o email..."
                    value={username}
                    onChange={handleUsernameChange}
                    onFocus={() => setFocusedField('username')}
                    onBlur={() => setFocusedField(null)}
                    disabled={isLoading}
                    autoComplete="username"
                    autoFocus
                  />
                </div>
              </div>

              {/* Field 2: Contraseña */}
              <div className="form-group">
                <label htmlFor="vortex-password" className="form-label">
                  Contraseña
                </label>
                <div
                  className={`cyber-input-wrapper ${
                    focusedField === 'password' ? 'is-focused' : ''
                  } ${isLoading ? 'is-disabled' : ''} ${
                    errorMessage && !password ? 'has-error' : ''
                  }`}
                >
                  <span className="input-icon-left">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </span>
                  <input
                    id="vortex-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    className="cyber-input"
                    placeholder="Ingresa tu contraseña..."
                    value={password}
                    onChange={handlePasswordChange}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField(null)}
                    disabled={isLoading}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="btn-password-toggle"
                    onClick={() => setShowPassword((prev) => !prev)}
                    disabled={isLoading}
                    title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showPassword ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                        <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                        <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                        <line x1="2" y1="2" x2="22" y2="22" />
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className={`btn-vortex-submit ${isLoading ? 'is-loading' : ''}`}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <span className="vortex-spinner" aria-hidden="true" />
                    <span>AUTENTICANDO...</span>
                  </>
                ) : (
                  <>
                    <span>INICIAR SESIÓN</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14" />
                      <path d="m12 5 7 7-7 7" />
                    </svg>
                  </>
                )}
              </button>
            </form>

            {/* Bottom Link: ¿No tienes cuenta? Crear Cuenta */}
            <footer className="login-footer">
              <p className="login-footer-text">
                <span>¿No tienes cuenta?</span>{' '}
                <button
                  type="button"
                  className="btn-link-register"
                  onClick={() => {
                    if (typeof onNavigateRegister === 'function') {
                      onNavigateRegister();
                    }
                  }}
                >
                  Crear Cuenta
                </button>
              </p>
            </footer>
          </div>
        </div>
      </div>
    </div>
  );
}
