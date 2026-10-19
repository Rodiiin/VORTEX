/**
 * VORTEX Exergame - Pose Math Utilities
 * Funciones de cálculo geométrico y biomecánico para calibración y juego
 */

/**
 * Calcula la distancia Euclidiana entre dos puntos (2D o 3D ponderado)
 */
export function calculateDistance(p1, p2, use3D = false) {
  if (!p1 || !p2) return 0;
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  const dz = use3D && p1.z !== undefined && p2.z !== undefined ? (p1.z - p2.z) * 0.5 : 0;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Calcula el ángulo interior (en grados 0°-180°) formado por tres puntos A - B - C (vértice en B)
 */
export function calculateAngle(a, b, c) {
  if (!a || !b || !c) return 0;
  const v1 = { x: a.x - b.x, y: a.y - b.y };
  const v2 = { x: c.x - b.x, y: c.y - b.y };
  const dot = v1.x * v2.x + v1.y * v2.y;
  const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
  const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
  if (mag1 === 0 || mag2 === 0) return 0;
  const cosine = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
  return Math.round(Math.acos(cosine) * (180 / Math.PI));
}

/**
 * Obtiene el centro del torso a partir de los hombros (11, 12) y caderas (23, 24)
 */
export function getTorsoCenter(landmarks) {
  if (!landmarks) return null;
  const sL = landmarks[11];
  const sR = landmarks[12];
  if (!sL || !sR) return null;

  const hL = landmarks[23];
  const hR = landmarks[24];

  if (hL && hR && (hL.visibility || 0) > 0.3 && (hR.visibility || 0) > 0.3) {
    return {
      x: (sL.x + sR.x + hL.x + hR.x) / 4,
      y: (sL.y + sR.y + hL.y + hR.y) / 4,
      z: ((sL.z || 0) + (sR.z || 0) + (hL.z || 0) + (hR.z || 0)) / 4
    };
  }

  return {
    x: (sL.x + sR.x) / 2,
    y: (sL.y + sR.y) / 2,
    z: ((sL.z || 0) + (sR.z || 0)) / 2
  };
}

/**
 * Conexiones biomecánicas de MediaPipe Pose para dibujo en Canvas
 */
export const BOXING_POSE_CONNECTIONS = [
  // Cabeza / Cuello
  [9, 10], // Boca izquierda a derecha
  [11, 12], // Hombro a hombro
  
  // Extremidades superiores (Brazos de guardia / golpe)
  [11, 13], // Hombro izquierdo a codo izquierdo
  [13, 15], // Codo izquierdo a muñeca izquierda
  [12, 14], // Hombro derecho a codo derecho
  [14, 16], // Codo derecho a muñeca derecha

  // Torso
  [11, 23], // Hombro izquierdo a cadera izquierda
  [12, 24], // Hombro derecho a cadera derecha
  [23, 24], // Cadera a cadera

  // Extremidades inferiores (Postura de piernas)
  [23, 25], // Cadera izquierda a rodilla izquierda
  [25, 27], // Rodilla izquierda a tobillo izquierdo
  [24, 26], // Cadera derecha a rodilla derecha
  [26, 28]  // Rodilla derecha a tobillo derecho
];

/**
 * Dibuja el esqueleto cibernético en el canvas 2D con la paleta neón VORTEX
 */
export function drawCyberSkeleton(ctx, landmarks, width, height, options = {}) {
  if (!ctx || !landmarks || landmarks.length === 0) return;

  const {
    highlightUpperBody = true,
    showTorsoCenter = false,
    torsoCenter = null,
    neutralCenter = null,
    activeArm = null
  } = options;

  ctx.save();

  // 1. Dibujar conexiones (Líneas neón)
  BOXING_POSE_CONNECTIONS.forEach(([i, j]) => {
    const p1 = landmarks[i];
    const p2 = landmarks[j];
    if (!p1 || !p2) return;
    if ((p1.visibility || 0) < 0.4 || (p2.visibility || 0) < 0.4) return;

    const x1 = p1.x * width;
    const y1 = p1.y * height;
    const x2 = p2.x * width;
    const y2 = p2.y * height;

    const isArm = (i === 11 && j === 13) || (i === 13 && j === 15) ||
                  (i === 12 && j === 14) || (i === 14 && j === 16);

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineWidth = isArm ? 4.5 : 3;
    ctx.strokeStyle = isArm ? '#5CF2F2' : 'rgba(210, 162, 242, 0.7)';
    ctx.shadowColor = isArm ? '#5CF2F2' : '#5317A6';
    ctx.shadowBlur = isArm ? 14 : 8;
    ctx.lineCap = 'round';
    ctx.stroke();
  });

  // 2. Dibujar nodos de articulaciones (Landmark dots)
  const keyLandmarks = [11, 12, 13, 14, 15, 16, 23, 24, 0];
  keyLandmarks.forEach((idx) => {
    const lm = landmarks[idx];
    if (!lm || (lm.visibility || 0) < 0.4) return;

    const x = lm.x * width;
    const y = lm.y * height;
    const isWrist = idx === 15 || idx === 16;
    const isShoulder = idx === 11 || idx === 12;

    ctx.beginPath();
    ctx.arc(x, y, isWrist ? 7 : isShoulder ? 6 : 4.5, 0, 2 * Math.PI);
    ctx.fillStyle = isWrist ? '#5CF2F2' : isShoulder ? '#D2A2F2' : '#ffffff';
    ctx.shadowColor = isWrist ? '#5CF2F2' : '#D2A2F2';
    ctx.shadowBlur = 12;
    ctx.fill();

    // Aro exterior para muñecas (puños)
    if (isWrist) {
      ctx.beginPath();
      ctx.arc(x, y, 11, 0, 2 * Math.PI);
      ctx.strokeStyle = '#5CF2F2';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  });

  // 3. Dibujar centro del torso si se requiere
  if (showTorsoCenter && torsoCenter) {
    const cx = torsoCenter.x * width;
    const cy = torsoCenter.y * height;

    // Retícula del centro del torso
    ctx.beginPath();
    ctx.arc(cx, cy, 14, 0, 2 * Math.PI);
    ctx.strokeStyle = '#5CF2F2';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx - 20, cy);
    ctx.lineTo(cx + 20, cy);
    ctx.moveTo(cx, cy - 20);
    ctx.lineTo(cx, cy + 20);
    ctx.strokeStyle = 'rgba(92, 242, 242, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // 4. Dibujar línea de referencia neutra si existe
  if (neutralCenter) {
    const nx = neutralCenter.x * width;
    ctx.beginPath();
    ctx.setLineDash([4, 6]);
    ctx.moveTo(nx, 0);
    ctx.lineTo(nx, height);
    ctx.strokeStyle = 'rgba(210, 162, 242, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.restore();
}
