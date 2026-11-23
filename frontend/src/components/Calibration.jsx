import React, { useState, useEffect, useRef } from 'react';
import * as mpPose from '@mediapipe/pose';
import * as mpCamera from '@mediapipe/camera_utils';
import {
  calculateDistance,
  calculateAngle,
  getTorsoCenter,
  drawCyberSkeleton
} from '../utils/poseMath';
import guanteIzq from '../assets/guardia-i.png';
import guanteDer from '../assets/guardia-d.png';
import jabIzq from '../assets/jab-i.png';
import jabDer from '../assets/jab-d.png';
import hookIzq from '../assets/hook-i.png';
import hookDer from '../assets/hook-d.png';
import guiaGuardia from '../assets/asset-guardia.avif';
import guiaJab from '../assets/asset-jab.webp';
import guiaHook from '../assets/hook-asset.webp';
import guiaDodge from '../assets/asset-esquivar.webp';
import { saveMyCalibration } from '../utils/api';
import { useSettings } from '../context/SettingsContext';
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

// =========================================================================
// GUANTES SEGÚN LA ACCIÓN (guardia / jab / hook)
// Las imágenes de jab y hook tienen el puño en el mismo punto de ancla que
// las de guardia, así que sólo se cambia el src sin recolocar el guante.
// =========================================================================
const GLOVE_IMAGES = {
  left: { guardia: guanteIzq, jab: jabIzq, hook: hookIzq },
  right: { guardia: guanteDer, jab: jabDer, hook: hookDer },
};
const ACTION_HOLD_MS = 350;          // tiempo mínimo que se ve el golpe
const ACTION_CONFIRM_FRAMES = 4;     // fotogramas seguidos fuera de la guardia para aceptar un golpe
const DEFAULT_JAB_THRESHOLD = 0.35;  // alcance hombro-muñeca mínimo si aún no se calibró el jab
const DEFAULT_HOOK_RANGE = 0.2;      // rango lateral mínimo si aún no se calibró el gancho

/**
 * ¿Está esta mano en posición de guardia? Muñeca visible, a la altura del
 * pecho alto o más arriba (sin pasar por encima de la cabeza), delante del
 * cuerpo y con el codo doblado. Las distancias se escalan con el ancho de
 * hombros para no depender de lo lejos que esté el usuario de la cámara.
 */
const isHandInGuard = (lm, side) => {
  const ls = lm[11];
  const rs = lm[12];
  const nose = lm[0];
  const [shoulder, elbow, wrist] = side === 'left' ? [ls, lm[13], lm[15]] : [rs, lm[14], lm[16]];
  if (!ls || !rs || !wrist || !elbow || (wrist.visibility ?? 0) < 0.3) return false;

  const shoulderWidth = Math.abs(ls.x - rs.x);
  if (shoulderWidth < 0.01) return false;
  const shoulderY = (ls.y + rs.y) / 2;
  const midX = (ls.x + rs.x) / 2;

  const highEnough = wrist.y < shoulderY + 0.35 * shoulderWidth;
  const notOverhead = nose ? wrist.y > nose.y - 0.6 * shoulderWidth : true;
  const inFront = Math.abs(wrist.x - midX) < 1.1 * shoulderWidth;
  const elbowBent = calculateAngle(shoulder, elbow, wrist) < 120;
  return highEnough && notOverhead && inFront && elbowBent;
};

/**
 * Detecta la acción de una mano. La guardia tiene prioridad: sólo se cuenta
 * un golpe cuando hay una señal clara.
 *  - Jab: alcance hombro-muñeca (3D) >= umbral Y brazo extendido (codo casi
 *    recto en 2D o muñeca muy adelantada en profundidad). Si la mano está en
 *    zona de guardia se exige además un 15 % más de alcance.
 *  - Hook: codo entre 65° y 120°, muñeca separada lateralmente del hombro y
 *    fuera de la zona de guardia.
 * Sin calibrar, los umbrales se escalan con el ancho de hombros, así estar
 * cerca de la cámara no dispara jabs falsos.
 */
// Margen sobre la guardia medida: un jab debe llegar un 25 % más lejos que tu guardia
// (se usa al guardar el umbral del jab para el juego)
const GUARD_REACH_MARGIN = 1.25;

// =========================================================================
// PERFIL DE GUARDIA (media ± desviación estándar por brazo)
// Valores por defecto tomados de las medidas reales (assets/mediddas guardia.png,
// ancho de hombros 0.211). Las medidas se normalizan con el ancho de hombros
// para no depender de la distancia a la cámara:
//  - ratio: alcance hombro-muñeca 3D / ancho de hombros
//  - angle: ángulo del codo en 2D (grados)
//  - depth: profundidad de la muñeca hacia la cámara / ancho de hombros
// Al calibrar la guardia, el perfil se reemplaza por tus medidas (la desviación
// nunca baja de la de por defecto, para conservar margen de error).
// =========================================================================
const GUARD_PROFILE_DEFAULT = {
  left: {
    ratio: { mean: 2.26, sd: 0.15 },
    angle: { mean: 18, sd: 20 },
    depth: { mean: 4.36, sd: 0.5 },
  },
  right: {
    ratio: { mean: 2.36, sd: 0.15 },
    angle: { mean: 3, sd: 20 },
    depth: { mean: 4.54, sd: 0.5 },
  },
};
const GUARD_ENTER_SD = 2; // para volver a la guardia: dentro de ±2σ
const GUARD_EXIT_SD = 3;  // para salir de la guardia: fuera de ±3σ (histéresis)

/**
 * Mide un brazo en este fotograma y decide su acción.
 * La guardia manda: si las medidas están dentro del perfil (±kσ) es guardia.
 * Sólo fuera del perfil se busca un jab (muñeca más adelantada que en tu
 * guardia o codo abierto) o un gancho. Si sale del perfil pero no parece
 * ningún golpe, se mantiene la guardia.
 * `wasGuard` aplica la histéresis: si ya estaba en guardia, el margen es más amplio.
 */
const measureHand = (lm, side, params, prevAction = 'guardia') => {
  const wasGuard = prevAction === 'guardia';
  const [s, e, w] = side === 'left' ? [11, 13, 15] : [12, 14, 16];
  const shoulder = lm[s];
  const elbow = lm[e];
  const wrist = lm[w];
  if (!shoulder || !elbow || !wrist || !lm[11] || !lm[12]) return null;

  const shoulderWidth = Math.max(0.01, Math.abs(lm[11].x - lm[12].x));
  const inGuard = isHandInGuard(lm, side);
  const angle = calculateAngle(shoulder, elbow, wrist);
  const reach = calculateDistance(shoulder, wrist, true);
  const forward = (shoulder.z ?? 0) - (wrist.z ?? 0); // > 0 cuando la muñeca va hacia la cámara
  const rangeX = Math.abs(wrist.x - shoulder.x);
  const ratio = reach / shoulderWidth;
  const depth = forward / shoulderWidth;

  // ¿Dentro del perfil de guardia? (cada medida a menos de k desviaciones)
  const profile = params.guard?.profile?.[side] || GUARD_PROFILE_DEFAULT[side];
  const k = wasGuard ? GUARD_EXIT_SD : GUARD_ENTER_SD;
  const zScore = (value, m) => Math.abs(value - m.mean) / m.sd;
  const deviation = Math.max(
    zScore(ratio, profile.ratio),
    zScore(angle, profile.angle),
    zScore(depth, profile.depth),
  );
  const inProfile = deviation <= k;

  const jabThreshold = params.jab?.threshold || Math.max(DEFAULT_JAB_THRESHOLD, 1.3 * shoulderWidth);
  const hookRange = params.hook?.lateralRange || Math.max(DEFAULT_HOOK_RANGE, 0.9 * shoulderWidth);

  // Medidas extra para el gancho: separación lateral de la muñeca y altura
  // del codo respecto al hombro (> 0 cuando el codo sube por encima del hombro)
  const lateral = rangeX / shoulderWidth;
  const lift = (shoulder.y - elbow.y) / shoulderWidth;
  const metrics = { ratio, angle, depth, lateral, lift };

  // Distancia (en σ) de este fotograma al perfil de cada golpe calibrado
  const punchDistance = {};
  HAND_PUNCHES.forEach((type) => {
    // Perfil calibrado; si no hay, el de referencia del golpe (si tiene)
    const prof = params[type]?.profile?.[side] || PUNCHES[type].defaultProfile?.[side];
    punchDistance[type] = prof ? profileDistance(metrics, prof, PUNCHES[type].oneSided) : null;
  });
  // El gancho además tiene que pasar los filtros anatómicos
  if (punchDistance.hook !== null && !passesHookGates(metrics)) punchDistance.hook = Infinity;

  let action = 'guardia';
  if (!inProfile) {
    // Golpes con perfil: gana el más cercano dentro de 2σ (3σ si ya estaba en ese golpe)
    let best = null;
    HAND_PUNCHES.forEach((type) => {
      const dist = punchDistance[type];
      if (dist === null) return;
      const kp = prevAction === type ? PUNCH_EXIT_SD : PUNCH_ENTER_SD;
      if (dist <= kp && (!best || dist < best.dist)) best = { type, dist };
    });
    if (best) {
      action = best.type;
    } else {
      // Sin perfil: reglas simples de respaldo
      if (punchDistance.jab === null) {
        const moreForward = depth > profile.depth.mean + k * profile.depth.sd;
        const elbowOpen = angle >= 120;
        if (reach >= jabThreshold && (moreForward || elbowOpen)) action = 'jab';
      }
      if (action === 'guardia' && punchDistance.hook === null
        && angle >= 65 && angle <= 120 && rangeX >= hookRange) action = 'hook';
    }
  }

  return {
    action, reach, angle, forward, rangeX, ratio, depth, lateral, lift, deviation,
    jabDistance: punchDistance.jab, hookDistance: punchDistance.hook,
    side, inGuard, inProfile, shoulderWidth, jabThreshold,
  };
};

const detectHandAction = (lm, side, params, prevAction) =>
  measureHand(lm, side, params, prevAction)?.action ?? 'guardia';

// Distancia en σ de unas medidas a un perfil.
//  - oneSided.low: sólo cuenta quedarse por debajo de la media
//    (pasarse de tu golpe medido también vale).
//  - oneSided.high: sólo cuenta pasarse por encima de la media
//    (quedarse por debajo también vale).
//  - El resto de medidas cuentan en ambos sentidos.
function profileDistance(metrics, prof, oneSided = {}) {
  const low = oneSided.low || [];
  const high = oneSided.high || [];
  return Math.max(...Object.keys(prof).map((key) => {
    const m = prof[key];
    const diff = (m.mean - metrics[key]) / m.sd; // > 0 cuando el valor está por debajo
    if (low.includes(key)) return Math.max(0, diff);
    if (high.includes(key)) return Math.max(0, -diff);
    return Math.abs(diff);
  }));
}

// =========================================================================
// CALIBRACIÓN DE GOLPES: JAB Y GANCHO (mismo proceso que la guardia)
// Botón Calibrar -> cuenta regresiva -> sampleS segundos lanzando golpes
// -> popup con puntuación, estadísticas y perfil del golpe (media ± σ).
// Cada golpe es un "episodio": la mano sale del perfil de guardia y vuelve.
// Del episodio se toman los fotogramas de máxima extensión (>= 90 % del pico
// de `peakKey`) para construir el perfil.
// =========================================================================
const PUNCH_ENTER_SD = 2;      // para pasar a un golpe: dentro de 2σ de su perfil
const PUNCH_EXIT_SD = 3;       // para seguir en ese golpe: dentro de 3σ (histéresis)
const PUNCH_QUIET_FRAMES = 3;  // fotogramas sin extensión para dar el golpe por terminado

// =========================================================================
// PERFIL DE GANCHO DE REFERENCIA (media ± desviación estándar por brazo)
// Tomado de las mediciones reales de ganchos (assets/medidas gancho.png y
// assets/medida gancho.png). Se usa:
//  - para reconocer cada gancho mientras se calibra, y
//  - para detectar el gancho si todavía no se ha calibrado.
// Brazo derecho, 3 mediciones consistentes: 88°/76°/83°, 0.92×/1.02×/0.93×.
// Brazo izquierdo: sólo la 1.ª medición fue un gancho real (75°, 0.88×, codo
// arriba 1.04×). En las otras la guardia se contó como gancho (59° y 25°,
// codo abajo -0.95×), así que no se usan como referencia.
// La profundidad varía mucho entre mediciones, así que sólo funciona como
// tope: el gancho no puede ir tan adelantado como la guardia (~4.4×) o el jab.
// =========================================================================
const HOOK_PROFILE_DEFAULT = {
  left: {
    angle: { mean: 78, sd: 15 },
    lateral: { mean: 0.88, sd: 0.25 },
    depth: { mean: 0.4, sd: 1.0 },
  },
  right: {
    angle: { mean: 82, sd: 15 },
    lateral: { mean: 0.96, sd: 0.25 },
    depth: { mean: 0.3, sd: 1.0 },
  },
};
const HOOK_ONE_SIDED = { low: ['lateral'], high: ['depth'] };

// Filtros anatómicos del gancho: se aplican SIEMPRE (también con un perfil
// calibrado), para que la guardia nunca cuente como gancho aunque el perfil
// guardado haya salido mal. Valores de las mediciones:
//  - guardia: codo 3°-25°, codo abajo (~ -0.95×), profundidad ~2.7×-4.5×
//  - gancho real: codo 75°-88°, codo arriba (0.07× a 1.31×), lateral >= 0.88×
const HOOK_GATES = {
  minAngle: 50,     // codo claramente abierto (la guardia está por debajo de ~25°)
  maxAngle: 140,    // si está casi recto es un jab, no un gancho
  minLateral: 0.5,  // la muñeca tiene que abrirse hacia el lado
  minLift: -0.3,    // el codo sube hacia la altura del hombro (en guardia cuelga ~ -0.95×)
  maxDepth: 2.2,    // no tan adelantado como la guardia o el jab
};
const passesHookGates = (m) => m.angle >= HOOK_GATES.minAngle
  && m.angle <= HOOK_GATES.maxAngle
  && m.lateral >= HOOK_GATES.minLateral
  && m.lift >= HOOK_GATES.minLift
  && m.depth <= HOOK_GATES.maxDepth;

// =========================================================================
// ESQUIVA: desplazamiento lateral del cuerpo respecto al centro del torso
// medido en la guardia (neutralTorso). Todo en anchos de hombro.
//  - shift: desplazamiento del centro del torso hacia ese lado
//  - head:  desplazamiento de la cabeza (nariz) hacia ese lado
//  - tilt:  inclinación de la línea de hombros hacia ese lado (grados)
// La cámara entrega la imagen sin espejo: la izquierda del usuario es +x.
// Si en tu montaje las direcciones salen invertidas, cambia DODGE_LEFT_SIGN a -1.
// =========================================================================
const DODGE_LEFT_SIGN = 1;
const DODGE_NEUTRAL_SD = 0.08;  // balanceo normal del torso en guardia (anchos de hombro)
const DODGE_MIN_SHIFT = 0.3;    // desplazamiento mínimo para contar una esquiva al calibrar
const DODGE_LIVE_MIN_SHIFT = 0.15; // mínimo absoluto para reconocerla en el sandbox
const DODGE_ONE_SIDED = { low: ['shift', 'head', 'tilt'] };

function measureDodge(lm, params, dir) {
  const neutral = params.neutralTorso;
  const ls = lm[11];
  const rs = lm[12];
  if (!neutral || !ls || !rs) return null;
  const torso = getTorsoCenter(lm);
  if (!torso) return null;

  const shoulderWidth = Math.max(0.01, Math.abs(ls.x - rs.x));
  const sign = dir === 'left' ? DODGE_LEFT_SIGN : -DODGE_LEFT_SIGN;
  const dx = torso.x - neutral.x;
  const nose = lm[0];
  const tiltDeg = (Math.atan2(ls.y - rs.y, ls.x - rs.x) * 180) / Math.PI;

  return {
    side: dir,
    shift: (sign * dx) / shoulderWidth,
    head: nose ? (sign * (nose.x - neutral.x)) / shoulderWidth : (sign * dx) / shoulderWidth,
    tilt: sign * tiltDeg,
    absShift: Math.abs(dx),
    deviation: Math.abs(dx / shoulderWidth) / DODGE_NEUTRAL_SD, // separación del centro, en σ
    shoulderWidth,
  };
}

/**
 * Detecta la esquiva en vivo (sandbox). Con perfil calibrado: dentro de 2σ
 * de tu esquiva hacia ese lado (3σ si ya estaba esquivando hacia ahí).
 * Sin perfil: desplazamiento mayor que el umbral absoluto.
 * Devuelve 'left' | 'right' | null y las medidas de ambos lados.
 */
const detectDodge = (lm, params, prevDir) => {
  const measures = { left: measureDodge(lm, params, 'left'), right: measureDodge(lm, params, 'right') };
  let best = null;
  ['left', 'right'].forEach((dir) => {
    const h = measures[dir];
    if (!h || h.shift < DODGE_LIVE_MIN_SHIFT) return;
    const prof = params.dodge?.profile?.[dir];
    let dist;
    if (prof) {
      dist = profileDistance(h, prof, DODGE_ONE_SIDED);
    } else {
      dist = h.absShift >= (params.dodge?.threshold || 0.05) ? 0 : Infinity;
    }
    const k = prevDir === dir ? PUNCH_EXIT_SD : PUNCH_ENTER_SD;
    if (dist <= k && (!best || dist < best.dist)) best = { dir, dist };
  });
  return { dir: best ? best.dir : null, measures };
};

// =========================================================================
// SANDBOX (práctica libre tras la calibración)
// =========================================================================
const sidesOf = (value) => ({ left: value, right: value });

const newSandbox = () => ({
  startTime: Date.now(),
  startedAt: new Date().toISOString(),
  lastUi: 0,
  counts: { jab: sidesOf(0), hook: sidesOf(0), dodge: sidesOf(0) },
  max: { reachRatio: sidesOf(0), lateral: sidesOf(0), dodgeShift: sidesOf(0) },
  dodge: { dir: null, candidate: null, frames: 0 },
  live: { hands: sidesOf(null), dodge: sidesOf(null) },
});

const copySides = (obj) => ({ left: obj.left, right: obj.right });

// Copia inmutable de los datos del sandbox para pintar la UI
const snapshotSandbox = (sb, gloveActions, now) => {
  const hand = (h) => (h ? {
    ratio: h.ratio, angle: h.angle, depth: h.depth, lateral: h.lateral,
  } : null);
  return {
    elapsedS: Math.max(0, Math.round((now - sb.startTime) / 1000)),
    actions: { left: gloveActions.left.action, right: gloveActions.right.action },
    dodgeDir: sb.dodge.dir,
    counts: {
      jab: copySides(sb.counts.jab),
      hook: copySides(sb.counts.hook),
      dodge: copySides(sb.counts.dodge),
    },
    max: {
      reachRatio: copySides(sb.max.reachRatio),
      lateral: copySides(sb.max.lateral),
      dodgeShift: copySides(sb.max.dodgeShift),
    },
    hands: { left: hand(sb.live.hands.left), right: hand(sb.live.hands.right) },
    dodge: {
      left: sb.live.dodge.left ? sb.live.dodge.left.shift : null,
      right: sb.live.dodge.right ? sb.live.dodge.right.shift : null,
    },
  };
};

// Resumen de la sesión del sandbox que se guarda en la base de datos
const round3 = (n) => Number(n.toFixed(3));
const buildSandboxStats = (sb) => ({
  startedAt: sb.startedAt,
  endedAt: new Date().toISOString(),
  durationS: Math.round((Date.now() - sb.startTime) / 1000),
  counts: {
    jab: copySides(sb.counts.jab),
    hook: copySides(sb.counts.hook),
    dodge: copySides(sb.counts.dodge),
  },
  max: {
    reachRatio: { left: round3(sb.max.reachRatio.left), right: round3(sb.max.reachRatio.right) },
    lateral: { left: round3(sb.max.lateral.left), right: round3(sb.max.lateral.right) },
    dodgeShift: { left: round3(sb.max.dodgeShift.left), right: round3(sb.max.dodgeShift.right) },
  },
});

// Resumen de un resultado de calibración (sin los fotogramas) para guardarlo
const summarizeResult = (r) => (r ? {
  score: r.score,
  level: r.level,
  ...(r.punches !== undefined ? { count: r.punches } : {}),
  ...(r.guard !== undefined ? { guard: r.guard, stability: r.stability, visibility: r.visibility } : {}),
  ...(r.separation !== undefined && r.punches !== undefined
    ? { separation: r.separation, consistency: r.consistency } : {}),
} : null);

const PUNCHES = {
  jab: {
    step: 2,
    sampleS: 6,
    target: 4,
    peakKey: 'ratio',                       // el pico del jab es el máximo alcance
    profileKeys: ['ratio', 'angle', 'depth'],
    oneSided: { low: ['ratio', 'depth'] },  // llegar más lejos también es jab
    sdMin: { ratio: 0.25, angle: 20, depth: 0.6 },
    // Brazo adelantado lejos de la guardia
    isExtension: (h, gp) => h.deviation > GUARD_EXIT_SD && (
      h.depth > gp.depth.mean + 2 * gp.depth.sd
      || h.ratio > gp.ratio.mean + 2 * gp.ratio.sd
      || h.angle >= 120
    ),
    keys: {
      instr: 'calib_instr_2',
      guideTitle: 'calib_guia_jab_titulo',
      guideAlt: 'calib_guia_jab_alt',
      guideText: 'calib_guia_jab_texto',
      measuring: 'calib_midiendo_jab',
      counted: 'calib_jabs_contados',
      resTitle: 'calib_resj_titulo',
      resCount: 'calib_resj_cantidad',
      tip: 'calib_tipj_',
      perHand: 'calib_detj_jabs',
      profile: 'calib_detj_perfil',
      note: 'calib_detj_nota',
      next: 'calib_btn_continuar_gancho',
    },
  },
  hook: {
    step: 3,
    sampleS: 9,                             // 3 s más que el jab: el gancho tarda más
    target: 4,
    peakKey: 'lateral',                     // el pico del gancho es la máxima apertura lateral
    profileKeys: ['angle', 'lateral', 'depth'],
    // abrir más también es gancho; la profundidad sólo pone un tope
    oneSided: HOOK_ONE_SIDED,
    sdMin: { angle: 15, lateral: 0.25, depth: 1.0 },
    defaultProfile: HOOK_PROFILE_DEFAULT,   // referencia mientras no se calibre
    // Fuera de la guardia, pasa los filtros anatómicos y está a menos de 2σ
    // del gancho de referencia
    isExtension: (h) => h.deviation > GUARD_EXIT_SD
      && passesHookGates(h)
      && profileDistance(h, HOOK_PROFILE_DEFAULT[h.side], HOOK_ONE_SIDED) <= PUNCH_ENTER_SD,
    keys: {
      instr: 'calib_instr_3',
      guideTitle: 'calib_guia_hook_titulo',
      guideAlt: 'calib_guia_hook_alt',
      guideText: 'calib_guia_hook_texto',
      measuring: 'calib_midiendo_hook',
      counted: 'calib_hooks_contados',
      resTitle: 'calib_resh_titulo',
      resCount: 'calib_resh_cantidad',
      tip: 'calib_tiph_',
      perHand: 'calib_deth_hooks',
      profile: 'calib_deth_perfil',
      note: 'calib_deth_nota',
      next: 'calib_btn_continuar_esquiva',
    },
  },
  dodge: {
    step: 4,
    sampleS: 8,
    target: 4,                              // 2 hacia cada lado
    // En la esquiva, 'left'/'right' son la DIRECCIÓN del movimiento, no la mano
    measure: measureDodge,
    columns: ['calib_det_dir_izq', 'calib_det_dir_der'],
    peakKey: 'shift',                       // el pico es el máximo desplazamiento del torso
    profileKeys: ['shift', 'head', 'tilt'],
    oneSided: DODGE_ONE_SIDED,              // moverse más hacia ese lado también es esquiva
    sdMin: { shift: 0.15, head: 0.2, tilt: 8 },
    isExtension: (h) => h.shift >= DODGE_MIN_SHIFT,
    limbStats: (plateau, peaks, avg) => ({
      shiftAvg: avg('shift'),
      shiftMax: Math.max(...peaks.map((p) => p.shift)),
      absShiftAvg: avg('absShift'),
      absShiftMax: Math.max(...plateau.map((h) => h.absShift)),
      head: avg('head'),
      tilt: Math.round(avg('tilt')),
    }),
    keys: {
      instr: 'calib_instr_4',
      guideTitle: 'calib_guia_dodge_titulo',
      guideAlt: 'calib_guia_dodge_alt',
      guideText: 'calib_guia_dodge_texto',
      measuring: 'calib_midiendo_dodge',
      counted: 'calib_dodges_contados',
      resTitle: 'calib_resd_titulo',
      resCount: 'calib_resd_cantidad',
      tip: 'calib_tipd_',
      perHand: 'calib_detd_dodges',
      profile: 'calib_detd_perfil',
      note: 'calib_detd_nota',
      next: 'calib_btn_ir_sandbox',
    },
  },
};
const PUNCH_TYPES = Object.keys(PUNCHES);
// Golpes de mano (se detectan por brazo en measureHand); la esquiva va aparte
const HAND_PUNCHES = PUNCH_TYPES.filter((type) => !PUNCHES[type].measure);
const punchForStep = (step) => PUNCH_TYPES.find((type) => PUNCHES[type].step === step) || null;

// Imagen de la guía de cada golpe
const PUNCH_GUIDES = { jab: guiaJab, hook: guiaHook, dodge: guiaDodge };

// Etiqueta y unidad de cada medida del perfil
const PROFILE_LABELS = {
  ratio: { label: 'calib_det_ratio', unit: '×' },
  angle: { label: 'calib_det_angulo', unit: '°' },
  depth: { label: 'calib_det_profundidad_ratio', unit: '×' },
  lateral: { label: 'calib_det_lateral_ratio', unit: '×' },
  lift: { label: 'calib_det_codo_altura', unit: '×' },
  shift: { label: 'calib_det_desplazamiento_ratio', unit: '×' },
  head: { label: 'calib_det_cabeza_ratio', unit: '×' },
  tilt: { label: 'calib_det_inclinacion', unit: '°' },
};

// Filas de la tabla de estadísticas detalladas de cada golpe
const PUNCH_DETAIL_ROWS = {
  jab: (perHandKey) => [
    { key: perHandKey, fmt: (h) => `${h.count}` },
    { key: 'calib_det_alcance', fmt: (h) => h.reachAvg.toFixed(3) },
    { key: 'calib_det_alcance_max', fmt: (h) => h.reachMax.toFixed(3) },
    { key: 'calib_det_ratio', fmt: (h) => `${h.ratio.toFixed(2)}×` },
    { key: 'calib_det_angulo', fmt: (h) => `${h.angle}°` },
    { key: 'calib_det_profundidad', fmt: (h) => h.forward.toFixed(3) },
    { key: 'calib_det_profundidad_ratio', fmt: (h) => `${h.depthRatio.toFixed(2)}×` },
    { key: 'calib_detj_separacion', fmt: (h) => `${h.separation.toFixed(2)}σ`, warn: (h) => h.separation < 4 },
    { key: 'calib_detj_fotogramas', fmt: (h) => `${h.frames}` },
  ],
  hook: (perHandKey) => [
    { key: perHandKey, fmt: (h) => `${h.count}` },
    { key: 'calib_det_angulo', fmt: (h) => `${h.angle}°`, warn: (h) => h.angle < 65 || h.angle > 120 },
    { key: 'calib_det_lateral', fmt: (h) => h.lateralAbs.toFixed(3) },
    { key: 'calib_det_lateral_ratio', fmt: (h) => `${h.lateral.toFixed(2)}×` },
    { key: 'calib_det_codo_altura', fmt: (h) => `${h.lift.toFixed(2)}×` },
    { key: 'calib_det_alcance', fmt: (h) => h.reachAvg.toFixed(3) },
    { key: 'calib_det_profundidad_ratio', fmt: (h) => `${h.depthRatio.toFixed(2)}×` },
    { key: 'calib_detj_separacion', fmt: (h) => `${h.separation.toFixed(2)}σ`, warn: (h) => h.separation < 4 },
    { key: 'calib_detj_fotogramas', fmt: (h) => `${h.frames}` },
  ],
  dodge: (perHandKey) => [
    { key: perHandKey, fmt: (h) => `${h.count}` },
    { key: 'calib_det_desplazamiento', fmt: (h) => h.absShiftAvg.toFixed(3) },
    { key: 'calib_det_desplazamiento_max', fmt: (h) => h.absShiftMax.toFixed(3) },
    { key: 'calib_det_desplazamiento_ratio', fmt: (h) => `${h.shiftAvg.toFixed(2)}×` },
    { key: 'calib_det_cabeza_ratio', fmt: (h) => `${h.head.toFixed(2)}×` },
    { key: 'calib_det_inclinacion', fmt: (h) => `${h.tilt}°` },
    { key: 'calib_detd_separacion', fmt: (h) => `${h.separation.toFixed(2)}σ`, warn: (h) => h.separation < 4 },
    { key: 'calib_detj_fotogramas', fmt: (h) => `${h.frames}` },
  ],
};

const newPunchTracker = () => ({
  left: { active: false, quiet: 0, frames: [], episodes: [] },
  right: { active: false, quiet: 0, frames: [], episodes: [] },
});

const closePunchEpisode = (st) => {
  if (st.frames.length >= 2) st.episodes.push(st.frames);
  st.active = false;
  st.frames = [];
  st.quiet = 0;
};

// Avanza el seguimiento de golpes de una mano con el fotograma actual
const stepPunchTracker = (st, h, gp, type) => {
  if (!h) return;
  if (PUNCHES[type].isExtension(h, gp)) {
    st.quiet = 0;
    if (!st.active) {
      st.active = true;
      st.frames = [];
    }
    st.frames.push(h);
  } else if (st.active) {
    st.quiet += 1;
    if (st.quiet >= PUNCH_QUIET_FRAMES) closePunchEpisode(st);
  }
};

const countPunches = (tracker) =>
  ['left', 'right'].reduce(
    (acc, side) => acc + tracker[side].episodes.length + (tracker[side].active && tracker[side].frames.length >= 2 ? 1 : 0),
    0
  );

/**
 * Resultado de un golpe: puntuación (0-100), estadísticas por brazo y perfil.
 *  - 40 % cantidad de golpes (`target` para el 100 %)
 *  - 35 % separación de la guardia (desviación media en σ; 7σ o más = 100 %)
 *  - 25 % consistencia (variación del pico entre golpes)
 */
const computePunchResult = (tracker, type) => {
  const cfg = PUNCHES[type];
  const limbs = {};
  const profile = {};
  const allPeaks = [];
  const separations = [];
  const reachStats = [];
  const rangeStats = [];
  const shiftStats = [];

  ['left', 'right'].forEach((side) => {
    const episodes = tracker[side].episodes;
    const key = cfg.peakKey;
    const peaks = episodes.map((ep) => ep.reduce((best, h) => (h[key] > best[key] ? h : best), ep[0]));
    const plateau = episodes.flatMap((ep, i) => ep.filter((h) => h[key] >= 0.9 * peaks[i][key]));
    allPeaks.push(...peaks.map((p) => p[key]));

    if (!plateau.length) {
      limbs[side] = { count: 0 };
      profile[side] = null;
      return;
    }

    const metric = (k) => {
      const { mean, sd } = meanSd(plateau.map((h) => h[k]));
      return { mean: Number(mean.toFixed(3)), sd: Number(Math.max(sd, cfg.sdMin[k]).toFixed(3)) };
    };
    profile[side] = Object.fromEntries(cfg.profileKeys.map((k) => [k, metric(k)]));

    const sep = meanSd(plateau.map((h) => h.deviation)).mean;
    separations.push(sep);
    const avg = (k) => meanSd(plateau.map((h) => h[k])).mean;

    // Esquiva: estadísticas propias (desplazamiento del torso)
    if (cfg.limbStats) {
      shiftStats.push(meanSd(plateau.map((h) => h.absShift)));
      limbs[side] = {
        count: episodes.length,
        separation: sep,
        frames: plateau.length,
        ...cfg.limbStats(plateau, peaks, avg),
      };
      return;
    }

    const reach = meanSd(plateau.map((h) => h.reach));
    const range = meanSd(plateau.map((h) => h.rangeX));
    reachStats.push(reach);
    rangeStats.push(range);

    limbs[side] = {
      count: episodes.length,
      reachAvg: reach.mean,
      reachMax: Math.max(...peaks.map((p) => p.reach)),
      ratio: avg('ratio'),
      angle: Math.round(avg('angle')),
      forward: avg('forward'),
      depthRatio: avg('depth'),
      lateralAbs: range.mean,
      lateral: avg('lateral'),
      lift: avg('lift'),
      separation: sep,
      frames: plateau.length,
    };
  });

  const count = allPeaks.length;
  const countScore = clamp(count / cfg.target, 0, 1);
  const sepScore = separations.length
    ? clamp((separations.reduce((a, b) => a + b, 0) / separations.length - 3) / 4, 0, 1)
    : 0;
  let consistency = 0;
  if (count >= 2) {
    const { mean, sd } = meanSd(allPeaks);
    consistency = clamp(1 - (sd / Math.max(mean, 0.01)) / 0.25, 0, 1);
  } else if (count === 1) {
    consistency = 0.5;
  }

  const score = Math.round(100 * (0.4 * countScore + 0.35 * sepScore + 0.25 * consistency));
  const level = score >= 85 ? 'excelente' : score >= 70 ? 'buena' : score >= 50 ? 'regular' : 'repetir';
  const parts = [
    { key: 'cantidad', value: countScore, weight: 0.4 },
    { key: 'separacion', value: sepScore, weight: 0.35 },
    { key: 'consistencia', value: consistency, weight: 0.25 },
  ];
  const weakest = parts.reduce((a, b) => ((1 - b.value) * b.weight > (1 - a.value) * a.weight ? b : a));
  const tipSuffix = count === 0 ? 'ninguno' : score >= 85 ? 'ok' : weakest.key;

  return {
    type,
    score,
    level,
    tipKey: cfg.keys.tip + tipSuffix,
    punches: count,
    count: Math.round(countScore * 100),
    separation: Math.round(sepScore * 100),
    consistency: Math.round(consistency * 100),
    limbs,
    profile,
    // Valores absolutos para el juego: el golpe más bajo (media - 2σ) y la media
    reachLow: reachStats.length ? Math.min(...reachStats.map((r) => r.mean - 2 * r.sd)) : 0,
    reachMean: reachStats.length ? Math.min(...reachStats.map((r) => r.mean)) : 0,
    rangeLow: rangeStats.length ? Math.min(...rangeStats.map((r) => r.mean - 2 * r.sd)) : 0,
    rangeMean: rangeStats.length ? Math.min(...rangeStats.map((r) => r.mean)) : 0,
    shiftLow: shiftStats.length ? Math.min(...shiftStats.map((r) => r.mean - 2 * r.sd)) : 0,
    shiftMean: shiftStats.length ? Math.min(...shiftStats.map((r) => r.mean)) : 0,
  };
};

// Media y desviación estándar de una lista de números
const meanSd = (values) => {
  if (!values.length) return { mean: 0, sd: 0 };
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const sd = Math.sqrt(values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length);
  return { mean, sd };
};

/**
 * Perfil de guardia a partir de los fotogramas medidos. La desviación nunca
 * es menor que la del perfil por defecto (margen de error mínimo).
 */
const buildGuardProfile = (frames) => {
  const profile = {};
  ['left', 'right'].forEach((side) => {
    const hands = frames.map((f) => f.hands?.[side]).filter(Boolean);
    if (hands.length < GUARD_MIN_SAMPLES) {
      profile[side] = GUARD_PROFILE_DEFAULT[side];
      return;
    }
    const def = GUARD_PROFILE_DEFAULT[side];
    const metric = (key) => {
      const { mean, sd } = meanSd(hands.map((h) => h[key]));
      return { mean: Number(mean.toFixed(3)), sd: Number(Math.max(sd, def[key].sd).toFixed(3)) };
    };
    profile[side] = { ratio: metric('ratio'), angle: metric('angle'), depth: metric('depth') };
  });
  return profile;
};

// Percentil p (0-1) de una lista de números
const percentile = (values, p) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
};

/**
 * Estadísticas de cada brazo durante la medición de la guardia.
 * Se usan para el panel de detalles y para recalcular el umbral del jab.
 */
const computeLimbStats = (frames) => {
  const stats = {};
  ['left', 'right'].forEach((side) => {
    const hands = frames.map((f) => f.hands?.[side]).filter(Boolean);
    const n = hands.length || 1;
    const avg = (key) => hands.reduce((acc, h) => acc + h[key], 0) / n;
    const pct = (fn) => Math.round((hands.filter(fn).length / n) * 100);
    stats[side] = {
      reachAvg: avg('reach'),
      reachMax: percentile(hands.map((h) => h.reach), 0.9),
      ratio: avg('reach') / Math.max(0.01, avg('shoulderWidth')),
      angle: Math.round(avg('angle')),
      forward: avg('forward'),
      forwardMax: percentile(hands.map((h) => h.forward), 0.9),
      jabThreshold: avg('jabThreshold'),
      depthRatio: avg('depth'),
      deviation: avg('deviation'),
      inProfilePct: pct((h) => h.inProfile),
      inGuardPct: pct((h) => h.inGuard),
      jabPct: pct((h) => h.action === 'jab'),
      hookPct: pct((h) => h.action === 'hook'),
    };
  });
  const widths = frames.map((f) => f.hands?.left?.shoulderWidth).filter(Boolean);
  const shoulderWidth = widths.length ? widths.reduce((a, b) => a + b, 0) / widths.length : 0;
  return { ...stats, shoulderWidth };
};

// =========================================================================
// CALIBRACIÓN DE GUARDIA
// Flujo: botón Calibrar -> cuenta regresiva para acomodarse -> medición ->
// popup con puntuación (repetir o continuar al Jab).
// =========================================================================
const GUARD_COUNTDOWN_S = 4;   // segundos para que el usuario se acomode
const GUARD_SAMPLE_S = 2;      // segundos de medición
const GUARD_MIN_SAMPLES = 15;  // fotogramas mínimos para dar la medición por válida

// Landmarks usados para medir la visibilidad: nariz, hombros, codos y muñecas
const GUARD_VISIBILITY_POINTS = [0, 11, 12, 13, 14, 15, 16];

// ¿Está el usuario en guardia en este fotograma? (ambas manos en guardia)
const isGuardPose = (lm) => isHandInGuard(lm, 'left') && isHandInGuard(lm, 'right');

/**
 * Puntuación de la guardia (0-100) a partir de los fotogramas medidos:
 *  - 50 % guantes en posición (fotogramas en los que isGuardPose es verdadero)
 *  - 30 % estabilidad (cuánto se movió el centro del torso)
 *  - 20 % visibilidad media de nariz, hombros, codos y muñecas
 */
const computeGuardScore = (torsoSamples, frames) => {
  const n = frames.length;
  const guardRatio = n ? frames.filter((f) => f.guard).length / n : 0;

  const meanX = torsoSamples.reduce((acc, s) => acc + s.x, 0) / torsoSamples.length;
  const meanY = torsoSamples.reduce((acc, s) => acc + s.y, 0) / torsoSamples.length;
  const spread = Math.sqrt(
    torsoSamples.reduce((acc, s) => acc + (s.x - meanX) ** 2 + (s.y - meanY) ** 2, 0) / torsoSamples.length
  );
  // Por debajo de 0.004 (temblor normal) cuenta como totalmente estable; 0.024 o más, 0 %
  const stability = clamp(1 - (spread - 0.004) / 0.02, 0, 1);

  const avgVisibility = n ? frames.reduce((acc, f) => acc + f.visibility, 0) / n : 0;
  const visibility = clamp((avgVisibility - 0.5) / 0.4, 0, 1);

  const score = Math.round(100 * (0.5 * guardRatio + 0.3 * stability + 0.2 * visibility));
  const level = score >= 85 ? 'excelente' : score >= 70 ? 'buena' : score >= 50 ? 'regular' : 'repetir';

  // Consejo según la parte más débil de la medición
  const parts = [
    { key: 'calib_tip_guardia', value: guardRatio, weight: 0.5 },
    { key: 'calib_tip_estabilidad', value: stability, weight: 0.3 },
    { key: 'calib_tip_visibilidad', value: visibility, weight: 0.2 },
  ];
  const weakest = parts.reduce((a, b) => ((1 - b.value) * b.weight > (1 - a.value) * a.weight ? b : a));
  const tipKey = score >= 85 ? 'calib_tip_ok' : weakest.key;

  return {
    score,
    level,
    tipKey,
    guard: Math.round(guardRatio * 100),
    stability: Math.round(stability * 100),
    visibility: Math.round(visibility * 100),
    raw: { spread: Number(spread.toFixed(4)), avgVisibility: Number(avgVisibility.toFixed(2)), frames: n },
  };
};

// Claves de traducción de cada fase para el stepper del panel HUD
// (el título largo de cada fase usa la clave 'calib_fase_<id>')
const PHASES = [
  { id: 0, labelKey: 'calib_paso_deteccion' },
  { id: 1, labelKey: 'calib_paso_neutro' },
  { id: 2, labelKey: 'calib_paso_jab' },
  { id: 3, labelKey: 'calib_paso_gancho' },
  { id: 4, labelKey: 'calib_paso_esquiva' },
  { id: 5, labelKey: 'calib_paso_listo' },
];

/**
 * Componente de Calibración Biomecánica - VORTEX Exergame
 *
 * Arquitectura de ciclo de vida optimizada:
 * - Inicialización única (useEffect []) para evitar la creación/destrucción repetida de contextos WebGL.
 * - Variables de tiempo, fase y conteo gestionadas con useRef para evitar Stale Closures a 30 FPS.
 * - Temporizador del Paso 1 basado en Date.now() independiente de re-renders de React.
 * - Logs detallados por consola en cada paso para diagnóstico con F12.
 */
export default function Calibration({ onBackToMenu }) {
  const { t } = useSettings();

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

  // Flujo de cámara y guardia
  const [cameraStatus, setCameraStatus] = useState('idle'); // idle | requesting | ready | error
  const [cameraErrorKey, setCameraErrorKey] = useState('');
  const [showGuardGuide, setShowGuardGuide] = useState(false);
  const [guardPhase, setGuardPhaseState] = useState('listo'); // listo | cuenta | midiendo | resultado
  const [guardCountdown, setGuardCountdown] = useState(GUARD_COUNTDOWN_S);
  const [guardResult, setGuardResult] = useState(null);
  const guardPhaseRef = useRef('listo');
  const guardFramesRef = useRef([]);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // La fase de guardia vive en estado (para la UI) y en ref (para onResults a 30 FPS)
  const setGuardPhase = (phase) => {
    guardPhaseRef.current = phase;
    setGuardPhaseState(phase);
  };

  // Flujo del jab (mismo esquema que la guardia)
  const [showPunchGuide, setShowPunchGuide] = useState(false);
  // Recalibración desde el sandbox: movimiento elegido (guard | jab | hook | dodge)
  // o null cuando se hace el proceso completo
  const [singleMove, setSingleMove] = useState(null);
  const [showMoveChooser, setShowMoveChooser] = useState(false);
  const [punchPhase, setPunchPhaseState] = useState('listo'); // listo | cuenta | midiendo | resultado
  const [punchCountdown, setPunchCountdown] = useState(GUARD_COUNTDOWN_S);
  const [punchResult, setPunchResult] = useState(null);
  const [punchCount, setPunchCount] = useState(0);
  const punchPhaseRef = useRef('listo');
  const punchTrackerRef = useRef(newPunchTracker());
  const punchTimerRef = useRef({ startTime: null });

  const setPunchPhase = (phase) => {
    punchPhaseRef.current = phase;
    setPunchPhaseState(phase);
  };

  // Sandbox (paso 5): datos de la sesión en ref (30 FPS) y una copia para la UI
  const sandboxRef = useRef(newSandbox());
  const [sandboxView, setSandboxView] = useState(null);
  // Guardado en la base de datos: idle | saving | ok | error
  const [saveState, setSaveState] = useState({ status: 'idle', message: '' });
  // Resultados aceptados de cada paso (se guardan junto a la calibración)
  const stepResultsRef = useRef({});

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

  // Acción que muestra cada guante y hasta cuándo se mantiene el golpe en pantalla
  const gloveActionRef = useRef({
    left: { action: 'guardia', until: 0, candidate: 'guardia', frames: 0 },
    right: { action: 'guardia', until: 0, candidate: 'guardia', frames: 0 },
  });

  // Cambia la imagen del guante directamente en el DOM (sin re-render a 30 FPS)
  const setGloveAction = (side, action) => {
    const state = gloveActionRef.current[side];
    if (state.action === action) return;
    state.action = action;
    // En el sandbox, cada vez que el guante pasa a un golpe se cuenta
    if (stepRef.current === 5 && sandboxRef.current.counts[action]) {
      sandboxRef.current.counts[action][side] += 1;
    }
    const el = side === 'left' ? leftGloveRef.current : rightGloveRef.current;
    if (el) el.src = GLOVE_IMAGES[side][action];
  };

  // Precargar las imágenes de jab y hook para que no parpadeen la primera vez
  useEffect(() => {
    [jabIzq, jabDer, hookIzq, hookDer].forEach((src) => {
      const img = new Image();
      img.src = src;
    });
  }, []);

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
      // La guardia no mide hasta que el usuario pulsa Calibrar y termina la cuenta regresiva
      isCapturingRef.current = false;
      neutralTimerRef.current = { startTime: null, samples: [], lastLoggedSec: -1 };
      guardFramesRef.current = [];
      setGuardResult(null);
      setGuardPhase('listo');
    } else if (punchForStep(newStep)) {
      // Jab, gancho y esquiva: no miden hasta pulsar Calibrar y terminar la cuenta regresiva
      isCapturingRef.current = false;
      metricsBufferRef.current.maxReach = 0;
      metricsBufferRef.current.maxHookRange = 0;
      punchTrackerRef.current = newPunchTracker();
      punchTimerRef.current = { startTime: null };
      setPunchCount(0);
      setPunchResult(null);
      setPunchPhase('listo');
    } else if (newStep === 5) {
      // Sandbox: empieza una sesión de práctica nueva
      isCapturingRef.current = false;
      sandboxRef.current = newSandbox();
      setSandboxView(snapshotSandbox(sandboxRef.current, gloveActionRef.current, Date.now()));
      setSaveState({ status: 'idle', message: '' });
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

  // Cuenta regresiva de la guardia: al llegar a 0 empieza la medición
  useEffect(() => {
    if (guardPhase !== 'cuenta') return undefined;

    if (guardCountdown <= 0) {
      console.log(`[VORTEX] Cuenta regresiva terminada. Midiendo la guardia durante ${GUARD_SAMPLE_S} s...`);
      neutralTimerRef.current = { startTime: null, samples: [], lastLoggedSec: -1 };
      guardFramesRef.current = [];
      setLiveMetrics((prev) => ({ ...prev, countdownSeconds: GUARD_SAMPLE_S, progressPercent: 0 }));
      isCapturingRef.current = true;
      setGuardPhase('midiendo');
      return undefined;
    }

    const timeoutId = setTimeout(() => setGuardCountdown((n) => n - 1), 1000);
    return () => clearTimeout(timeoutId);
  }, [guardPhase, guardCountdown]);

  // Cuenta regresiva del golpe (jab o gancho): al llegar a 0 empieza la medición
  useEffect(() => {
    if (punchPhase !== 'cuenta') return undefined;
    const type = punchForStep(currentStep);
    if (!type) return undefined;

    if (punchCountdown <= 0) {
      const { sampleS } = PUNCHES[type];
      console.log(`[VORTEX] Cuenta regresiva terminada. Midiendo ${type} durante ${sampleS} s...`);
      punchTrackerRef.current = newPunchTracker();
      punchTimerRef.current = { startTime: null };
      metricsBufferRef.current.maxReach = 0;
      metricsBufferRef.current.maxHookRange = 0;
      setPunchCount(0);
      setLiveMetrics((prev) => ({ ...prev, countdownSeconds: sampleS, progressPercent: 0 }));
      isCapturingRef.current = true;
      setPunchPhase('midiendo');
      return undefined;
    }

    const timeoutId = setTimeout(() => setPunchCountdown((n) => n - 1), 1000);
    return () => clearTimeout(timeoutId);
  }, [punchPhase, punchCountdown, currentStep]);

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
          console.warn('[VORTEX] ⏸️ Hombros no visibles. Reiniciando la medición de la guardia.');
          neutralTimerRef.current.startTime = null;
          neutralTimerRef.current.samples = [];
          guardFramesRef.current = [];
          setLiveMetrics((prev) => ({ ...prev, countdownSeconds: GUARD_SAMPLE_S, progressPercent: 0 }));
        }
        return;
      }

      // =====================================================================
      // MAPEO MUÑECAS -> GUANTES (Landmarks 15 y 16)
      // Modo espejo: la mano izquierda del usuario se ve a la izquierda.
      // La Z de la muñeca relativa al hombro simula profundidad: al golpear
      // hacia la cámara el guante crece. Si la mano lanza un jab o un hook,
      // el guante cambia a esa imagen al menos ACTION_HOLD_MS.
      // =====================================================================
      const frameTime = Date.now();
      [
        { side: 'left', wrist: poseLandmarks[15], shoulder: poseLandmarks[11] },
        { side: 'right', wrist: poseLandmarks[16], shoulder: poseLandmarks[12] },
      ].forEach(({ side, wrist, shoulder }) => {
        if (!wrist || (wrist.visibility ?? 0) < 0.3) return;

        const actionState = gloveActionRef.current[side];
        const action = detectHandAction(
          poseLandmarks, side, calibratedParamsRef.current, actionState.action
        );
        // Un golpe sólo se acepta si se detecta varios fotogramas seguidos
        if (action === actionState.candidate) {
          actionState.frames += 1;
        } else {
          actionState.candidate = action;
          actionState.frames = 1;
        }
        const confirmed = action !== 'guardia' && actionState.frames >= ACTION_CONFIRM_FRAMES;
        if (confirmed) {
          actionState.until = frameTime + ACTION_HOLD_MS;
          setGloveAction(side, action);
        } else if (frameTime >= actionState.until) {
          setGloveAction(side, 'guardia');
        }

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
      // PASO 1: GUARDIA (sólo mide tras pulsar Calibrar y terminar la cuenta)
      // Guarda el centro del torso (como antes) y, en cada fotograma, si las
      // manos están en guardia y qué tan visibles son los puntos del cuerpo.
      // =====================================================================
      if (currentStepNum === 1 && guardPhaseRef.current === 'midiendo' && isCapturingRef.current && currentTorso) {
        const timer = neutralTimerRef.current;

        if (!timer.startTime) {
          timer.startTime = now;
          timer.samples = [];
          timer.lastLoggedSec = -1;
          guardFramesRef.current = [];
          console.log(`[VORTEX] Iniciando medición de guardia (${GUARD_SAMPLE_S} segundos)...`);
        }

        timer.samples.push(currentTorso);
        const visibility = GUARD_VISIBILITY_POINTS.reduce(
          (acc, i) => acc + (poseLandmarks[i]?.visibility ?? 0), 0
        ) / GUARD_VISIBILITY_POINTS.length;
        // Se mide con los umbrales previos a esta guardia para ver qué se detectaba
        const prevParams = { ...calibratedParamsRef.current, guard: null };
        guardFramesRef.current.push({
          guard: isGuardPose(poseLandmarks),
          visibility,
          hands: {
            left: measureHand(poseLandmarks, 'left', prevParams),
            right: measureHand(poseLandmarks, 'right', prevParams),
          },
        });

        const elapsedSec = (now - timer.startTime) / 1000;
        const remaining = Math.max(0, GUARD_SAMPLE_S - elapsedSec);
        const percent = Math.min(100, (elapsedSec / GUARD_SAMPLE_S) * 100);

        // Logging en consola cada 0.5s para monitoreo en F12
        const currentHalfSec = Math.floor(elapsedSec * 2) / 2;
        if (currentHalfSec !== timer.lastLoggedSec) {
          console.log(`[VORTEX] Guardia: ${elapsedSec.toFixed(1)}s / ${GUARD_SAMPLE_S}s (${timer.samples.length} muestras)`);
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

        // Al cumplirse el tiempo de medición
        if (elapsedSec >= GUARD_SAMPLE_S && timer.samples.length >= GUARD_MIN_SAMPLES) {
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

          const result = computeGuardScore(samples, guardFramesRef.current);
          const limbs = computeLimbStats(guardFramesRef.current);

          // Recalcular: perfil de guardia (media ± σ) con tus medidas y alcance
          // máximo de la guardia (el umbral del jab del juego debe superarlo)
          const guardData = {
            maxReach: Number(Math.max(limbs.left.reachMax, limbs.right.reachMax).toFixed(3)),
            maxForward: Number(Math.max(limbs.left.forwardMax, limbs.right.forwardMax, 0).toFixed(3)),
            profile: buildGuardProfile(guardFramesRef.current),
          };
          result.profile = guardData.profile;
          calibratedParamsRef.current.guard = guardData;
          setCalibratedParams((prev) => ({ ...prev, guard: guardData }));
          result.limbs = limbs;
          result.newJabMin = Number((guardData.maxReach * GUARD_REACH_MARGIN).toFixed(3));
          console.log('[VORTEX] Guardia medida. Centro del torso:', neutral, 'Resultado:', result, 'Guardia:', guardData);

          // Mostrar el popup de resultado; el usuario decide si repite o continúa al Jab
          isCapturingRef.current = false;
          setGuardResult(result);
          setGuardPhase('resultado');
        }
      }

      // =====================================================================
      // PASOS 2 Y 3: JAB Y GANCHO (sólo miden tras pulsar Calibrar y la cuenta)
      // Sigue cada golpe como un episodio: sale del perfil de guardia y vuelve.
      // Se mide sin el perfil previo de ese golpe para no sesgarlo.
      // =====================================================================
      const punchType = punchForStep(currentStepNum);
      if (punchType && punchPhaseRef.current === 'midiendo' && isCapturingRef.current) {
        const cfg = PUNCHES[punchType];
        const timer = punchTimerRef.current;
        if (!timer.startTime) {
          timer.startTime = now;
          console.log(`[VORTEX] Iniciando medición de ${punchType} (${cfg.sampleS} segundos)...`);
        }

        const measureParams = { ...calibratedParamsRef.current, [punchType]: null };
        const guardProfileAll = calibratedParamsRef.current.guard?.profile || GUARD_PROFILE_DEFAULT;
        const tracker = punchTrackerRef.current;
        // El lado más extendido en este fotograma (para la UI). En la esquiva
        // los lados son direcciones y se mide el cuerpo, no la mano.
        let active = null;
        ['left', 'right'].forEach((side) => {
          const h = cfg.measure
            ? cfg.measure(poseLandmarks, measureParams, side)
            : measureHand(poseLandmarks, side, measureParams);
          if (!h) return;
          if (!active || h[cfg.peakKey] > active[cfg.peakKey]) active = h;
          stepPunchTracker(tracker[side], h, guardProfileAll[side], punchType);
        });
        const isBodyMove = Boolean(cfg.measure);
        if (active && !isBodyMove) {
          metricsBufferRef.current.maxReach = Math.max(metricsBufferRef.current.maxReach, active.reach);
          metricsBufferRef.current.maxHookRange = Math.max(metricsBufferRef.current.maxHookRange, active.rangeX);
        }

        const elapsedSec = (now - timer.startTime) / 1000;
        if (now - lastUiUpdateRef.current > 66) {
          lastUiUpdateRef.current = now;
          setPunchCount(countPunches(tracker));
          setLiveMetrics((prev) => ({
            ...prev,
            ...(active && !isBodyMove ? {
              jabExtension: Number(active.reach.toFixed(2)),
              hookAngle: active.angle,
              hookRange: Number(active.lateral.toFixed(2)),
            } : {}),
            ...(active && isBodyMove ? { dodgeDisplacement: Number(active.shift.toFixed(2)) } : {}),
            countdownSeconds: Number(Math.max(0, cfg.sampleS - elapsedSec).toFixed(1)),
            progressPercent: Math.min(100, (elapsedSec / cfg.sampleS) * 100),
          }));
        }

        if (elapsedSec >= cfg.sampleS) {
          ['left', 'right'].forEach((side) => {
            if (tracker[side].active) closePunchEpisode(tracker[side]);
          });
          const result = computePunchResult(tracker, punchType);
          console.log(`[VORTEX] ${punchType} medido:`, result);
          isCapturingRef.current = false;
          setPunchCount(result.punches);
          setPunchResult(result);
          setPunchPhase('resultado');
        }
      }

      // =====================================================================
      // PASO 5: SANDBOX (práctica libre con las estadísticas en vivo)
      // Los golpes se cuentan en setGloveAction; aquí se detecta la esquiva
      // (con confirmación de varios fotogramas, igual que los guantes), se
      // guardan las medidas actuales y los máximos de la sesión.
      // =====================================================================
      if (currentStepNum === 5) {
        const sb = sandboxRef.current;
        const params = calibratedParamsRef.current;

        // Esquiva con histéresis y confirmación
        const { dir, measures } = detectDodge(poseLandmarks, params, sb.dodge.dir);
        if (dir === sb.dodge.candidate) {
          sb.dodge.frames += 1;
        } else {
          sb.dodge.candidate = dir;
          sb.dodge.frames = 1;
        }
        if (sb.dodge.frames >= ACTION_CONFIRM_FRAMES && dir !== sb.dodge.dir) {
          if (dir) sb.counts.dodge[dir] += 1;
          sb.dodge.dir = dir;
        }

        // Medidas actuales y máximos de cada mano y de cada dirección
        ['left', 'right'].forEach((side) => {
          const h = measureHand(poseLandmarks, side, params, gloveActionRef.current[side].action);
          sb.live.hands[side] = h;
          if (h) {
            sb.max.reachRatio[side] = Math.max(sb.max.reachRatio[side], h.ratio);
            sb.max.lateral[side] = Math.max(sb.max.lateral[side], h.lateral);
          }
          const d = measures[side];
          sb.live.dodge[side] = d;
          if (d) sb.max.dodgeShift[side] = Math.max(sb.max.dodgeShift[side], d.shift);
        });

        if (now - sb.lastUi > 150) {
          sb.lastUi = now;
          setSandboxView(snapshotSandbox(sb, gloveActionRef.current, now));
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

    // La cámara NO se enciende aquí: espera a que el usuario la autorice en el popup
    // de acceso (requestCamera), para que el permiso del navegador tenga contexto.
    cameraInstanceRef.current = camera;

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
  // FLUJO DE CÁMARA Y GUARDIA
  // =========================================================================

  // 1. Pedir acceso a la cámara (dispara el aviso de permiso del navegador)
  const requestCamera = async () => {
    setCameraStatus('requesting');
    setCameraErrorKey('');
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw Object.assign(new Error('getUserMedia no disponible'), { name: 'NotSupportedError' });
      }
      // Pedimos el permiso explícitamente para poder distinguir "denegado" de otros errores
      const probe = await navigator.mediaDevices.getUserMedia({ video: true });
      probe.getTracks().forEach((track) => track.stop());

      await cameraInstanceRef.current.start();
      if (!mountedRef.current) {
        try { cameraInstanceRef.current.stop(); } catch (e) {}
        return;
      }
      console.log('[VORTEX] Cámara conectada.');
      setCameraStatus('ready');
      setShowGuardGuide(true);
    } catch (err) {
      console.error('[VORTEX] Error al iniciar cámara:', err);
      if (!mountedRef.current) return;
      setCameraStatus('error');
      if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') {
        setCameraErrorKey('calib_cam_denegada');
      } else if (err?.name === 'NotFoundError' || err?.name === 'OverconstrainedError') {
        setCameraErrorKey('calib_cam_no_encontrada');
      } else {
        setCameraErrorKey('calib_cam_error');
      }
    }
  };

  // 2. Cerrar la guía de la guardia (la primera vez pasa al paso de guardia)
  const handleConfirmGuide = () => {
    setShowGuardGuide(false);
    if (stepRef.current === 0) setStep(1);
  };

  // 3. Botón Calibrar: cuenta regresiva para que el usuario se acomode
  const handleCalibrateGuard = () => {
    if (!isUserPresentRef.current) return;
    setGuardResult(null);
    setGuardCountdown(GUARD_COUNTDOWN_S);
    setGuardPhase('cuenta');
  };

  // 4a. Repetir: vuelve al botón Calibrar
  const handleRepeatGuard = () => {
    isCapturingRef.current = false;
    neutralTimerRef.current = { startTime: null, samples: [], lastLoggedSec: -1 };
    guardFramesRef.current = [];
    setGuardResult(null);
    setGuardPhase('listo');
  };

  // 4b. Continuar: guarda el centro del torso medido y pasa al Jab (con su guía).
  // Si se está recalibrando sólo la guardia, vuelve al sandbox.
  const handleContinueToJab = () => {
    stepResultsRef.current.guard = summarizeResult(guardResult);
    if (singleMove) {
      console.log('[VORTEX] Guardia recalibrada. Volviendo al sandbox.');
      setSingleMove(null);
      setStep(5);
      return;
    }
    console.log('[VORTEX] Guardia aceptada. Avanzando al Paso 2: Calibración de Jab.');
    setStep(2);
    setShowPunchGuide(true);
  };

  // =========================================================================
  // FLUJO DE GOLPES: JAB Y GANCHO (guía -> Calibrar -> cuenta -> medición -> resultado)
  // =========================================================================
  const handleCalibratePunch = () => {
    if (!isUserPresentRef.current) return;
    setPunchResult(null);
    setPunchCountdown(GUARD_COUNTDOWN_S);
    setPunchPhase('cuenta');
  };

  const handleRepeatPunch = () => {
    isCapturingRef.current = false;
    punchTrackerRef.current = newPunchTracker();
    punchTimerRef.current = { startTime: null };
    setPunchCount(0);
    setPunchResult(null);
    setPunchPhase('listo');
  };

  // Copia el perfil de una mano a la otra si sólo se midió una
  const mirrorProfile = (profile) => ({
    left: profile.left || profile.right,
    right: profile.right || profile.left,
  });

  // Continuar: guarda el perfil del golpe (para la detección) y los umbrales
  // que usa el juego, y pasa al siguiente paso
  const handleContinuePunch = () => {
    const type = punchForStep(stepRef.current);
    if (!type) return;
    const result = punchResult;
    const measured = result && result.punches > 0;
    let data;

    if (type === 'jab') {
      const guardMax = calibratedParamsRef.current.guard?.maxReach || 0;
      if (measured) {
        // Umbral del juego: el jab más bajo (media - 2σ), por encima de la guardia
        // pero nunca por encima de tu alcance medio (debe poder alcanzarse)
        const threshold = Math.min(result.reachMean, Math.max(result.reachLow, guardMax * 1.05));
        data = {
          maxReach: Number(metricsBufferRef.current.maxReach.toFixed(3)),
          threshold: Number(threshold.toFixed(3)),
          profile: mirrorProfile(result.profile),
        };
      } else {
        const max = metricsBufferRef.current.maxReach || 0.45;
        const threshold = Math.max(max * 0.8, guardMax * GUARD_REACH_MARGIN);
        data = { maxReach: Number(max.toFixed(3)), threshold: Number(threshold.toFixed(3)), profile: null };
      }
    } else if (type === 'hook') {
      if (measured) {
        // Gancho: ángulo medio del codo y apertura lateral mínima (media - 2σ)
        const profile = mirrorProfile(result.profile);
        const lateralRange = Math.min(result.rangeMean, Math.max(result.rangeLow, 0.05));
        data = {
          elbowAngle: Math.round((profile.left.angle.mean + profile.right.angle.mean) / 2),
          lateralRange: Number(lateralRange.toFixed(3)),
          profile,
        };
      } else {
        data = { elbowAngle: 88, lateralRange: DEFAULT_HOOK_RANGE, profile: null };
      }
    } else if (measured) {
      // Esquiva: desplazamiento máximo hacia cada lado y umbral para el juego
      // (la esquiva más corta, media - 2σ, sin pasar de tu desplazamiento medio)
      const { left, right } = result.limbs;
      const maxLeft = left.count ? left.absShiftMax : right.absShiftMax;
      const maxRight = right.count ? right.absShiftMax : left.absShiftMax;
      const threshold = Math.min(result.shiftMean, Math.max(result.shiftLow, 0.03));
      data = {
        maxLeanLeft: Number(maxLeft.toFixed(3)),
        maxLeanRight: Number(maxRight.toFixed(3)),
        threshold: Number(threshold.toFixed(3)),
        profile: mirrorProfile(result.profile),
      };
    } else {
      data = { maxLeanLeft: 0.07, maxLeanRight: 0.07, threshold: 0.05, profile: null };
    }

    calibratedParamsRef.current[type] = data;
    setCalibratedParams((prev) => ({ ...prev, [type]: data }));
    stepResultsRef.current[type] = summarizeResult(result);
    console.log(`[VORTEX] Paso ${PUNCHES[type].step} completado. ${type} calibrado:`, data);

    // Recalibrando un solo movimiento: vuelve al sandbox; si no, al siguiente paso
    const nextStep = singleMove ? 5 : PUNCHES[type].step + 1;
    setSingleMove(null);
    setStep(nextStep);
    // Si el siguiente paso también es un golpe, mostrar su guía
    if (punchForStep(nextStep)) setShowPunchGuide(true);
  };

  // Golpe que se calibra en el paso actual (jab, hook, dodge o null)
  const activePunch = punchForStep(currentStep);
  const activePunchCfg = activePunch ? PUNCHES[activePunch] : null;

  // =========================================================================
  // SANDBOX: SALIR Y GUARDAR LOS CAMBIOS EN LA BASE DE DATOS
  // Guarda la calibración (perfiles y umbrales), las puntuaciones de cada
  // paso y las estadísticas de esta sesión de práctica para el usuario.
  // =========================================================================
  const handleSaveAndExit = async () => {
    if (saveState.status === 'saving') return;
    setSaveState({ status: 'saving', message: '' });
    const payload = {
      calibration: calibratedParamsRef.current,
      results: stepResultsRef.current,
      sandbox: buildSandboxStats(sandboxRef.current),
    };
    try {
      await saveMyCalibration(payload);
      if (!mountedRef.current) return;
      console.log('[VORTEX] Calibración y sesión de práctica guardadas.', payload);
      setSaveState({ status: 'ok', message: '' });
    } catch (err) {
      console.error('[VORTEX] Error al guardar la calibración:', err);
      if (!mountedRef.current) return;
      const messageKey = err?.status === 401
        ? 'calib_guardar_sesion'
        : err?.status === 0 ? 'calib_guardar_conexion' : '';
      setSaveState({ status: 'error', message: messageKey ? t(messageKey) : (err?.message || '') });
    }
  };

  // =========================================================================
  // SANDBOX: VOLVER A CALIBRAR
  // - Todo el proceso: guardia -> jab -> gancho -> esquiva -> sandbox.
  // - Un solo movimiento: ese paso y, al continuar, de vuelta al sandbox.
  // Los perfiles que no se recalibran se conservan.
  // =========================================================================
  const handleRecalibrateAll = () => {
    console.log('[VORTEX] Recalibrando todo el proceso desde la guardia.');
    setShowMoveChooser(false);
    setSingleMove(null);
    setStep(1);
    setShowGuardGuide(true);
  };

  const handleRecalibrateMove = (move) => {
    console.log(`[VORTEX] Recalibrando sólo: ${move}.`);
    setShowMoveChooser(false);
    setSingleMove(move);
    if (move === 'guard') {
      setStep(1);
      setShowGuardGuide(true);
    } else {
      setStep(PUNCHES[move].step);
      setShowPunchGuide(true);
    }
  };

  return (
    <div className="calibration-wrapper">
      {/* Botón Atrás (esquina superior izquierda) */}
      <button
        type="button"
        className="btn-calib-back"
        onClick={onBackToMenu}
        aria-label={t('aria_atras_menu')}
      >
        {t('atras')}
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
      <aside className="calibration-panel" aria-label={t('calib_aria_panel')}>
        <div className="hud-status">
          <div className="hud-status-row">
            <span className="hud-status-label">{t('calib_fase')}</span>
            <span className="hud-status-value">{t(`calib_fase_${currentStep}`)}</span>
          </div>
          <div className="hud-status-row">
            <span className="hud-status-label">{t('calib_postura')}</span>
            <span className={`hud-status-value ${isUserPresent ? 'is-ok' : 'is-bad'}`}>
              {isUserPresent ? t('calib_postura_ok') : t('calib_postura_no')}
            </span>
          </div>
        </div>

        {/* Stepper de fases */}
        <ol className="calibration-stepper" aria-label={t('calib_aria_progreso')}>
          {PHASES.map((st) => (
            <li
              key={st.id}
              className={`step-item ${currentStep === st.id ? 'is-active' : ''} ${
                currentStep > st.id ? 'is-completed' : ''
              }`}
              aria-current={currentStep === st.id ? 'step' : undefined}
            >
              <span className="step-number">{currentStep > st.id ? '✓' : st.id}</span>
              <span className="step-label">{t(st.labelKey)}</span>
            </li>
          ))}
        </ol>

        <section className="calibration-step-body">
          {/* PASO 0: ACCESO A LA CÁMARA */}
          {currentStep === 0 && (
            <>
              <div className="step-info-header">
                <span className="step-tag">{t('calib_paso_de', { n: 0 })}</span>
                <p className="step-instruction">
                  {t('calib_instr_0')}
                </p>
              </div>

              {cameraStatus === 'ready' && (
                <button
                  type="button"
                  className="btn-calib-action"
                  onClick={() => setShowGuardGuide(true)}
                >
                  {t('calib_btn_ver_guia')}
                </button>
              )}
            </>
          )}

          {/* PASO 1: GUARDIA */}
          {currentStep === 1 && (
            <>
              <div className="step-info-header">
                <span className="step-tag">{t('calib_paso_de', { n: 1 })}</span>
                <p className="step-instruction">
                  {guardPhase === 'cuenta'
                    ? t('calib_preparate', { n: guardCountdown })
                    : guardPhase === 'midiendo'
                      ? t('calib_midiendo')
                      : t('calib_instr_1')}
                </p>
              </div>

              <div className="step-metric-panel">
                <div className="metric-row">
                  <span className="metric-label">{t('calib_hombros')}</span>
                  <span className={`metric-value ${isUserPresent ? 'is-ok' : 'is-bad'}`}>
                    {isUserPresent ? t('calib_visibles') : t('calib_no_detectados')}
                  </span>
                </div>
                {guardPhase === 'midiendo' && (
                  <>
                    <div className="metric-row">
                      <span className="metric-label">{t('calib_tiempo')}</span>
                      <span className="metric-value">{liveMetrics.countdownSeconds}s</span>
                    </div>
                    <div className="calib-progress-bar-bg">
                      <div
                        className="calib-progress-bar-fill"
                        style={{ width: `${liveMetrics.progressPercent}%` }}
                      />
                    </div>
                    <div className="metric-row">
                      <span className="metric-label">{t('calib_sensor')}</span>
                      <span className={`metric-value ${isUserPresent ? 'is-ok' : 'is-bad'}`}>
                        {isUserPresent ? t('calib_muestreando') : t('calib_pausado')}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {guardPhase === 'listo' && (
                <>
                  <button
                    type="button"
                    className="btn-calib-action"
                    onClick={handleCalibrateGuard}
                    disabled={!isUserPresent}
                  >
                    {isUserPresent ? t('calib_btn_calibrar') : t('calib_btn_esperando')}
                  </button>
                  <button
                    type="button"
                    className="btn-calib-action btn-calib-secondary"
                    onClick={() => setShowGuardGuide(true)}
                  >
                    {t('calib_btn_ver_guia')}
                  </button>
                </>
              )}
            </>
          )}

          {/* PASOS 2 Y 3: JAB Y GANCHO (mismo flujo que la guardia) */}
          {activePunch && (
            <>
              <div className="step-info-header">
                <span className="step-tag">{t('calib_paso_de', { n: currentStep })}</span>
                <p className="step-instruction">
                  {punchPhase === 'cuenta'
                    ? t('calib_preparate', { n: punchCountdown })
                    : punchPhase === 'midiendo'
                      ? t(activePunchCfg.keys.measuring)
                      : t(activePunchCfg.keys.instr)}
                </p>
              </div>

              <div className="step-metric-panel">
                <div className="metric-row">
                  <span className="metric-label">{t('calib_hombros')}</span>
                  <span className={`metric-value ${isUserPresent ? 'is-ok' : 'is-bad'}`}>
                    {isUserPresent ? t('calib_visibles') : t('calib_no_detectados')}
                  </span>
                </div>
                {punchPhase === 'midiendo' && (
                  <>
                    <div className="metric-row">
                      <span className="metric-label">{t('calib_tiempo')}</span>
                      <span className="metric-value">{liveMetrics.countdownSeconds}s</span>
                    </div>
                    <div className="calib-progress-bar-bg">
                      <div
                        className="calib-progress-bar-fill"
                        style={{ width: `${liveMetrics.progressPercent}%` }}
                      />
                    </div>
                    <div className="metric-row">
                      <span className="metric-label">{t(activePunchCfg.keys.counted)}</span>
                      <span className="metric-value is-ok">{punchCount} / {activePunchCfg.target}</span>
                    </div>
                    {activePunch === 'jab' && (
                      <div className="metric-row">
                        <span className="metric-label">{t('calib_ext_actual')}</span>
                        <span className="metric-value">{liveMetrics.jabExtension}</span>
                      </div>
                    )}
                    {activePunch === 'hook' && (
                      <>
                        <div className="metric-row">
                          <span className="metric-label">{t('calib_angulo')}</span>
                          <span className="metric-value">{liveMetrics.hookAngle}°</span>
                        </div>
                        <div className="metric-row">
                          <span className="metric-label">{t('calib_det_lateral_ratio')}</span>
                          <span className="metric-value">{liveMetrics.hookRange}×</span>
                        </div>
                      </>
                    )}
                    {activePunch === 'dodge' && (
                      <div className="metric-row">
                        <span className="metric-label">{t('calib_det_desplazamiento_ratio')}</span>
                        <span className="metric-value">{liveMetrics.dodgeDisplacement}×</span>
                      </div>
                    )}
                  </>
                )}
              </div>

              {punchPhase === 'listo' && (
                <>
                  <button
                    type="button"
                    className="btn-calib-action"
                    onClick={handleCalibratePunch}
                    disabled={!isUserPresent}
                  >
                    {isUserPresent ? t('calib_btn_calibrar') : t('calib_btn_esperando')}
                  </button>
                  <button
                    type="button"
                    className="btn-calib-action btn-calib-secondary"
                    onClick={() => setShowPunchGuide(true)}
                  >
                    {t('calib_btn_ver_guia')}
                  </button>
                </>
              )}
            </>
          )}

          {/* PASO 5: SANDBOX (PRÁCTICA LIBRE CON ESTADÍSTICAS EN VIVO) */}
          {currentStep === 5 && sandboxView && (
            <>
              <div className="step-info-header">
                <span className="step-tag is-ok">{t('calib_sandbox_tag')}</span>
                <p className="step-instruction">{t('calib_instr_5')}</p>
              </div>

              <div className="step-metric-panel">
                <div className="metric-row">
                  <span className="metric-label">{t('calib_sandbox_tiempo')}</span>
                  <span className="metric-value">
                    {Math.floor(sandboxView.elapsedS / 60)}:{String(sandboxView.elapsedS % 60).padStart(2, '0')}
                  </span>
                </div>
                <div className="metric-row">
                  <span className="metric-label">{t('calib_sandbox_esquiva_actual')}</span>
                  <span className={`metric-value ${sandboxView.dodgeDir ? 'is-ok' : ''}`}>
                    {sandboxView.dodgeDir
                      ? t(sandboxView.dodgeDir === 'left' ? 'calib_det_dir_izq' : 'calib_det_dir_der')
                      : t('calib_sandbox_ninguna')}
                  </span>
                </div>
              </div>

              <table className="calib-details-table calib-sandbox-table">
                <thead>
                  <tr>
                    <th scope="col">{t('calib_det_medida')}</th>
                    <th scope="col">{t('calib_det_izq')}</th>
                    <th scope="col">{t('calib_det_der')}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">{t('calib_sandbox_accion')}</th>
                    {['left', 'right'].map((side) => (
                      <td key={side} className={sandboxView.actions[side] !== 'guardia' ? 'is-ok' : ''}>
                        {t(`calib_accion_${sandboxView.actions[side]}`)}
                      </td>
                    ))}
                  </tr>
                  {[
                    { key: 'calib_sandbox_jabs', get: (s) => sandboxView.counts.jab[s] },
                    { key: 'calib_sandbox_ganchos', get: (s) => sandboxView.counts.hook[s] },
                    { key: 'calib_sandbox_esquivas', get: (s) => sandboxView.counts.dodge[s] },
                    { key: 'calib_det_ratio', get: (s) => (sandboxView.hands[s] ? `${sandboxView.hands[s].ratio.toFixed(2)}×` : '—') },
                    { key: 'calib_det_angulo', get: (s) => (sandboxView.hands[s] ? `${sandboxView.hands[s].angle}°` : '—') },
                    { key: 'calib_det_profundidad_ratio', get: (s) => (sandboxView.hands[s] ? `${sandboxView.hands[s].depth.toFixed(2)}×` : '—') },
                    { key: 'calib_det_lateral_ratio', get: (s) => (sandboxView.hands[s] ? `${sandboxView.hands[s].lateral.toFixed(2)}×` : '—') },
                    { key: 'calib_sandbox_desplazamiento', get: (s) => (sandboxView.dodge[s] !== null ? `${sandboxView.dodge[s].toFixed(2)}×` : '—') },
                    { key: 'calib_sandbox_max_alcance', get: (s) => `${sandboxView.max.reachRatio[s].toFixed(2)}×` },
                    { key: 'calib_sandbox_max_lateral', get: (s) => `${sandboxView.max.lateral[s].toFixed(2)}×` },
                    { key: 'calib_sandbox_max_esquiva', get: (s) => `${sandboxView.max.dodgeShift[s].toFixed(2)}×` },
                  ].map((row) => (
                    <tr key={row.key}>
                      <th scope="row">{t(row.key)}</th>
                      <td>{row.get('left')}</td>
                      <td>{row.get('right')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="calib-details-note">{t('calib_sandbox_nota')}</p>

              <div className="calib-summary-grid">
                <div className="summary-item">
                  <span className="summary-label">{t('calib_umbral_jab')}</span>
                  <span className="summary-val">{calibratedParams.jab.threshold}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">{t('calib_angulo_gancho')}</span>
                  <span className="summary-val">{calibratedParams.hook.elbowAngle}°</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">{t('calib_rango_gancho')}</span>
                  <span className="summary-val">{calibratedParams.hook.lateralRange}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">{t('calib_umbral_esquiva')}</span>
                  <span className="summary-val">{calibratedParams.dodge.threshold}</span>
                </div>
              </div>

              <button
                type="button"
                className="btn-calib-action btn-ready-to-fight"
                onClick={handleSaveAndExit}
                disabled={saveState.status === 'saving'}
              >
                {saveState.status === 'saving' ? t('calib_guardando') : t('calib_btn_salir_guardar')}
              </button>
              <button
                type="button"
                className="btn-calib-action btn-calib-secondary"
                onClick={handleRecalibrateAll}
              >
                {t('calib_btn_recalibrar_todo')}
              </button>
              <button
                type="button"
                className="btn-calib-action btn-calib-secondary"
                onClick={() => setShowMoveChooser(true)}
              >
                {t('calib_btn_recalibrar_movimiento')}
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

        {cameraStatus === 'ready' && !isUserPresent && (
          <div className="presence-alert-overlay" role="alert">
            <p className="presence-alert-text">{t('calib_no_usuario')}</p>
          </div>
        )}
      </div>

      {/* =====================================================================
          CUENTA REGRESIVA ANTES DE MEDIR LA GUARDIA
          ===================================================================== */}
      {guardPhase === 'cuenta' && guardCountdown > 0 && (
        <div className="calib-countdown" role="status" aria-label={t('calib_cuenta_aria', { n: guardCountdown })}>
          <span key={guardCountdown} className="calib-countdown-number" aria-hidden="true">
            {guardCountdown}
          </span>
        </div>
      )}

      {/* Cuenta regresiva antes de medir el jab o el gancho */}
      {activePunch && punchPhase === 'cuenta' && punchCountdown > 0 && (
        <div className="calib-countdown" role="status" aria-label={t('calib_cuenta_aria', { n: punchCountdown })}>
          <span key={punchCountdown} className="calib-countdown-number" aria-hidden="true">
            {punchCountdown}
          </span>
        </div>
      )}

      {/* =====================================================================
          POPUP 1: ACCESO A LA CÁMARA
          ===================================================================== */}
      {currentStep === 0 && cameraStatus !== 'ready' && (
        <div className="calib-modal-backdrop">
          <div className="calib-modal" role="dialog" aria-modal="true" aria-labelledby="calib-modal-cam-title">
            <h2 id="calib-modal-cam-title" className="calib-modal-title">{t('calib_cam_titulo')}</h2>
            <p className="calib-modal-text">{t('calib_cam_texto')}</p>
            {cameraStatus === 'error' && (
              <p className="calib-modal-text calib-modal-error" role="alert">{t(cameraErrorKey)}</p>
            )}
            <div className="calib-modal-actions">
              <button
                type="button"
                className="btn-calib-action btn-calib-secondary"
                onClick={onBackToMenu}
              >
                {t('atras')}
              </button>
              <button
                type="button"
                className="btn-calib-action btn-calib-primary"
                onClick={requestCamera}
                disabled={cameraStatus === 'requesting'}
                autoFocus
              >
                {cameraStatus === 'requesting'
                  ? t('calib_cam_esperando')
                  : cameraStatus === 'error'
                    ? t('calib_cam_reintentar')
                    : t('calib_cam_btn')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          POPUP 2: GUÍA DE LA POSICIÓN DE GUARDIA
          ===================================================================== */}
      {showGuardGuide && (
        <div className="calib-modal-backdrop">
          <div className="calib-modal" role="dialog" aria-modal="true" aria-labelledby="calib-modal-guide-title">
            <h2 id="calib-modal-guide-title" className="calib-modal-title">{t('calib_guia_titulo')}</h2>
            <img
              src={guiaGuardia}
              alt={t('calib_guia_alt')}
              className="calib-modal-image"
              draggable={false}
            />
            <p className="calib-modal-text">{t('calib_guia_texto')}</p>
            <div className="calib-modal-actions">
              <button
                type="button"
                className="btn-calib-action btn-calib-primary"
                onClick={handleConfirmGuide}
                autoFocus
              >
                {t('calib_btn_confirmar')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          POPUP 3: RESULTADO DE LA GUARDIA
          ===================================================================== */}
      {currentStep === 1 && guardPhase === 'resultado' && guardResult && (
        <div className="calib-modal-backdrop">
          <div className="calib-modal" role="dialog" aria-modal="true" aria-labelledby="calib-modal-result-title">
            <h2 id="calib-modal-result-title" className="calib-modal-title">{t('calib_res_titulo')}</h2>

            <div className={`calib-score is-${guardResult.level}`}>
              <span className="calib-score-value">{guardResult.score}</span>
              <span className="calib-score-max">{t('calib_res_de')}</span>
              <span className="calib-score-label">{t(`calib_res_${guardResult.level}`)}</span>
            </div>

            <div className="calib-result-bars">
              {[
                { key: 'calib_res_guardia', value: guardResult.guard },
                { key: 'calib_res_estabilidad', value: guardResult.stability },
                { key: 'calib_res_visibilidad', value: guardResult.visibility },
              ].map((item) => (
                <div key={item.key} className="calib-result-row">
                  <div className="metric-row">
                    <span className="metric-label">{t(item.key)}</span>
                    <span className="metric-value">{item.value}%</span>
                  </div>
                  <div
                    className="calib-progress-bar-bg"
                    role="progressbar"
                    aria-label={t(item.key)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={item.value}
                  >
                    <div className="calib-progress-bar-fill" style={{ width: `${item.value}%` }} />
                  </div>
                </div>
              ))}
            </div>

            <p className="calib-modal-text">{t(guardResult.tipKey)}</p>

            {guardResult.limbs && (
              <details className="calib-details">
                <summary className="calib-details-summary">{t('calib_det_titulo')}</summary>
                <table className="calib-details-table">
                  <thead>
                    <tr>
                      <th scope="col">{t('calib_det_medida')}</th>
                      <th scope="col">{t('calib_det_izq')}</th>
                      <th scope="col">{t('calib_det_der')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { key: 'calib_det_alcance', fmt: (h) => h.reachAvg.toFixed(3) },
                      { key: 'calib_det_alcance_max', fmt: (h) => h.reachMax.toFixed(3) },
                      { key: 'calib_det_umbral_jab', fmt: (h) => h.jabThreshold.toFixed(3) },
                      { key: 'calib_det_ratio', fmt: (h) => `${h.ratio.toFixed(2)}×` },
                      { key: 'calib_det_angulo', fmt: (h) => `${h.angle}°` },
                      { key: 'calib_det_profundidad', fmt: (h) => h.forward.toFixed(3) },
                      { key: 'calib_det_profundidad_ratio', fmt: (h) => `${h.depthRatio.toFixed(2)}×` },
                      { key: 'calib_det_desviacion', fmt: (h) => `${h.deviation.toFixed(2)}σ` },
                      { key: 'calib_det_en_perfil', fmt: (h) => `${h.inProfilePct}%`, warn: (h) => h.inProfilePct < 80 },
                      { key: 'calib_det_en_guardia', fmt: (h) => `${h.inGuardPct}%` },
                      { key: 'calib_det_como_jab', fmt: (h) => `${h.jabPct}%`, warn: (h) => h.jabPct > 0 },
                      { key: 'calib_det_como_gancho', fmt: (h) => `${h.hookPct}%`, warn: (h) => h.hookPct > 0 },
                    ].map((row) => (
                      <tr key={row.key}>
                        <th scope="row">{t(row.key)}</th>
                        {['left', 'right'].map((side) => {
                          const h = guardResult.limbs[side];
                          return (
                            <td key={side} className={row.warn?.(h) ? 'is-bad' : ''}>
                              {row.fmt(h)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="calib-details-foot">
                  <div className="metric-row">
                    <span className="metric-label">{t('calib_det_hombros')}</span>
                    <span className="metric-value">{guardResult.limbs.shoulderWidth.toFixed(3)}</span>
                  </div>
                  <div className="metric-row">
                    <span className="metric-label">{t('calib_det_nuevo_umbral')}</span>
                    <span className="metric-value is-ok">{guardResult.newJabMin}</span>
                  </div>
                </div>
                {guardResult.profile && (
                  <table className="calib-details-table calib-details-profile">
                    <caption>{t('calib_det_perfil')}</caption>
                    <thead>
                      <tr>
                        <th scope="col">{t('calib_det_medida')}</th>
                        <th scope="col">{t('calib_det_izq')}</th>
                        <th scope="col">{t('calib_det_der')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { key: 'ratio', label: 'calib_det_ratio', unit: '×' },
                        { key: 'angle', label: 'calib_det_angulo', unit: '°' },
                        { key: 'depth', label: 'calib_det_profundidad_ratio', unit: '×' },
                      ].map((row) => (
                        <tr key={row.key}>
                          <th scope="row">{t(row.label)}</th>
                          {['left', 'right'].map((side) => {
                            const m = guardResult.profile[side][row.key];
                            return (
                              <td key={side}>
                                {m.mean.toFixed(2)}{row.unit} ± {m.sd.toFixed(2)}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <p className="calib-details-note">{t('calib_det_nota')}</p>
              </details>
            )}

            <div className="calib-modal-actions">
              <button
                type="button"
                className="btn-calib-action btn-calib-secondary"
                onClick={handleRepeatGuard}
              >
                {t('calib_btn_repetir')}
              </button>
              <button
                type="button"
                className="btn-calib-action btn-calib-primary"
                onClick={handleContinueToJab}
                autoFocus
              >
                {singleMove ? t('calib_btn_volver_sandbox') : t('calib_btn_continuar_jab')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          POPUP 4: GUÍA DEL GOLPE (JAB, GANCHO O ESQUIVA)
          ===================================================================== */}
      {activePunch && showPunchGuide && (
        <div className="calib-modal-backdrop">
          <div className="calib-modal" role="dialog" aria-modal="true" aria-labelledby="calib-modal-punchguide-title">
            <h2 id="calib-modal-punchguide-title" className="calib-modal-title">{t(activePunchCfg.keys.guideTitle)}</h2>
            <img
              src={PUNCH_GUIDES[activePunch]}
              alt={t(activePunchCfg.keys.guideAlt)}
              className="calib-modal-image"
              draggable={false}
            />
            <p className="calib-modal-text">
              {t(activePunchCfg.keys.guideText, { n: activePunchCfg.target, s: activePunchCfg.sampleS })}
            </p>
            <div className="calib-modal-actions">
              <button
                type="button"
                className="btn-calib-action btn-calib-primary"
                onClick={() => setShowPunchGuide(false)}
                autoFocus
              >
                {t('calib_btn_confirmar')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          POPUP 5: RESULTADO DEL GOLPE (JAB, GANCHO O ESQUIVA)
          ===================================================================== */}
      {activePunch && punchPhase === 'resultado' && punchResult && punchResult.type === activePunch && (
        <div className="calib-modal-backdrop">
          <div className="calib-modal" role="dialog" aria-modal="true" aria-labelledby="calib-modal-punchres-title">
            <h2 id="calib-modal-punchres-title" className="calib-modal-title">{t(activePunchCfg.keys.resTitle)}</h2>

            <div className={`calib-score is-${punchResult.level}`}>
              <span className="calib-score-value">{punchResult.score}</span>
              <span className="calib-score-max">{t('calib_res_de')}</span>
              <span className="calib-score-label">{t(`calib_res_${punchResult.level}`)}</span>
            </div>

            <div className="calib-result-bars">
              {[
                {
                  key: activePunchCfg.keys.resCount,
                  value: punchResult.count,
                  text: `${punchResult.punches} / ${activePunchCfg.target}`,
                },
                { key: 'calib_resj_separacion', value: punchResult.separation },
                { key: 'calib_resj_consistencia', value: punchResult.consistency },
              ].map((item) => (
                <div key={item.key} className="calib-result-row">
                  <div className="metric-row">
                    <span className="metric-label">{t(item.key)}</span>
                    <span className="metric-value">{item.text ?? `${item.value}%`}</span>
                  </div>
                  <div
                    className="calib-progress-bar-bg"
                    role="progressbar"
                    aria-label={t(item.key)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={item.value}
                  >
                    <div className="calib-progress-bar-fill" style={{ width: `${item.value}%` }} />
                  </div>
                </div>
              ))}
            </div>

            <p className="calib-modal-text">{t(punchResult.tipKey)}</p>

            {punchResult.punches > 0 && (
              <details className="calib-details">
                <summary className="calib-details-summary">{t('calib_det_titulo')}</summary>
                <table className="calib-details-table">
                  <thead>
                    <tr>
                      <th scope="col">{t('calib_det_medida')}</th>
                      <th scope="col">{t(activePunchCfg.columns?.[0] || 'calib_det_izq')}</th>
                      <th scope="col">{t(activePunchCfg.columns?.[1] || 'calib_det_der')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {PUNCH_DETAIL_ROWS[activePunch](activePunchCfg.keys.perHand).map((row) => (
                      <tr key={row.key}>
                        <th scope="row">{t(row.key)}</th>
                        {['left', 'right'].map((side) => {
                          const h = punchResult.limbs[side];
                          if (!h.count) return <td key={side}>—</td>;
                          return (
                            <td key={side} className={row.warn?.(h) ? 'is-bad' : ''}>
                              {row.fmt(h)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <table className="calib-details-table calib-details-profile">
                  <caption>{t(activePunchCfg.keys.profile)}</caption>
                  <thead>
                    <tr>
                      <th scope="col">{t('calib_det_medida')}</th>
                      <th scope="col">{t(activePunchCfg.columns?.[0] || 'calib_det_izq')}</th>
                      <th scope="col">{t(activePunchCfg.columns?.[1] || 'calib_det_der')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activePunchCfg.profileKeys.map((key) => (
                      <tr key={key}>
                        <th scope="row">{t(PROFILE_LABELS[key].label)}</th>
                        {['left', 'right'].map((side) => {
                          const m = punchResult.profile[side]?.[key];
                          return (
                            <td key={side}>
                              {m ? `${m.mean.toFixed(2)}${PROFILE_LABELS[key].unit} ± ${m.sd.toFixed(2)}` : '—'}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="calib-details-note">{t(activePunchCfg.keys.note)}</p>
              </details>
            )}

            <div className="calib-modal-actions">
              <button
                type="button"
                className="btn-calib-action btn-calib-secondary"
                onClick={handleRepeatPunch}
              >
                {t('calib_btn_repetir')}
              </button>
              <button
                type="button"
                className="btn-calib-action btn-calib-primary"
                onClick={handleContinuePunch}
                autoFocus
              >
                {singleMove ? t('calib_btn_volver_sandbox') : t(activePunchCfg.keys.next)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          POPUP 7: ELEGIR UN MOVIMIENTO PARA RECALIBRAR (DESDE EL SANDBOX)
          ===================================================================== */}
      {currentStep === 5 && showMoveChooser && (
        <div className="calib-modal-backdrop">
          <div className="calib-modal" role="dialog" aria-modal="true" aria-labelledby="calib-modal-move-title">
            <h2 id="calib-modal-move-title" className="calib-modal-title">{t('calib_elegir_titulo')}</h2>
            <p className="calib-modal-text">{t('calib_elegir_texto')}</p>
            <div className="calib-modal-actions calib-modal-actions-list">
              {[
                { move: 'guard', labelKey: 'calib_paso_neutro' },
                { move: 'jab', labelKey: 'calib_paso_jab' },
                { move: 'hook', labelKey: 'calib_paso_gancho' },
                { move: 'dodge', labelKey: 'calib_paso_esquiva' },
              ].map(({ move, labelKey }, i) => (
                <button
                  key={move}
                  type="button"
                  className="btn-calib-action"
                  onClick={() => handleRecalibrateMove(move)}
                  autoFocus={i === 0}
                >
                  {t(labelKey)}
                </button>
              ))}
            </div>
            <div className="calib-modal-actions">
              <button
                type="button"
                className="btn-calib-action btn-calib-secondary"
                onClick={() => setShowMoveChooser(false)}
              >
                {t('calib_btn_cancelar')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          POPUP 6: GUARDADO DE LA CALIBRACIÓN Y LA SESIÓN DEL SANDBOX
          ===================================================================== */}
      {currentStep === 5 && saveState.status !== 'idle' && (
        <div className="calib-modal-backdrop">
          <div
            className="calib-modal"
            role={saveState.status === 'error' ? 'alertdialog' : 'dialog'}
            aria-modal="true"
            aria-labelledby="calib-modal-save-title"
            aria-busy={saveState.status === 'saving'}
          >
            <h2 id="calib-modal-save-title" className="calib-modal-title">
              {saveState.status === 'saving'
                ? t('calib_guardando')
                : saveState.status === 'ok'
                  ? t('calib_guardado_titulo')
                  : t('calib_guardar_error_titulo')}
            </h2>
            {saveState.status === 'ok' && <p className="calib-modal-text">{t('calib_guardado_texto')}</p>}
            {saveState.status === 'error' && (
              <p className="calib-modal-text calib-modal-error" role="alert">
                {t('calib_guardar_error_texto')} {saveState.message}
              </p>
            )}
            {saveState.status !== 'saving' && (
              <div className="calib-modal-actions">
                {saveState.status === 'ok' ? (
                  <button
                    type="button"
                    className="btn-calib-action btn-calib-primary"
                    onClick={onBackToMenu}
                    autoFocus
                  >
                    {t('calib_btn_volver_menu')}
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className="btn-calib-action btn-calib-secondary"
                      onClick={() => setSaveState({ status: 'idle', message: '' })}
                    >
                      {t('calib_btn_seguir_practicando')}
                    </button>
                    <button
                      type="button"
                      className="btn-calib-action btn-calib-primary"
                      onClick={handleSaveAndExit}
                      autoFocus
                    >
                      {t('calib_btn_reintentar')}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
