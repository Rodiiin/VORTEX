import React, { useState, useEffect, useRef } from 'react';
import * as mpPose from '@mediapipe/pose';
import * as mpCamera from '@mediapipe/camera_utils';
import {
  calculateDistance,
  calculateAngle,
  getTorsoCenter,
  drawCyberSkeleton
} from '../utils/poseMath';
import './GameEngine.css';

const PoseConstructor = mpPose.Pose || (mpPose.default && mpPose.default.Pose) || window.Pose;
const CameraConstructor = mpCamera.Camera || (mpCamera.default && mpCamera.default.Camera) || window.Camera;

/**
 * GameEngine Component (Placeholder) - VORTEX
 *
 * Muestra:
 * - Vista de la cámara con esqueleto dibujado en tiempo real en Canvas (MediaPipe Pose Lite @ 30 FPS).
 * - Resumen de los parámetros calibrados previamente (Umbrales de Jab, Hook y Dodge).
 * - Detección básica reactiva de golpes según los umbrales.
 * - Botón "Volver al Menú".
 *
 * @param {Object} calibrationData - Parámetros biométricos calculados en Calibration.jsx
 * @param {Function} onBackToMenu - Callback para retornar al Menú Principal
 */
export default function GameEngine({ calibrationData, onBackToMenu }) {
  const [activeAction, setActiveAction] = useState('EN GUARDIA');

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const cameraInstanceRef = useRef(null);
  const poseInstanceRef = useRef(null);

  // Parámetros calibrados por defecto si no vinieran
  const params = calibrationData || {
    neutralTorso: { x: 0.5, y: 0.5, z: 0 },
    jab: { threshold: 0.38, maxReach: 0.48 },
    hook: { elbowAngle: 90, lateralRange: 0.25 },
    dodge: { threshold: 0.06 }
  };

  const paramsRef = useRef(params);
  useEffect(() => {
    paramsRef.current = params;
  }, [params]);

  useEffect(() => {
    let isMounted = true;
    const videoElement = videoRef.current;
    const canvasElement = canvasRef.current;

    if (!videoElement || !canvasElement) return;

    const canvasCtx = canvasElement.getContext('2d');

    // Inicializar MediaPipe Pose con modelo 'lite'
    const pose = new PoseConstructor({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
    });

    pose.setOptions({
      modelComplexity: 0, // 'lite' model a 30 FPS
      smoothLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    poseInstanceRef.current = pose;

    pose.onResults((results) => {
      if (!isMounted || !canvasElement || !canvasCtx) return;

      const { image, poseLandmarks } = results;
      const width = canvasElement.width;
      const height = canvasElement.height;
      const activeParams = paramsRef.current;

      // Dibujar imagen de la cámara
      canvasCtx.clearRect(0, 0, width, height);
      canvasCtx.save();
      canvasCtx.drawImage(image, 0, 0, width, height);
      canvasCtx.restore();

      if (!poseLandmarks || poseLandmarks.length < 17) return;

      // Dibujar esqueleto sobre el canvas
      drawCyberSkeleton(canvasCtx, poseLandmarks, width, height, {
        neutralCenter: activeParams.neutralTorso
      });

      // Detección reactiva en vivo con los parámetros calibrados
      const currentTorso = getTorsoCenter(poseLandmarks);
      const leftReach = calculateDistance(poseLandmarks[11], poseLandmarks[15], true);
      const rightReach = calculateDistance(poseLandmarks[12], poseLandmarks[16], true);
      const maxCurrentReach = Math.max(leftReach, rightReach);

      const leftAngle = calculateAngle(poseLandmarks[11], poseLandmarks[13], poseLandmarks[15]);
      const rightAngle = calculateAngle(poseLandmarks[12], poseLandmarks[14], poseLandmarks[16]);

      const leftRangeX = Math.abs(poseLandmarks[15].x - poseLandmarks[11].x);
      const rightRangeX = Math.abs(poseLandmarks[16].x - poseLandmarks[12].x);

      let action = 'EN GUARDIA';

      // 1. ¿Esquiva detectada?
      if (activeParams.neutralTorso && currentTorso) {
        const deltaX = Math.abs(currentTorso.x - activeParams.neutralTorso.x);
        if (deltaX >= (activeParams.dodge?.threshold || 0.05)) {
          action = '¡ESQUIVA DETECTADA!';
        }
      }

      // 2. ¿Jab detectado?
      if (action === 'EN GUARDIA' && maxCurrentReach >= (activeParams.jab?.threshold || 0.35)) {
        action = '¡JAB DETECTADO!';
      }

      // 3. ¿Gancho detectado?
      if (action === 'EN GUARDIA') {
        const isLeftHook = leftAngle >= 65 && leftAngle <= 120 && leftRangeX >= (activeParams.hook?.lateralRange || 0.2);
        const isRightHook = rightAngle >= 65 && rightAngle <= 120 && rightRangeX >= (activeParams.hook?.lateralRange || 0.2);
        if (isLeftHook || isRightHook) {
          action = '¡GANCHO (HOOK) DETECTADO!';
        }
      }

      setActiveAction(action);
    });

    const camera = new CameraConstructor(videoElement, {
      onFrame: async () => {
        if (isMounted && videoElement && videoElement.readyState >= 2) {
          await pose.send({ image: videoElement });
        }
      },
      width: 640,
      height: 480,
    });

    cameraInstanceRef.current = camera;
    camera.start().catch((err) => {
      console.error('Error al iniciar cámara en GameEngine:', err);
    });

    return () => {
      isMounted = false;
      if (cameraInstanceRef.current) {
        try {
          cameraInstanceRef.current.stop();
        } catch {
          // Ignorar cierre seguro
        }
      }
      if (poseInstanceRef.current) {
        try {
          poseInstanceRef.current.close();
        } catch {
          // Ignorar cierre seguro
        }
      }
      if (videoElement && videoElement.srcObject) {
        const stream = videoElement.srcObject;
        const tracks = stream.getTracks();
        tracks.forEach((track) => track.stop());
      }
    };
  }, []);

  return (
    <div className="game-engine-wrapper">
      <div className="game-engine-grid-overlay" aria-hidden="true" />

      <div className="game-engine-container">
        
        {/* Barra superior de navegación */}
        <header className="game-engine-topbar">
          <div className="game-engine-branding">
            <h1 className="game-engine-title">VORTEX</h1>
            <span className="game-engine-badge">MOTOR DE COMBATE (EN VIVO)</span>
          </div>

          <button
            type="button"
            className="btn-engine-menu"
            onClick={onBackToMenu}
            aria-label="Volver al menú principal"
          >
            ← Volver al Menú
          </button>
        </header>

        {/* Contenido principal */}
        <main className="game-engine-content-grid">
          
          {/* Viewport de Cámara con Esqueleto en tiempo real */}
          <div className="game-viewport-card">
            <video
              ref={videoRef}
              className="game-video-hidden"
              playsInline
              muted
              autoPlay
            />
            <canvas
              ref={canvasRef}
              className="game-canvas"
              width={640}
              height={480}
            />

            {/* Banner reactivo de acción detectada */}
            <div className="live-combat-banner">
              <span>⚡</span>
              <span>{activeAction}</span>
            </div>
          </div>

          {/* Panel de Resumen de Parámetros Calibrados */}
          <aside className="game-telemetry-panel">
            <div className="telemetry-header">
              <h2 className="telemetry-title">Parámetros Calibrados</h2>
              <p className="telemetry-subtitle">
                Perfil de movimiento activo para la sesión actual
              </p>
            </div>

            <div className="calibrated-cards-list">
              <div className="param-card">
                <div className="param-info">
                  <span className="param-name">Umbral de Jab</span>
                  <span className="param-desc">80% de alcance frontal</span>
                </div>
                <span className="param-badge-val">
                  {params.jab?.threshold ?? '0.38'}
                </span>
              </div>

              <div className="param-card">
                <div className="param-info">
                  <span className="param-name">Ángulo de Gancho</span>
                  <span className="param-desc">Flexión óptima del codo</span>
                </div>
                <span className="param-badge-val">
                  {params.hook?.elbowAngle ? `${params.hook.elbowAngle}°` : '90°'}
                </span>
              </div>

              <div className="param-card">
                <div className="param-info">
                  <span className="param-name">Rango Lateral Gancho</span>
                  <span className="param-desc">Desplazamiento horizontal X</span>
                </div>
                <span className="param-badge-val">
                  {params.hook?.lateralRange ?? '0.25'}
                </span>
              </div>

              <div className="param-card">
                <div className="param-info">
                  <span className="param-name">Umbral de Esquiva</span>
                  <span className="param-desc">Inclinación lateral del torso</span>
                </div>
                <span className="param-badge-val">
                  {params.dodge?.threshold ?? '0.06'}
                </span>
              </div>

              <div className="param-card">
                <div className="param-info">
                  <span className="param-name">Torso Neutro</span>
                  <span className="param-desc">Coordenadas base de reposo</span>
                </div>
                <span className="param-badge-val" style={{ fontSize: '0.85rem' }}>
                  {params.neutralTorso
                    ? `X:${params.neutralTorso.x.toFixed(2)} Y:${params.neutralTorso.y.toFixed(2)}`
                    : 'Guardado'}
                </span>
              </div>
            </div>
          </aside>

        </main>

      </div>
    </div>
  );
}
