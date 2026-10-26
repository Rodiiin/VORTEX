import React, { createContext, useContext, useEffect, useState } from 'react';

/**
 * SettingsContext - VORTEX Web Exergame
 *
 * Estado global de preferencias del jugador:
 *  - language: idioma de la interfaz ('es' | 'en'), persistido en 'vortex_lang'.
 *  - volume: volumen general (0-100), persistido en 'vortex_vol'.
 *  - t(key, params): devuelve el texto de la clave en el idioma actual (o la clave si no
 *    existe). Los marcadores {nombre} del texto se reemplazan con los valores de params.
 */

// =========================================================================
// DICCIONARIO DE TRADUCCIONES
// =========================================================================
export const translations = {
  es: {
    // Menú principal
    nueva_partida: 'Nueva Partida',
    continuar_partida: 'Continuar Partida',
    configuracion: 'Configuración',
    salir: 'Salir',
    aria_jugar: 'Nueva Partida o Continuar Partida',
    aria_configuracion: 'Abrir panel de configuración',
    aria_salir: 'Cerrar sesión o salir del juego',

    // Pantalla de configuración
    titulo_config: 'Configuración',
    idioma: 'Idioma',
    idioma_es: 'Español',
    idioma_en: 'Inglés',
    volumen: 'Volumen',
    calibrar: 'Calibrar los sensores',
    atras: 'Atrás',
    aria_atras_menu: 'Volver al menú principal',

    // Login / Registro (compartido)
    campo_nombre: 'Nombre',
    campo_contrasena: 'Contraseña',
    ver_contrasena: 'Ver contraseña',
    ocultar_contrasena: 'Ocultar contraseña',
    error_servidor: 'Error del servidor ({status})',
    error_conexion: 'Error de conexión: No se pudo conectar con el servidor VORTEX.',

    // Login
    login_titulo: 'Iniciar Sesión',
    login_placeholder_nombre: 'Ingresa tu nombre',
    login_placeholder_contrasena: 'Ingresa tu contraseña',
    login_btn: 'Iniciar Sesión',
    login_cargando: 'Autenticando...',
    login_crear_cuenta: 'Crear cuenta',
    login_error_nombre: 'Por favor, ingresa tu nombre de usuario.',
    login_error_contrasena: 'Por favor, ingresa tu contraseña.',
    login_error_credenciales: 'Credenciales inválidas. Verifica tus datos.',
    login_error_404: 'Servicio de autenticación no disponible (404).',
    login_error_formato: 'Formato de credenciales incorrecto.',
    login_exito: 'Sesión iniciada correctamente.',
    login_error_inesperado: 'Error inesperado al iniciar sesión.',

    // Registro
    register_titulo: 'Crear Cuenta',
    campo_correo: 'Correo electrónico',
    campo_confirmar: 'Confirmar Contraseña',
    register_placeholder_nombre: 'Ingresa tu nombre de usuario',
    register_placeholder_correo: 'correo@ejemplo.com',
    register_placeholder_contrasena: 'Mínimo 6 caracteres',
    register_placeholder_confirmar: 'Repite tu contraseña',
    register_btn: 'Crear Cuenta',
    register_cargando: 'Registrando...',
    register_ir_login: '¿Ya tienes cuenta? Iniciar Sesión',
    register_error_nombre: 'Por favor, ingresa un nombre de usuario.',
    register_error_correo: 'Por favor, ingresa tu correo electrónico.',
    register_error_contrasena: 'Por favor, ingresa una contraseña.',
    register_error_confirmar: 'Por favor, confirma tu contraseña.',
    register_error_formato_correo: 'El formato del correo electrónico no es válido (ej. piloto@vortex.com).',
    register_error_longitud: 'La contraseña debe contener al menos 6 caracteres.',
    register_error_no_coinciden: 'Las contraseñas no coinciden. Por favor, asegúrate de que sean idénticas.',
    register_error_duplicado: 'El nombre de usuario o correo ya está registrado.',
    register_error_datos: 'Datos con formato inválido.',
    register_exito: '¡Cuenta creada con éxito! Redirigiendo al inicio de sesión...',
    register_error_inesperado: 'Error inesperado al crear la cuenta.',

    // Niveles
    niveles_titulo: 'Niveles',
    niveles_aria_carrusel: 'Selección de niveles',
    niveles_puntuacion: 'Puntuación',
    niveles_tutorial: 'Tutorial',
    nivel_n: 'Nivel {n}',
    capitulo_n: 'Capítulo {n}',
    niveles_aria_jugar: 'Jugar {nombre}, {capitulo}',

    // Calibración
    calib_aria_panel: 'Panel de calibración',
    calib_aria_progreso: 'Progreso de calibración',
    calib_fase: 'Fase',
    calib_postura: 'Postura',
    calib_postura_ok: 'Correcta',
    calib_postura_no: 'No detectada',
    calib_paso_deteccion: 'Detección',
    calib_paso_neutro: 'Neutro',
    calib_paso_jab: 'Jab',
    calib_paso_gancho: 'Gancho',
    calib_paso_esquiva: 'Esquiva',
    calib_paso_listo: 'Listo',
    calib_fase_0: 'Detección de presencia',
    calib_fase_1: 'Posición neutra',
    calib_fase_2: 'Calibrar Jab',
    calib_fase_3: 'Calibrar Gancho',
    calib_fase_4: 'Calibrar Esquiva',
    calib_fase_5: 'Calibración completada',
    calib_paso_de: 'Paso {n} de 4',
    calib_instr_0: 'Colócate frente a la cámara de forma que tus hombros y torso sean visibles. La IA confirmará tu posición para iniciar.',
    calib_instr_1: 'Ponte en guardia relajada mirando al frente. El temporizador capturará automáticamente tu centro de gravedad durante 2 segundos.',
    calib_instr_2: 'Extiende tu brazo frontal completamente hacia adelante (golpe recto Jab). Se guardará la distancia máxima y el umbral al 80%.',
    calib_instr_3: 'Ejecuta un Gancho circular manteniendo el codo flexionado (~90°). Registraremos el ángulo y tu rango lateral.',
    calib_instr_4: 'Inclina tu torso hacia la izquierda y luego hacia la derecha para registrar el umbral de desplazamiento lateral respecto al centro.',
    calib_instr_5: 'Tus movimientos y rangos fueron calculados exitosamente. Ahora tu juego estará optimizado a tu cuerpo.',
    calib_hombros: 'Hombros detectados',
    calib_visibles: 'Visibles',
    calib_no_detectados: 'No detectados',
    calib_btn_iniciar: 'Iniciar calibración',
    calib_btn_esperando: 'Esperando detección...',
    calib_tiempo: 'Tiempo restante',
    calib_sensor: 'Sensor',
    calib_muestreando: 'Muestreando...',
    calib_pausado: 'Pausado',
    calib_btn_reiniciar: 'Reiniciar contador (2s)',
    calib_ext_actual: 'Extensión actual',
    calib_ext_max: 'Extensión máxima',
    calib_btn_jab: 'Confirmar Jab',
    calib_angulo: 'Ángulo de codo',
    calib_rango: 'Rango lateral (X)',
    calib_btn_gancho: 'Confirmar Gancho',
    calib_desplazamiento: 'Desplazamiento X',
    calib_max_lr: 'Máx izq. / der.',
    calib_btn_esquiva: 'Confirmar Esquiva',
    calib_lista: 'Calibración lista',
    calib_umbral_jab: 'Umbral Jab',
    calib_angulo_gancho: 'Ángulo Gancho',
    calib_rango_gancho: 'Rango Gancho X',
    calib_umbral_esquiva: 'Umbral Esquiva',
    calib_btn_pelear: '¡Listo para pelear!',
    calib_no_usuario: 'No se detecta usuario',
  },
  en: {
    // Main menu
    nueva_partida: 'New Game',
    continuar_partida: 'Continue Game',
    configuracion: 'Settings',
    salir: 'Exit',
    aria_jugar: 'New Game or Continue Game',
    aria_configuracion: 'Open settings panel',
    aria_salir: 'Log out or exit the game',

    // Settings screen
    titulo_config: 'Settings',
    idioma: 'Language',
    idioma_es: 'Spanish',
    idioma_en: 'English',
    volumen: 'Volume',
    calibrar: 'Calibrate sensors',
    atras: 'Back',
    aria_atras_menu: 'Back to main menu',

    // Login / Register (shared)
    campo_nombre: 'Name',
    campo_contrasena: 'Password',
    ver_contrasena: 'Show password',
    ocultar_contrasena: 'Hide password',
    error_servidor: 'Server error ({status})',
    error_conexion: 'Connection error: Could not reach the VORTEX server.',

    // Login
    login_titulo: 'Log In',
    login_placeholder_nombre: 'Enter your name',
    login_placeholder_contrasena: 'Enter your password',
    login_btn: 'Log In',
    login_cargando: 'Authenticating...',
    login_crear_cuenta: 'Create account',
    login_error_nombre: 'Please enter your username.',
    login_error_contrasena: 'Please enter your password.',
    login_error_credenciales: 'Invalid credentials. Please check your details.',
    login_error_404: 'Authentication service unavailable (404).',
    login_error_formato: 'Invalid credentials format.',
    login_exito: 'Logged in successfully.',
    login_error_inesperado: 'Unexpected error while logging in.',

    // Register
    register_titulo: 'Create Account',
    campo_correo: 'Email',
    campo_confirmar: 'Confirm Password',
    register_placeholder_nombre: 'Enter a username',
    register_placeholder_correo: 'email@example.com',
    register_placeholder_contrasena: 'At least 6 characters',
    register_placeholder_confirmar: 'Repeat your password',
    register_btn: 'Create Account',
    register_cargando: 'Registering...',
    register_ir_login: 'Already have an account? Log In',
    register_error_nombre: 'Please enter a username.',
    register_error_correo: 'Please enter your email.',
    register_error_contrasena: 'Please enter a password.',
    register_error_confirmar: 'Please confirm your password.',
    register_error_formato_correo: 'The email format is not valid (e.g. pilot@vortex.com).',
    register_error_longitud: 'The password must be at least 6 characters long.',
    register_error_no_coinciden: 'The passwords do not match. Please make sure they are identical.',
    register_error_duplicado: 'The username or email is already registered.',
    register_error_datos: 'Invalid data format.',
    register_exito: 'Account created successfully! Redirecting to log in...',
    register_error_inesperado: 'Unexpected error while creating the account.',

    // Levels
    niveles_titulo: 'Levels',
    niveles_aria_carrusel: 'Level selection',
    niveles_puntuacion: 'Score',
    niveles_tutorial: 'Tutorial',
    nivel_n: 'Level {n}',
    capitulo_n: 'Chapter {n}',
    niveles_aria_jugar: 'Play {nombre}, {capitulo}',

    // Calibration
    calib_aria_panel: 'Calibration panel',
    calib_aria_progreso: 'Calibration progress',
    calib_fase: 'Phase',
    calib_postura: 'Posture',
    calib_postura_ok: 'Correct',
    calib_postura_no: 'Not detected',
    calib_paso_deteccion: 'Detect',
    calib_paso_neutro: 'Neutral',
    calib_paso_jab: 'Jab',
    calib_paso_gancho: 'Hook',
    calib_paso_esquiva: 'Dodge',
    calib_paso_listo: 'Ready',
    calib_fase_0: 'Presence detection',
    calib_fase_1: 'Neutral position',
    calib_fase_2: 'Calibrate Jab',
    calib_fase_3: 'Calibrate Hook',
    calib_fase_4: 'Calibrate Dodge',
    calib_fase_5: 'Calibration complete',
    calib_paso_de: 'Step {n} of 4',
    calib_instr_0: 'Stand in front of the camera so your shoulders and torso are visible. The AI will confirm your position to begin.',
    calib_instr_1: 'Take a relaxed guard stance facing forward. The timer will automatically capture your center of gravity for 2 seconds.',
    calib_instr_2: 'Fully extend your lead arm forward (straight Jab). The maximum reach and the 80% threshold will be saved.',
    calib_instr_3: 'Throw a circular Hook keeping your elbow bent (~90°). We will record the angle and your lateral range.',
    calib_instr_4: 'Lean your torso to the left and then to the right to record the lateral displacement threshold from the center.',
    calib_instr_5: 'Your movements and ranges were calculated successfully. Your game is now tuned to your body.',
    calib_hombros: 'Shoulders detected',
    calib_visibles: 'Visible',
    calib_no_detectados: 'Not detected',
    calib_btn_iniciar: 'Start calibration',
    calib_btn_esperando: 'Waiting for detection...',
    calib_tiempo: 'Time left',
    calib_sensor: 'Sensor',
    calib_muestreando: 'Sampling...',
    calib_pausado: 'Paused',
    calib_btn_reiniciar: 'Restart timer (2s)',
    calib_ext_actual: 'Current reach',
    calib_ext_max: 'Maximum reach',
    calib_btn_jab: 'Confirm Jab',
    calib_angulo: 'Elbow angle',
    calib_rango: 'Lateral range (X)',
    calib_btn_gancho: 'Confirm Hook',
    calib_desplazamiento: 'Displacement X',
    calib_max_lr: 'Max left / right',
    calib_btn_esquiva: 'Confirm Dodge',
    calib_lista: 'Calibration ready',
    calib_umbral_jab: 'Jab threshold',
    calib_angulo_gancho: 'Hook angle',
    calib_rango_gancho: 'Hook range X',
    calib_umbral_esquiva: 'Dodge threshold',
    calib_btn_pelear: 'Ready to fight!',
    calib_no_usuario: 'No user detected',
  },
};

const DEFAULT_LANGUAGE = 'es';
const DEFAULT_VOLUME = 70;
const LANG_STORAGE_KEY = 'vortex_lang';
const VOLUME_STORAGE_KEY = 'vortex_vol';

// Lectura segura de localStorage (puede fallar en modo privado o con datos corruptos)
const readStoredLanguage = () => {
  try {
    const stored = localStorage.getItem(LANG_STORAGE_KEY);
    return stored && translations[stored] ? stored : DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
};

const readStoredVolume = () => {
  try {
    const stored = localStorage.getItem(VOLUME_STORAGE_KEY);
    if (stored === null) return DEFAULT_VOLUME;
    const parsed = Number(stored);
    return Number.isFinite(parsed) ? Math.min(100, Math.max(0, parsed)) : DEFAULT_VOLUME;
  } catch {
    return DEFAULT_VOLUME;
  }
};

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  // Inicialización perezosa: se lee localStorage una sola vez al montar
  const [language, setLanguage] = useState(readStoredLanguage);
  const [volume, setVolume] = useState(readStoredVolume);

  useEffect(() => {
    try {
      localStorage.setItem(LANG_STORAGE_KEY, language);
    } catch {
      // Sin persistencia disponible: el idioma sigue funcionando en memoria
    }
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    try {
      localStorage.setItem(VOLUME_STORAGE_KEY, String(volume));
    } catch {
      // Sin persistencia disponible: el volumen sigue funcionando en memoria
    }
  }, [volume]);

  const t = (key, params) => {
    const text = translations[language]?.[key] ?? key;
    if (!params) return text;
    return text.replace(/\{(\w+)\}/g, (match, name) => (
      params[name] !== undefined ? String(params[name]) : match
    ));
  };

  return (
    <SettingsContext.Provider value={{ language, setLanguage, volume, setVolume, t }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);
