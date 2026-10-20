import React, { useState } from 'react';
import './Login.css';

/**
 * Login Component - VORTEX (HUD Minimalista Circular)
 *
 * Basado en la interfaz técnica de `Mockups/Imagenes UI/iniciar sesion.png`:
 * - Fondo negro sólido y limpio sin degradados ni resplandores
 * - Círculos concéntricos en CSS puro (exterior punteado/dashed, interior sólido fino) en verde neón (#B6F532)
 * - Tipografía "Intel One Mono" aplicada a todos los textos, inputs y botones
 * - Inputs minimalistas sin cajas de fondo
 * - Título superior "VORTEX" sobre el círculo exterior
 * - Enlace inferior interactivo "Crear cuenta" que ejecuta `onNavigateRegister`
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

      setSuccessMessage('Sesión iniciada correctamente.');

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
      {/* 4. ADICIÓN FUERA DEL MOCKUP: Título Superior VORTEX */}
      <header className="vortex-top-header">
        <h1 className="vortex-brand-title">VORTEX</h1>
      </header>

      {/* 2. ESTRUCTURA CIRCULAR MINIMALISTA (CSS Puro) */}
      <div className="vortex-circles-system">
        {/* Círculo exterior punteado (dashed) */}
        <div className="vortex-circle-outer" aria-hidden="true" />

        {/* Círculo interior con borde sólido fino */}
        <div className="vortex-circle-inner">
          {/* 3. CONTENIDO CENTRAL (Formulario) */}
          <div className="vortex-central-content">
            <h2 className="vortex-form-title">Iniciar Sesión</h2>

            {/* Mensajes de feedback accesibles */}
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

            <form className="vortex-minimal-form" onSubmit={handleSubmit} noValidate>
              {/* Campo Nombre */}
              <div className="vortex-field-group">
                <label htmlFor="login-username" className="vortex-field-label">
                  Nombre
                </label>
                <input
                  id="login-username"
                  name="username"
                  type="text"
                  className="vortex-clean-input"
                  placeholder="Ingresa tu nombre"
                  value={username}
                  onChange={handleUsernameChange}
                  disabled={isLoading}
                  autoComplete="username"
                  autoFocus
                />
              </div>

              {/* Campo Contraseña */}
              <div className="vortex-field-group">
                <label htmlFor="login-password" className="vortex-field-label">
                  Contraseña
                </label>
                <div className="vortex-input-with-action">
                  <input
                    id="login-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    className="vortex-clean-input vortex-password-clean-input"
                    placeholder="Ingresa tu contraseña"
                    value={password}
                    onChange={handlePasswordChange}
                    disabled={isLoading}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="vortex-pw-toggle-btn"
                    onClick={() => setShowPassword((prev) => !prev)}
                    disabled={isLoading}
                    title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
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
                className={`vortex-minimal-submit-btn ${isLoading ? 'is-loading' : ''}`}
                disabled={isLoading}
              >
                {isLoading ? 'Autenticando...' : 'Iniciar Sesión'}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* 4. ADICIÓN FUERA DEL MOCKUP: Opción de Registro */}
      <footer className="vortex-bottom-footer">
        <button
          type="button"
          className="vortex-crear-cuenta-btn"
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
