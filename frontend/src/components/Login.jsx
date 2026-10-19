import React, { useState } from 'react';
import './Login.css';

/**
 * Login Component - VORTEX (HUD Biomecánico Circular)
 *
 * Recrea con fidelidad la interfaz del mockup en `Mockups/Imagenes UI/iniciar sesion.png`
 * con círculos concéntricos en CSS puro, rotación continua y sutil en el círculo exterior punteado,
 * campos minimalistas para "Nombre" y "Contraseña", título superior "VORTEX" con brillo neón
 * y enlace inferior para registrar una nueva cuenta.
 *
 * @param {Function} onLoginSuccess - Callback invocado al autenticar exitosamente: (data) => void
 * @param {Function} onNavigateRegister - Callback para navegar a la pantalla de Registro
 * @param {string} apiBaseUrl - URL base personalizada para el backend FastAPI (opcional)
 * @param {string} redirectUrl - URL de redirección fallback (default: '/dashboard')
 */
export default function Login({
  onLoginSuccess,
  onNavigateRegister,
  apiBaseUrl,
  redirectUrl = '/dashboard',
}) {
  // Estado de inputs del formulario
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Estado de interfaz y feedback
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Determinar URL base de la API backend
  const baseUrl = apiBaseUrl || import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

  /**
   * Manejadores de cambio de input con limpieza reactiva de errores
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
   * Envío del formulario y autenticación con backend FastAPI
   */
  const handleSubmit = async (e) => {
    e.preventDefault();

    setErrorMessage('');
    setSuccessMessage('');

    // Validación en cliente previa al fetch
    const cleanUsername = username.trim();
    if (!cleanUsername) {
      setErrorMessage('Por favor, ingresa tu nombre de usuario.');
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

      // Autenticación exitosa (200 OK)
      const token = data?.access_token || data?.token || data?.jwt || data?.session_token;

      if (token) {
        localStorage.setItem('vortex_token', token);
      }

      if (data?.user) {
        localStorage.setItem('vortex_user', JSON.stringify(data.user));
      }

      setSuccessMessage('Ingresando a la cuenta.');

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
    <div className="vortex-login-container">
      {/* Fondo ambiental sutil y viñeta HUD */}
      <div className="login-vignette-overlay" aria-hidden="true" />
      <div className="login-ambient-glow" aria-hidden="true" />

      {/* 3. TÍTULO SUPERIOR FUERA DEL MOCKUP CON BRILLO NEÓN */}
      <header className="vortex-login-top-header">
        <h1 className="vortex-main-brand-title">VORTEX</h1>
        <div className="vortex-system-badge">
          <span className="vortex-badge-dot" />
          <span></span>
        </div>
      </header>

      {/* 1. ESTRUCTURA CIRCULAR (HUD CSS CONCÉNTRICO) */}
      <div className="vortex-hud-system">
        {/* Círculo exterior punteado (dashed) con rotación continua y lenta */}
        <div className="vortex-circle-outer-dashed" aria-hidden="true" />

        {/* Círculo interior con borde sólido */}
        <div className="vortex-circle-inner-solid">
          {/* 2. CONTENIDO CENTRAL (Formulario) */}
          <div className="vortex-hud-form-area">
            {/* Título "Iniciar Sesión" tal como en el mockup */}
            <h2 className="vortex-hud-login-title">Iniciar Sesión</h2>

            {/* Mensajes de alerta y feedback */}
            {errorMessage && (
              <div className="vortex-hud-alert vortex-hud-alert-error" role="alert">
                <span>{errorMessage}</span>
              </div>
            )}

            {successMessage && (
              <div className="vortex-hud-alert vortex-hud-alert-success" role="status">
                <span>{successMessage}</span>
              </div>
            )}

            {/* Formulario de Inicio de Sesión Minimalista */}
            <form className="vortex-hud-form" onSubmit={handleSubmit} noValidate>
              {/* Campo 1: Nombre */}
              <div className="vortex-minimal-field">
                <label htmlFor="vortex-login-username" className="vortex-minimal-label">
                  Nombre
                </label>
                <input
                  id="vortex-login-username"
                  name="username"
                  type="text"
                  className="vortex-minimal-input"
                  placeholder="Ingresa tu nombre"
                  value={username}
                  onChange={handleUsernameChange}
                  disabled={isLoading}
                  autoComplete="username"
                  autoFocus
                />
              </div>

              {/* Campo 2: Contraseña */}
              <div className="vortex-minimal-field">
                <label htmlFor="vortex-login-password" className="vortex-minimal-label">
                  Contraseña
                </label>
                <div className="vortex-password-input-row">
                  <input
                    id="vortex-login-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    className="vortex-minimal-input vortex-password-input"
                    placeholder="Ingresa tu contraseña"
                    value={password}
                    onChange={handlePasswordChange}
                    disabled={isLoading}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="vortex-password-toggle-btn"
                    onClick={() => setShowPassword((prev) => !prev)}
                    disabled={isLoading}
                    title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showPassword ? (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                        <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                        <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                        <line x1="2" y1="2" x2="22" y2="22" />
                      </svg>
                    ) : (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Botón para enviar el formulario */}
              <button
                type="submit"
                className={`vortex-hud-submit-btn ${isLoading ? 'is-loading' : ''}`}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <span className="vortex-hud-spinner" aria-hidden="true" />
                    <span>AUTENTICANDO...</span>
                  </>
                ) : (
                  <span>INICIAR SESIÓN</span>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* 3. ADICIONES: OPCIÓN DE REGISTRO DISCRETA EN LA PARTE INFERIOR */}
      <footer className="vortex-bottom-register">
        <span className="vortex-register-text">¿No tienes cuenta?</span>
        <button
          type="button"
          className="vortex-register-link-btn"
          onClick={() => {
            if (typeof onNavigateRegister === 'function') {
              onNavigateRegister();
            }
          }}
        >
          Crear cuenta
        </button>
      </footer>
    </div>
  );
}
