import React, { useState, useEffect, useRef } from 'react';
import * as mpPose from '@mediapipe/pose';
import * as mpCamera from '@mediapipe/camera_utils';
import {
  calculateDistance,
  calculateAngle,
  getTorsoCenter,
  drawCyberSkeleton
} from '../utils/poseMath';
import guanteIzq from '../assets/guante-izq.png';
import guanteDer from '../assets/guante-der.png';
import './Calibration.css';

// Resolución resiliente de constructores MediaPipe en entornos Vite / ESM
const PoseConstructor = mpPose.Pose || (mpPose.default && mpPose.default.Pose) || window.Pose;
const CameraConstructor = mpCamera.Camera || (mpCamera.default && mpCamera.default.Camera) || window.Camera;

// =========================================================================
// GUANTES EN PRIMERA PERSONA
// Las imágenes de los guantes (1440x1024) tienen margen transparente; el
// ancla es la posición del puño dentro de la imagen (fracción 0-1). La
// muñeca detectada se coloca sobre ese punto.
// =========================================================================
const GLOVE_ANCHORS = {
  left: { x: 0.52, y: 0.2 },
  right: { x: 0.375, y: 0.225 },
};

// Posición de guardia por defecto (normalizada) antes de detectar al usuario
const GLOVE_REST = {
  left: { nx: 0.36, ny: 0.72, scale: 1 },
  right: { nx: 0.64, ny: 0.72, scale: 1 },
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

// Etiquetas de cada fase para el panel HUD
const PHASES = [
  { id: 0, label: 'Detección' },
  { id: 1, label: 'Neutro' },
  { id: 2, label: 'Jab' },
  { id: 3, label: 'Gancho' },
  { id: 4, label: 'Esquiva' },
  { id: 5, label: 'Listo' },
];

const PHASE_TITLES = {
  0: 'Detección de presencia',
  1: 'Posición neutra',
  2: 'Calibrar Jab',
  3: 'Calibrar Gancho',
  4: 'Calibrar Esquiva',
  5: 'Calibración completada',
};

/**
 * Componente de Calibración Biomecánica - VORTEX Exergame
 *
 * Arquitectura de ciclo de vida optimizada:
 * - Inicialización única (useEffect []) para evitar la creación/destrucción repetida de contextos WebGL.
 * - Variables de tiempo, fase y conteo gestionadas con useRef para evitar Stale Closures a 30 FPS.
 * - Temporizador del Paso 1 basado en Date.now() independiente de re-renders de React.
 * - Logs detallados por consola en cada paso para diagnóstico con F12.
 */
export default function Calibration({ onCalibrationComplete, onBackToMenu }) {
  // Estado visible en UI (renderizado de React)
  const [currentStep, setCurrentStep] = useState(0);
  const [isUserPresent, setIsUserPresent] = useState(false);
  const [calibratedParams, setCalibratedParams] = useState({
    neutralTorso: null,
    jab: { maxReach: 0, threshold: 0 },
    hook: { elbowAngle: 0, lateralRange: 0 },
    dodge: { maxLeanLeft: 0, maxLeanRight: 0, threshold: 0 }
  });
  const [liveMetrics, setLiveMetrics] = useState({
    jabExtension: 0,
    hookAngle: 0,
    hookRange: 0,
    dodgeDisplacement: 0,
    progressPercent: 0,
    countdownSeconds: 2.0
  });

  // =========================================================================
  // GESTIÓN DE ESTADO MUTABLE CON USE_REF (A PRUEBA DE 30 FPS & STALE CLOSURES)
  // =========================================================================
  const stepRef = useRef(0);
  const isUserPresentRef = useRef(false);
  const isCapturingRef = useRef(false);
  const lastUiUpdateRef = useRef(0);

  // Parámetros calculados en tiempo real
  const neutralTorsoRef = useRef(null);
  const calibratedParamsRef = useRef({
    neutralTorso: null,
    jab: { maxReach: 0, threshold: 0 },
    hook: { elbowAngle: 0, lateralRange: 0 },
    dodge: { maxLeanLeft: 0, maxLeanRight: 0, threshold: 0 }
  });

  // Temporizador para Paso 1 (Posición Neutra) basado en Date.now()
  const neutralTimerRef = useRef({
    startTime: null,
    samples: [],
    lastLoggedSec: -1
  });

  // Buffer de mediciones para Jab, Hook y Dodge
  const metricsBufferRef = useRef({
    maxReach: 0,
    bestHookAngle: 0,
    maxHookRange: 0,
    maxDodgeLeft: 0,
    maxDodgeRight: 0
  });

  // Referencias a elementos DOM e instancias de MediaPipe
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const cameraInstanceRef = useRef(null);
  const poseInstanceRef = useRef(null);

  // Guantes: elementos <img> y última posición normalizada de cada mano
  const leftGloveRef = useRef(null);
  const rightGloveRef = useRef(null);
  const glovePoseRef = useRef({
    left: { ...GLOVE_REST.left },
    right: { ...GLOVE_REST.right },
  });

  // Escribe el transform directamente en el DOM (sin re-render de React a 30 FPS)
  const applyGloveTransform = (side) => {
    const el = side === 'left' ? leftGloveRef.current : rightGloveRef.current;
    if (!el) return;

    const { nx, ny, scale } = glovePoseRef.current[side];
    const anchor = GLOVE_ANCHORS[side];
    const x = nx * window.innerWidth - anchor.x * el.offsetWidth;
    const y = ny * window.innerHeight - anchor.y * el.offsetHeight;

    el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${scale.toFixed(3)})`;
  };

  // Sincronizar stepRef con el cambio de paso desde UI
  const setStep = (newStep) => {
    console.log(`[VORTEX] Transición de paso: ${stepRef.current} -> ${newStep}`);
    stepRef.current = newStep;
    setCurrentStep(newStep);

    // Reiniciar buffers al cambiar de paso
    if (newStep === 1) {
      isCapturingRef.current = true;
      neutralTimerRef.current = { startTime: null, samples: [], lastLoggedSec: -1 };
    } else if (newStep === 2) {
      isCapturingRef.current = true;
      metricsBufferRef.current.maxReach = 0;
    } else if (newStep === 3) {
      isCapturingRef.current = true;
      metricsBufferRef.current.bestHookAngle = 0;
      metricsBufferRef.current.maxHookRange = 0;
    } else if (newStep === 4) {
      isCapturingRef.current = true;
      metricsBufferRef.current.maxDodgeLeft = 0;
      metricsBufferRef.current.maxDodgeRight = 0;
    } else {
      isCapturingRef.current = false;
    }
  };

  // Colocar los guantes en guardia al montar y recolocarlos al redimensionar
  useEffect(() => {
    const placeGloves = () => {
      applyGloveTransform('left');
      applyGloveTransform('right');
    };
    placeGloves();
    window.addEventListener('resize', placeGloves);
    return () => window.removeEventListener('resize', placeGloves);
  }, []);

  // =========================================================================
  // CICLO DE VIDA: INICIALIZACIÓN ÚNICA DE MEDIAPIPE Y CÁMARA (DEPENDENCIAS [])
  // =========================================================================
  useEffect(() => {
    let isMounted = true;
    console.log('[VORTEX] 🟢 Montando Calibration. Inicializando MediaPipe Pose y Cámara una sola vez...');

    const videoElement = videoRef.current;
    const canvasElement = canvasRef.current;

    if (!videoElement || !canvasElement) {
      console.error('[VORTEX] ❌ Elementos video o canvas no disponibles.');
      return;
    }

    const canvasCtx = canvasElement.getContext('2d');

    // 1. Instanciar Pose con modelo 'lite' para 30 FPS óptimos
    const pose = new PoseConstructor({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
    });

    pose.setOptions({
      modelComplexity: 0, // 'lite' model a 30 FPS
      smoothLandmarks: true,
      enableSegmentation: false,
      smoothSegmentation: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    poseInstanceRef.current = pose;

    // 2. Callback onResults ejecutado a 30 FPS
    pose.onResults((results) => {
      if (!isMounted || !canvasElement || !canvasCtx) return;

      const { image, poseLandmarks } = results;
      const width = canvasElement.width;
      const height = canvasElement.height;

      // Dibujar imagen de la cámara en canvas (modo espejo)
      canvasCtx.clearRect(0, 0, width, height);
      canvasCtx.save();
      canvasCtx.drawImage(image, 0, 0, width, height);
      canvasCtx.restore();

      // =====================================================================
      // PASO 0: DETECCIÓN DE PRESENCIA (Landmarks 11 y 12 visibles)
      // =====================================================================
      let detected = false;
      if (poseLandmarks && poseLandmarks.length > 12) {
        const leftShoulder = poseLandmarks[11];
        const rightShoulder = poseLandmarks[12];
        const leftVis = leftShoulder?.visibility ?? 0;
        const rightVis = rightShoulder?.visibility ?? 0;

        if (leftVis > 0.45 && rightVis > 0.45) {
          detected = true;
        }
      }

      // Actualizar estado de presencia sólo cuando cambie (evitar 30 re-renders/seg)
      if (isUserPresentRef.current !== detected) {
        isUserPresentRef.current = detected;
        setIsUserPresent(detected);

        if (detected) {
          console.log('[VORTEX] Usuario detectado frente a la cámara.');
        } else {
          console.warn('[VORTEX] No se detecta usuario frente a la cámara.');
        }
      }

      // Si no hay detección válida, detener cualquier contador activo
      if (!detected || !poseLandmarks) {
        if (stepRef.current === 1 && neutralTimerRef.current.startTime) {
          console.warn('[VORTEX] ⏸️ Hombros no visibles. Pausando temporizador de Posición Neutra.');
          neutralTimerRef.current.startTime = null;
          neutralTimerRef.current.samples = [];
          setLiveMetrics((prev) => ({ ...prev, countdownSeconds: 2.0, progressPercent: 0 }));
        }
        return;
      }

      // =====================================================================
      // MAPEO MUÑECAS -> GUANTES (Landmarks 15 y 16)
      // Modo espejo: la mano izquierda del usuario se ve a la izquierda.
      // La Z de la muñeca relativa al hombro simula profundidad: al golpear
      // hacia la cámara el guante crece.
      // =====================================================================
      [
        { side: 'left', wrist: poseLandmarks[15], shoulder: poseLandmarks[11] },
        { side: 'right', wrist: poseLandmarks[16], shoulder: poseLandmarks[12] },
      ].forEach(({ side, wrist, shoulder }) => {
        if (!wrist || (wrist.visibility ?? 0) < 0.3) return;

        const depth = shoulder ? wrist.z - shoulder.z : 0;
        glovePoseRef.current[side] = {
          nx: clamp(1 - wrist.x, 0, 1),
          ny: clamp(wrist.y, 0, 1),
          scale: clamp(1 - depth * 0.5, 0.85, 1.45),
        };
        applyGloveTransform(side);
      });

      // Calcular centro actual del torso
      const currentTorso = getTorsoCenter(poseLandmarks);

      // Dibujar esqueleto cibernético en tiempo real
      drawCyberSkeleton(canvasCtx, poseLandmarks, width, height, {
        showTorsoCenter: stepRef.current === 1,
        torsoCenter: currentTorso,
        neutralCenter: neutralTorsoRef.current
      });

      const now = Date.now();
      const currentStepNum = stepRef.current;

      // =====================================================================
      // PASO 1: POSICIÓN NEUTRA (2 SEGUNDOS REALES CON DATE.NOW)
      // =====================================================================
      if (currentStepNum === 1 && isCapturingRef.current && currentTorso) {
        const timer = neutralTimerRef.current;

        if (!timer.startTime) {
          timer.startTime = now;
          timer.samples = [];
          timer.lastLoggedSec = -1;
          console.log('[VORTEX] Iniciando temporizador de Posición Neutra (2.0 segundos requeridos)...');
        }

        timer.samples.push(currentTorso);
        const elapsedSec = (now - timer.startTime) / 1000;
        const remaining = Math.max(0, 2.0 - elapsedSec);
        const percent = Math.min(100, (elapsedSec / 2.0) * 100);

        // Logging en consola cada 0.5s para monitoreo en F12
        const currentHalfSec = Math.floor(elapsedSec * 2) / 2;
        if (currentHalfSec !== timer.lastLoggedSec) {
          console.log(`[VORTEX] Paso 1 - Posición Neutra: ${elapsedSec.toFixed(1)}s / 2.0s (${timer.samples.length} muestras recolectadas)`);
          timer.lastLoggedSec = currentHalfSec;
        }

        // Actualizar UI throttled (~15 FPS)
        if (now - lastUiUpdateRef.current > 66) {
          lastUiUpdateRef.current = now;
          setLiveMetrics((prev) => ({
            ...prev,
            countdownSeconds: Number(remaining.toFixed(1)),
            progressPercent: percent
          }));
        }

        // Al cumplirse los 2 segundos exactos
        if (elapsedSec >= 2.0 && timer.samples.length >= 15) {
          const samples = timer.samples;
          const avgX = samples.reduce((acc, s) => acc + s.x, 0) / samples.length;
          const avgY = samples.reduce((acc, s) => acc + s.y, 0) / samples.length;
          const avgZ = samples.reduce((acc, s) => acc + s.z, 0) / samples.length;

          const neutral = {
            x: Number(avgX.toFixed(3)),
            y: Number(avgY.toFixed(3)),
            z: Number(avgZ.toFixed(3))
          };

          neutralTorsoRef.current = neutral;
          calibratedParamsRef.current.neutralTorso = neutral;
          setCalibratedParams((prev) => ({ ...prev, neutralTorso: neutral }));

          console.log('[VORTEX] Paso 1 Completado Coordenadas base del torso:', neutral);
          console.log('[VORTEX] Avanzando automáticamente al Paso 2: Calibración de Jab.');

          setStep(2);
        }
      }

      // =====================================================================
      // PASO 2: CALIBRAR JAB (Extensión frontal hombro-muñeca)
      // =====================================================================
      if (currentStepNum === 2 && isCapturingRef.current) {
        const leftReach = calculateDistance(poseLandmarks[11], poseLandmarks[15], true);
        const rightReach = calculateDistance(poseLandmarks[12], poseLandmarks[16], true);
        const currentReach = Math.max(leftReach, rightReach);

        if (currentReach > metricsBufferRef.current.maxReach) {
          metricsBufferRef.current.maxReach = currentReach;
        }

        if (now - lastUiUpdateRef.current > 66) {
          lastUiUpdateRef.current = now;
          const max = metricsBufferRef.current.maxReach;
          setLiveMetrics((prev) => ({
            ...prev,
            jabExtension: Number(currentReach.toFixed(2)),
            progressPercent: max > 0 ? Math.min(100, (currentReach / max) * 100) : 0
          }));
        }
      }

      // =====================================================================
      // PASO 3: CALIBRAR GANCHO (Ángulo codo ~90° y rango lateral X)
      // =====================================================================
      if (currentStepNum === 3 && isCapturingRef.current) {
        const leftAngle = calculateAngle(poseLandmarks[11], poseLandmarks[13], poseLandmarks[15]);
        const rightAngle = calculateAngle(poseLandmarks[12], poseLandmarks[14], poseLandmarks[16]);
        const leftRange = Math.abs(poseLandmarks[15].x - poseLandmarks[11].x);
        const rightRange = Math.abs(poseLandmarks[16].x - poseLandmarks[12].x);

        const activeAngle = leftRange > rightRange ? leftAngle : rightAngle;
        const activeRange = Math.max(leftRange, rightRange);

        if (activeAngle >= 65 && activeAngle <= 120 && activeRange > metricsBufferRef.current.maxHookRange) {
          metricsBufferRef.current.bestHookAngle = activeAngle;
          metricsBufferRef.current.maxHookRange = activeRange;
        }

        if (now - lastUiUpdateRef.current > 66) {
          lastUiUpdateRef.current = now;
          setLiveMetrics((prev) => ({
            ...prev,
            hookAngle: activeAngle,
            hookRange: Number(activeRange.toFixed(2)),
            progressPercent: Math.min(100, (activeRange / 0.4) * 100)
          }));
        }
      }

      // =====================================================================
      // PASO 4: CALIBRAR ESQUIVA (Desplazamiento X lateral vs neutro)
      // =====================================================================
      if (currentStepNum === 4 && isCapturingRef.current && neutralTorsoRef.current && currentTorso) {
        const deltaX = currentTorso.x - neutralTorsoRef.current.x;

        if (deltaX < 0 && Math.abs(deltaX) > metricsBufferRef.current.maxDodgeLeft) {
          metricsBufferRef.current.maxDodgeLeft = Math.abs(deltaX);
        } else if (deltaX > 0 && deltaX > metricsBufferRef.current.maxDodgeRight) {
          metricsBufferRef.current.maxDodgeRight = deltaX;
        }

        const currentDisp = Math.abs(deltaX);

        if (now - lastUiUpdateRef.current > 66) {
          lastUiUpdateRef.current = now;
          setLiveMetrics((prev) => ({
            ...prev,
            dodgeDisplacement: Number(currentDisp.toFixed(3)),
            progressPercent: Math.min(100, (currentDisp / 0.08) * 100)
          }));
        }
      }
    });

    // 3. Iniciar cámara con MediaPipe Camera
    const camera = new CameraConstructor(videoElement, {
      onFrame: async () => {
        if (isMounted && videoElement && videoElement.readyState >= 2) {
          try {
            await pose.send({ image: videoElement });
          } catch (err) {
            console.error('[VORTEX] Error al enviar frame a MediaPipe:', err);
          }
        }
      },
      width: 640,
      height: 480,
    });

    cameraInstanceRef.current = camera;
    camera.start().then(() => {
      console.log('[VORTEX] Cámara conectada.');
    }).catch((err) => {
      console.error('[VORTEX] Error al iniciar cámara:', err);
    });

    // 4. Limpieza estricta sólo al desmontar el componente
    return () => {
      console.log('[VORTEX] Desmontando Calibration. Liberando WebGL y cámara...');
      isMounted = false;
      if (cameraInstanceRef.current) {
        try { cameraInstanceRef.current.stop(); } catch (e) {}
      }
      if (poseInstanceRef.current) {
        try { poseInstanceRef.current.close(); } catch (e) {}
      }
      if (videoElement && videoElement.srcObject) {
        const stream = videoElement.srcObject;
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []); // <--- ARREGLO DE DEPENDENCIAS VACÍO: Garantiza inicialización única

  // =========================================================================
  // BOTONES Y CONFIRMACIONES DE CADA PASO
  // =========================================================================
  const handleConfirmJab = () => {
    const max = metricsBufferRef.current.maxReach || liveMetrics.jabExtension || 0.45;
    const threshold = Number((max * 0.8).toFixed(3));
    const jabData = { maxReach: Number(max.toFixed(3)), threshold };

    calibratedParamsRef.current.jab = jabData;
    setCalibratedParams((prev) => ({ ...prev, jab: jabData }));

    console.log(`[VORTEX] Paso 2 Completado. Jab calibrado -> Alcance Máx: ${max.toFixed(3)}, Umbral 80%: ${threshold}`);
    setStep(3);
  };

  const handleConfirmHook = () => {
    const angle = metricsBufferRef.current.bestHookAngle || liveMetrics.hookAngle || 88;
    const range = metricsBufferRef.current.maxHookRange || liveMetrics.hookRange || 0.28;
    const hookData = { elbowAngle: angle, lateralRange: Number(range.toFixed(3)) };

    calibratedParamsRef.current.hook = hookData;
    setCalibratedParams((prev) => ({ ...prev, hook: hookData }));

    console.log(`[VORTEX] Paso 3 Completado. Gancho calibrado -> Ángulo Codo: ${angle}°, Rango X: ${range.toFixed(3)}`);
    setStep(4);
  };

  const handleConfirmDodge = () => {
    const left = metricsBufferRef.current.maxDodgeLeft || 0.07;
    const right = metricsBufferRef.current.maxDodgeRight || 0.07;
    const avg = (left + right) / 2;
    const threshold = Number(Math.max(0.05, avg * 0.75).toFixed(3));
    const dodgeData = {
      maxLeanLeft: Number(left.toFixed(3)),
      maxLeanRight: Number(right.toFixed(3)),
      threshold
    };

    calibratedParamsRef.current.dodge = dodgeData;
    setCalibratedParams((prev) => ({ ...prev, dodge: dodgeData }));

    console.log(`[VORTEX] Paso 4 Completado. Esquiva calibrada -> Umbral Desplazamiento X: ${threshold}`);
    console.log('[VORTEX] ¡Todos los pasos de calibración completados exitosamente!', calibratedParamsRef.current);
    setStep(5);
  };

  const handleReadyToFight = () => {
    console.log('[VORTEX] Navegando a GameEngine con los parámetros calibrados:', calibratedParamsRef.current);
    if (typeof onCalibrationComplete === 'function') {
      onCalibrationComplete(calibratedParamsRef.current);
    }
  };

  return (
    <div className="calibration-wrapper">
      {/* Botón Atrás (esquina superior izquierda) */}
      <button
        type="button"
        className="btn-calib-back"
        onClick={onBackToMenu}
        aria-label="Volver al menú principal"
      >
        Atrás
      </button>

      {/* =====================================================================
          ESCENA EN PRIMERA PERSONA: GUANTES CONTROLADOS POR LAS MUÑECAS
          ===================================================================== */}
      <div className="calibration-scene" aria-hidden="true">
        <img
          ref={leftGloveRef}
          src={guanteIzq}
          alt=""
          className="calibration-glove glove-left"
          draggable={false}
        />
        <img
          ref={rightGloveRef}
          src={guanteDer}
          alt=""
          className="calibration-glove glove-right"
          draggable={false}
        />
      </div>

      {/* =====================================================================
          PANEL HUD LATERAL: FASE, POSTURA, PASOS E INSTRUCCIONES
          ===================================================================== */}
      <aside className="calibration-panel" aria-label="Panel de calibración">
        <div className="hud-status">
          <div className="hud-status-row">
            <span className="hud-status-label">Fase</span>
            <span className="hud-status-value">{PHASE_TITLES[currentStep]}</span>
          </div>
          <div className="hud-status-row">
            <span className="hud-status-label">Postura</span>
            <span className={`hud-status-value ${isUserPresent ? 'is-ok' : 'is-bad'}`}>
              {isUserPresent ? 'Correcta' : 'No detectada'}
            </span>
          </div>
        </div>

        {/* Stepper de fases */}
        <ol className="calibration-stepper" aria-label="Progreso de calibración">
          {PHASES.map((st) => (
            <li
              key={st.id}
              className={`step-item ${currentStep === st.id ? 'is-active' : ''} ${
                currentStep > st.id ? 'is-completed' : ''
              }`}
              aria-current={currentStep === st.id ? 'step' : undefined}
            >
              <span className="step-number">{currentStep > st.id ? '✓' : st.id}</span>
              <span className="step-label">{st.label}</span>
            </li>
          ))}
        </ol>

        <section className="calibration-step-body">
          {/* PASO 0: DETECCIÓN DE PRESENCIA */}
          {currentStep === 0 && (
            <>
              <div className="step-info-header">
                <span className="step-tag">Paso 0 de 4</span>
                <p className="step-instruction">
                  Colócate frente a la cámara de forma que tus hombros y torso sean visibles. La IA confirmará tu posición para iniciar.
                </p>
              </div>

              <div className="step-metric-panel">
                <div className="metric-row">
                  <span className="metric-label">Hombros detectados</span>
                  <span className={`metric-value ${isUserPresent ? 'is-ok' : 'is-bad'}`}>
                    {isUserPresent ? 'Visibles' : 'No detectados'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                className="btn-calib-action"
                disabled={!isUserPresent}
                onClick={() => setStep(1)}
              >
                {isUserPresent ? 'Iniciar calibración' : 'Esperando detección...'}
              </button>
            </>
          )}

          {/* PASO 1: POSICIÓN NEUTRA */}
          {currentStep === 1 && (
            <>
              <div className="step-info-header">
                <span className="step-tag">Paso 1 de 4</span>
                <p className="step-instruction">
                  Ponte en guardia relajada mirando al frente. El temporizador capturará automáticamente tu centro de gravedad durante 2 segundos.
                </p>
              </div>

              <div className="step-metric-panel">
                <div className="metric-row">
                  <span className="metric-label">Tiempo restante</span>
                  <span className="metric-value">{liveMetrics.countdownSeconds}s</span>
                </div>
                <div className="calib-progress-bar-bg">
                  <div
                    className="calib-progress-bar-fill"
                    style={{ width: `${liveMetrics.progressPercent}%` }}
                  />
                </div>
                <div className="metric-row">
                  <span className="metric-label">Sensor</span>
                  <span className={`metric-value ${isUserPresent ? 'is-ok' : 'is-bad'}`}>
                    {isUserPresent ? 'Muestreando...' : 'Pausado'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                className="btn-calib-action"
                onClick={() => {
                  neutralTimerRef.current = { startTime: null, samples: [], lastLoggedSec: -1 };
                  isCapturingRef.current = true;
                }}
                disabled={!isUserPresent}
              >
                Reiniciar contador (2s)
              </button>
            </>
          )}

          {/* PASO 2: CALIBRAR JAB */}
          {currentStep === 2 && (
            <>
              <div className="step-info-header">
                <span className="step-tag">Paso 2 de 4</span>
                <p className="step-instruction">
                  Extiende tu brazo frontal completamente hacia adelante (golpe recto Jab). Se guardará la distancia máxima y el umbral al 80%.
                </p>
              </div>

              <div className="step-metric-panel">
                <div className="metric-row">
                  <span className="metric-label">Extensión actual</span>
                  <span className="metric-value">{liveMetrics.jabExtension}</span>
                </div>
                <div className="metric-row">
                  <span className="metric-label">Extensión máxima</span>
                  <span className="metric-value">
                    {metricsBufferRef.current.maxReach.toFixed(2)}
                  </span>
                </div>
                <div className="calib-progress-bar-bg">
                  <div
                    className="calib-progress-bar-fill"
                    style={{ width: `${liveMetrics.progressPercent}%` }}
                  />
                </div>
              </div>

              <button
                type="button"
                className="btn-calib-action"
                onClick={handleConfirmJab}
                disabled={metricsBufferRef.current.maxReach === 0}
              >
                Confirmar Jab
              </button>
            </>
          )}

          {/* PASO 3: CALIBRAR GANCHO (HOOK) */}
          {currentStep === 3 && (
            <>
              <div className="step-info-header">
                <span className="step-tag">Paso 3 de 4</span>
                <p className="step-instruction">
                  Ejecuta un Gancho circular manteniendo el codo flexionado (~90°). Registraremos el ángulo y tu rango lateral.
                </p>
              </div>

              <div className="step-metric-panel">
                <div className="metric-row">
                  <span className="metric-label">Ángulo de codo</span>
                  <span className="metric-value">{liveMetrics.hookAngle}°</span>
                </div>
                <div className="metric-row">
                  <span className="metric-label">Rango lateral (X)</span>
                  <span className="metric-value">{liveMetrics.hookRange}</span>
                </div>
                <div className="calib-progress-bar-bg">
                  <div
                    className="calib-progress-bar-fill"
                    style={{ width: `${liveMetrics.progressPercent}%` }}
                  />
                </div>
              </div>

              <button
                type="button"
                className="btn-calib-action"
                onClick={handleConfirmHook}
              >
                Confirmar Gancho
              </button>
            </>
          )}

          {/* PASO 4: CALIBRAR ESQUIVA (DODGE) */}
          {currentStep === 4 && (
            <>
              <div className="step-info-header">
                <span className="step-tag">Paso 4 de 4</span>
                <p className="step-instruction">
                  Inclina tu torso hacia la izquierda y luego hacia la derecha para registrar el umbral de desplazamiento lateral respecto al centro.
                </p>
              </div>

              <div className="step-metric-panel">
                <div className="metric-row">
                  <span className="metric-label">Desplazamiento X</span>
                  <span className="metric-value">{liveMetrics.dodgeDisplacement}</span>
                </div>
                <div className="metric-row">
                  <span className="metric-label">Máx izq. / der.</span>
                  <span className="metric-value">
                    {metricsBufferRef.current.maxDodgeLeft.toFixed(2)} / {metricsBufferRef.current.maxDodgeRight.toFixed(2)}
                  </span>
                </div>
                <div className="calib-progress-bar-bg">
                  <div
                    className="calib-progress-bar-fill"
                    style={{ width: `${liveMetrics.progressPercent}%` }}
                  />
                </div>
              </div>

              <button
                type="button"
                className="btn-calib-action"
                onClick={handleConfirmDodge}
              >
                Confirmar Esquiva
              </button>
            </>
          )}

          {/* PASO 5: CALIBRACIÓN COMPLETADA */}
          {currentStep === 5 && (
            <>
              <div className="step-info-header">
                <span className="step-tag is-ok">Calibración lista</span>
                <p className="step-instruction">
                  Tus movimientos y rangos fueron calculados exitosamente. Ahora tu juego estará optimizado a tu cuerpo.
                </p>
              </div>

              <div className="calib-summary-grid">
                <div className="summary-item">
                  <span className="summary-label">Umbral Jab</span>
                  <span className="summary-val">{calibratedParams.jab.threshold}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Ángulo Gancho</span>
                  <span className="summary-val">{calibratedParams.hook.elbowAngle}°</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Rango Gancho X</span>
                  <span className="summary-val">{calibratedParams.hook.lateralRange}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Umbral Esquiva</span>
                  <span className="summary-val">{calibratedParams.dodge.threshold}</span>
                </div>
              </div>

              <button
                type="button"
                className="btn-calib-action btn-ready-to-fight"
                onClick={handleReadyToFight}
              >
                ¡Listo para pelear!
              </button>
            </>
          )}
        </section>
      </aside>

      {/* =====================================================================
          CÁMARA PICTURE-IN-PICTURE (ESQUINA INFERIOR DERECHA)
          ===================================================================== */}
      <div className="camera-pip">
        <video
          ref={videoRef}
          className="camera-video-hidden"
          playsInline
          muted
          autoPlay
        />

        <canvas
          ref={canvasRef}
          className="camera-canvas"
          width={640}
          height={480}
        />

        <div className="camera-telemetry-badge">
          <span className="telemetry-dot-live" />
          <span>POSE LITE</span>
        </div>

        {!isUserPresent && (
          <div className="presence-alert-overlay" role="alert">
            <p className="presence-alert-text">No se detecta usuario</p>
          </div>
        )}
      </div>
    </div>
  );
}
