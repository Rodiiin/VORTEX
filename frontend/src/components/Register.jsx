import React, { useState } from 'react';
import './Register.css';

/**
 * Register Component - VORTEX (HUD Minimalista Circular)
 *
 * Basado en la misma estética técnica y minimalista de Login:
 * - Fondo negro sólido puro (#000000) sin degradados ni resplandores
 * - Círculos concéntricos en CSS puro (exterior punteado/dashed, interior sólido fino) en verde neón (#B6F532)
 * - Tipografía "Intel One Mono" en todos los textos, inputs y botones
 * - Inputs minimalistas sin cajas de fondo (solo border-bottom)
 * - Título superior "VORTEX" sobre el círculo exterior
 * - Enlace inferior interactivo "¿Ya tienes cuenta? Iniciar Sesión" que ejecuta `onNavigateLogin`
 *
 * @param {Function} onNavigateLogin - Callback para volver a la pantalla de Login
 * @param {string} apiBaseUrl - URL base personalizada para el backend FastAPI (opcional)
 */
export default function Register({ onNavigateLogin, apiBaseUrl }) {
  // Estado de inputs del formulario
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Estado de interfaz y feedback
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Determinar URL base de la API backend
  const baseUrl = apiBaseUrl || import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

  // Expresión regular para validación de formato de correo
  const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  /**
   * Limpiar errores al escribir
   */
  const handleInputChange = (setter) => (e) => {
    setter(e.target.value);
    if (errorMessage) setErrorMessage('');
  };

  /**
   * Validaciones de frontend antes de emitir la petición HTTP
   */
  const validateForm = () => {
    const cleanUsername = username.trim();
    const cleanEmail = email.trim();

    // 1. Verificar que ningún campo esté vacío
    if (!cleanUsername) {
      return 'Por favor, ingresa un nombre de usuario.';
    }
    if (!cleanEmail) {
      return 'Por favor, ingresa tu correo electrónico.';
    }
    if (!password) {
      return 'Por favor, ingresa una contraseña.';
    }
    if (!confirmPassword) {
      return 'Por favor, confirma tu contraseña.';
    }

    // 2. Validar formato de correo mediante expresión regular (Regex)
    if (!EMAIL_REGEX.test(cleanEmail)) {
      return 'El formato del correo electrónico no es válido (ej. piloto@vortex.com).';
    }

    // 3. Comprobar longitud mínima de contraseña (al menos 6 caracteres)
    if (password.length < 6) {
      return 'La contraseña debe contener al menos 6 caracteres.';
    }

    // 4. Comprobar que 'Password' y 'Confirm Password' sean exactamente iguales
    if (password !== confirmPassword) {
      return 'Las contraseñas no coinciden. Por favor, asegúrate de que sean idénticas.';
    }

    return null;
  };

  /**
   * Manejo del envío del formulario e integración con FastAPI
   */
  const handleSubmit = async (e) => {
    e.preventDefault();

    setErrorMessage('');
    setSuccessMessage('');

    // Ejecutar validaciones en frontend
    const validationError = validateForm();
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setIsLoading(true);

    try {
      const endpoint = `${baseUrl}/api/auth/register`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          username: username.trim(),
          email: email.trim().toLowerCase(),
          password: password,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        if (response.status === 400) {
          throw new Error(data?.detail || 'El nombre de usuario o correo ya está registrado.');
        } else if (response.status === 422) {
          const detailMsg = Array.isArray(data?.detail)
            ? data.detail[0]?.msg
            : data?.detail;
          throw new Error(detailMsg || 'Datos con formato inválido.');
        } else {
          throw new Error(data?.detail || data?.message || `Error del servidor (${response.status})`);
        }
      }

      // Éxito HTTP 201 Created:
      setSuccessMessage('¡Cuenta creada con éxito! Redirigiendo al inicio de sesión...');

      setTimeout(() => {
        if (typeof onNavigateLogin === 'function') {
          onNavigateLogin();
        }
      }, 2000);

    } catch (err) {
      console.error('VORTEX Register Error:', err);
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        setErrorMessage('Error de conexión: No se pudo conectar con el servidor VORTEX.');
      } else {
        setErrorMessage(err.message || 'Error inesperado al crear la cuenta.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="vortex-register-container">
      {/* 4. ADICIÓN FUERA DEL CÍRCULO: Título Superior VORTEX */}
      <header className="vortex-top-header">
        <h1 className="vortex-brand-title">VORTEX</h1>
      </header>

      {/* 2. ESTRUCTURA CIRCULAR HUD (CSS Puro) */}
      <div className="vortex-circles-system vortex-register-circles">
        {/* Círculo exterior punteado (dashed) */}
        <div className="vortex-circle-outer" aria-hidden="true" />

        {/* Círculo interior con borde sólido fino */}
        <div className="vortex-circle-inner vortex-register-inner">
          {/* 3. CONTENIDO CENTRAL (Formulario) */}
          <div className="vortex-central-content vortex-register-content">
            <h2 className="vortex-form-title">Crear Cuenta</h2>

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

            <form className="vortex-minimal-form vortex-register-form" onSubmit={handleSubmit} noValidate>
              {/* Campo 1: Nombre */}
              <div className="vortex-field-group">
                <label htmlFor="reg-username" className="vortex-field-label">
                  Nombre
                </label>
                <input
                  id="reg-username"
                  name="username"
                  type="text"
                  className="vortex-clean-input"
                  placeholder="Ingresa tu nombre de usuario"
                  value={username}
                  onChange={handleInputChange(setUsername)}
                  disabled={isLoading || Boolean(successMessage)}
                  autoComplete="username"
                  autoFocus
                />
              </div>

              {/* Campo 2: Correo electrónico */}
              <div className="vortex-field-group">
                <label htmlFor="reg-email" className="vortex-field-label">
                  Correo electrónico
                </label>
                <input
                  id="reg-email"
                  name="email"
                  type="email"
                  className="vortex-clean-input"
                  placeholder="correo@ejemplo.com"
                  value={email}
                  onChange={handleInputChange(setEmail)}
                  disabled={isLoading || Boolean(successMessage)}
                  autoComplete="email"
                />
              </div>

              {/* Campo 3: Contraseña */}
              <div className="vortex-field-group">
                <label htmlFor="reg-password" className="vortex-field-label">
                  Contraseña
                </label>
                <div className="vortex-input-with-action">
                  <input
                    id="reg-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    className="vortex-clean-input vortex-password-clean-input"
                    placeholder="Mínimo 6 caracteres"
                    value={password}
                    onChange={handleInputChange(setPassword)}
                    disabled={isLoading || Boolean(successMessage)}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="vortex-pw-toggle-btn"
                    onClick={() => setShowPassword((prev) => !prev)}
                    disabled={isLoading || Boolean(successMessage)}
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

              {/* Campo 4: Confirmar Contraseña */}
              <div className="vortex-field-group">
                <label htmlFor="reg-confirm-password" className="vortex-field-label">
                  Confirmar Contraseña
                </label>
                <div className="vortex-input-with-action">
                  <input
                    id="reg-confirm-password"
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    className="vortex-clean-input vortex-password-clean-input"
                    placeholder="Repite tu contraseña"
                    value={confirmPassword}
                    onChange={handleInputChange(setConfirmPassword)}
                    disabled={isLoading || Boolean(successMessage)}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="vortex-pw-toggle-btn"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    disabled={isLoading || Boolean(successMessage)}
                    title={showConfirmPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                    aria-label={showConfirmPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                  >
                    {showConfirmPassword ? (
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
                disabled={isLoading || Boolean(successMessage)}
              >
                {isLoading ? 'Registrando...' : 'Crear Cuenta'}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* 4. ADICIÓN FUERA DEL CÍRCULO: Opción de Regreso */}
      <footer className="vortex-bottom-footer">
        <button
          type="button"
          className="vortex-crear-cuenta-btn"
          onClick={() => {
            if (typeof onNavigateLogin === 'function') {
              onNavigateLogin();
            }
          }}
          disabled={isLoading}
        >
          ¿Ya tienes cuenta? Iniciar Sesión
        </button>
      </footer>
    </div>
  );
}
