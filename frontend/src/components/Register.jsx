import React, { useState } from 'react';
import './Login.css';
import './Register.css';

/**
 * Register Component - VORTEX (Circular HUD Portal)
 *
 * @param {Function} onNavigateLogin - Callback to return to Login view
 * @param {string} apiBaseUrl - Custom base URL for FastAPI backend (optional)
 */
export default function Register({ onNavigateLogin, apiBaseUrl }) {
  // Form input state
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // UI state
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [focusedField, setFocusedField] = useState(null);

  // Active API base URL
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
      // Mostrar banner verde y redirigir tras 2 segundos a Login
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
    <div className="vortex-login-wrapper">
      {/* Luces y mallas de fondo cibernéticas */}
      <div className="cyber-grid-overlay" />
      <div className="login-glow-orb login-glow-orb-top-left" />
      <div className="login-glow-orb login-glow-orb-top-right" />
      <div className="login-glow-orb login-glow-orb-bottom-left" />
      <div className="login-glow-orb login-glow-orb-bottom-right" />
      <div className="login-glow-orb login-glow-orb-center" />

      {/* Contenedor circular HUD */}
      <div className="vortex-circle-portal">
        {/* Anillos orbitales giratorios */}
        <div className="portal-ring portal-ring-outer" />
        <div className="portal-ring portal-ring-middle" />
        <div className="portal-ring portal-ring-glow" />

        {/* Tarjeta esférica central */}
        <div className="vortex-login-card-circle">
          <div className="circle-content-safe-area register-safe-area">
            
            {/* Header: Título "VORTEX", Botón ↩ y Subtítulo "Crear cuenta" */}
            <header className="login-header" style={{ marginBottom: '0.4rem', width: '100%' }}>
              <h1 className="login-title">VORTEX</h1>
              
              <div className="register-subtitle-row">
                <button
                  type="button"
                  className="register-back-btn"
                  onClick={onNavigateLogin}
                  disabled={isLoading}
                  title="Volver al inicio de sesión"
                  aria-label="Volver a la pantalla de Login"
                >
                  ↩
                </button>
                <h2 className="login-subtitle">Crear cuenta</h2>
              </div>
            </header>

            {/* Banner de Éxito verde post-registro */}
            {successMessage && (
              <div className="register-alert register-alert-success" role="status">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>{successMessage}</span>
              </div>
            )}

            {/* Formulario con 4 campos */}
            <form className="register-form" onSubmit={handleSubmit} noValidate>
              
              {/* Campo 1: Username */}
              <div className="form-group">
                <label htmlFor="reg-username" className="form-label">
                  Username
                </label>
                <div
                  className={`cyber-input-wrapper ${
                    focusedField === 'username' ? 'is-focused' : ''
                  } ${isLoading ? 'is-disabled' : ''}`}
                >
                  <span className="input-icon-left">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </span>
                  <input
                    id="reg-username"
                    name="username"
                    type="text"
                    className="cyber-input"
                    placeholder="Ingresa tu nombre de usuario..."
                    value={username}
                    onChange={handleInputChange(setUsername)}
                    onFocus={() => setFocusedField('username')}
                    onBlur={() => setFocusedField(null)}
                    disabled={isLoading || Boolean(successMessage)}
                    autoComplete="username"
                    autoFocus
                  />
                </div>
              </div>

              {/* Campo 2: Email */}
              <div className="form-group">
                <label htmlFor="reg-email" className="form-label">
                  Email
                </label>
                <div
                  className={`cyber-input-wrapper ${
                    focusedField === 'email' ? 'is-focused' : ''
                  } ${isLoading ? 'is-disabled' : ''}`}
                >
                  <span className="input-icon-left">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="20" height="16" x="2" y="4" rx="2" />
                      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                    </svg>
                  </span>
                  <input
                    id="reg-email"
                    name="email"
                    type="email"
                    className="cyber-input"
                    placeholder="correo@ejemplo.com"
                    value={email}
                    onChange={handleInputChange(setEmail)}
                    onFocus={() => setFocusedField('email')}
                    onBlur={() => setFocusedField(null)}
                    disabled={isLoading || Boolean(successMessage)}
                    autoComplete="email"
                  />
                </div>
              </div>

              {/* Campo 3: Password con toggle */}
              <div className="form-group">
                <label htmlFor="reg-password" className="form-label">
                  Password
                </label>
                <div
                  className={`cyber-input-wrapper ${
                    focusedField === 'password' ? 'is-focused' : ''
                  } ${isLoading ? 'is-disabled' : ''}`}
                >
                  <span className="input-icon-left">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </span>
                  <input
                    id="reg-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    className="cyber-input"
                    placeholder="Mínimo 6 caracteres..."
                    value={password}
                    onChange={handleInputChange(setPassword)}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField(null)}
                    disabled={isLoading || Boolean(successMessage)}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="btn-password-toggle"
                    onClick={() => setShowPassword((prev) => !prev)}
                    disabled={isLoading || Boolean(successMessage)}
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

              {/* Campo 4: Confirm Password */}
              <div className="form-group">
                <label htmlFor="reg-confirm-password" className="form-label">
                  Confirm Password
                </label>
                <div
                  className={`cyber-input-wrapper ${
                    focusedField === 'confirmPassword' ? 'is-focused' : ''
                  } ${isLoading ? 'is-disabled' : ''}`}
                >
                  <span className="input-icon-left">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                  </span>
                  <input
                    id="reg-confirm-password"
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    className="cyber-input"
                    placeholder="Repite tu contraseña..."
                    value={confirmPassword}
                    onChange={handleInputChange(setConfirmPassword)}
                    onFocus={() => setFocusedField('confirmPassword')}
                    onBlur={() => setFocusedField(null)}
                    disabled={isLoading || Boolean(successMessage)}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="btn-password-toggle"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    disabled={isLoading || Boolean(successMessage)}
                    title={showConfirmPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    aria-label={showConfirmPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
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

              {/* Botón Principal: CREAR CUENTA / SUBMIT */}
              <button
                type="submit"
                className={`btn-vortex-submit btn-register-submit ${isLoading ? 'is-loading' : ''}`}
                disabled={isLoading || Boolean(successMessage)}
              >
                {isLoading ? (
                  <>
                    <span className="vortex-spinner" aria-hidden="true" />
                    <span>REGISTRANDO...</span>
                  </>
                ) : (
                  <>
                    <span>CREAR CUENTA</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14" />
                      <path d="m12 5 7 7-7 7" />
                    </svg>
                  </>
                )}
              </button>
            </form>

            {/* Mensajes de error claros en texto rojo debajo del formulario */}
            {errorMessage && (
              <div className="register-error-banner" role="alert">
                <span className="register-error-icon">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </span>
                <span className="register-error-text">{errorMessage}</span>
              </div>
            )}

            {/* Footer con link adicional para volver a Login */}
            <footer className="register-footer">
              <p className="login-footer-text">
                <span>¿Ya tienes cuenta?</span>{' '}
                <button
                  type="button"
                  className="btn-link-register"
                  onClick={onNavigateLogin}
                  disabled={isLoading}
                >
                  Iniciar Sesión
                </button>
              </p>
            </footer>

          </div>
        </div>
      </div>
    </div>
  );
}
