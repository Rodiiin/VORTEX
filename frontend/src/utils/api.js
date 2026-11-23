/**
 * Cliente mínimo para la API de VORTEX.
 * Añade el token de sesión (guardado por Login en localStorage) como
 * cabecera Authorization: Bearer y normaliza los errores.
 */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const readToken = () => {
  try {
    return localStorage.getItem('vortex_token');
  } catch {
    return null;
  }
};

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/**
 * fetch autenticado. Lanza ApiError con `status` (401 = sesión inválida,
 * 0 = sin conexión con el servidor).
 */
export async function apiFetch(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth) {
    const token = readToken();
    if (!token) throw new ApiError('No hay sesión iniciada.', 401);
    headers.Authorization = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('No se pudo conectar con el servidor.', 0);
  }

  if (response.status === 204) return null;
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = typeof data?.detail === 'string' ? data.detail : `Error ${response.status}`;
    throw new ApiError(detail, response.status);
  }
  return data;
}

// Calibración del usuario autenticado
export const saveMyCalibration = (payload) => apiFetch('/api/calibration/me', { method: 'PUT', body: payload });
export const getMyCalibration = () => apiFetch('/api/calibration/me');
export const logoutSession = () => apiFetch('/api/auth/logout', { method: 'POST' });
