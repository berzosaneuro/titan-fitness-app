/**
 * data/catalogs.js — Catálogos estáticos: ejercicios, patrones de movimiento, etc.
 * En producción: sustituir por fetch a /api/catalogs (cacheado con SWR).
 */

/**
 * @typedef {{ id: string, name: string, muscle: string, pattern: string, equipment: string }} Exercise
 */

/** @type {Exercise[]} */
export const EXERCISES = [
    // ── EMPUJE HORIZONTAL ──────────────────────────────────────────
    { id: 'bench_press_bar', name: 'Press Banca Barra', muscle: 'Pecho · Tríceps · Deltoides Ant.', pattern: 'Empuje Horizontal', equipment: 'Barra' },
    { id: 'bench_press_db', name: 'Press Banca Mancuernas', muscle: 'Pecho · Tríceps', pattern: 'Empuje Horizontal', equipment: 'Mancuernas' },
    { id: 'incline_press_bar', name: 'Press Inclinado Barra', muscle: 'Pecho Superior · Tríceps', pattern: 'Empuje Horizontal', equipment: 'Barra' },
    { id: 'incline_press_db', name: 'Press Inclinado Mancuernas', muscle: 'Pecho Superior', pattern: 'Empuje Horizontal', equipment: 'Mancuernas' },
    { id: 'chest_fly_cable', name: 'Cruce de Poleas (Pecho)', muscle: 'Pecho', pattern: 'Empuje Horizontal', equipment: 'Polea' },
    { id: 'dips', name: 'Fondos en Paralelas', muscle: 'Pecho · Tríceps · Deltoides', pattern: 'Empuje Horizontal', equipment: 'Paralelas' },
    // ── EMPUJE VERTICAL ────────────────────────────────────────────
    { id: 'ohp_bar', name: 'Press Militar Barra', muscle: 'Deltoides · Tríceps · Trapecio', pattern: 'Empuje Vertical', equipment: 'Barra' },
    { id: 'ohp_db', name: 'Press Hombro Mancuernas', muscle: 'Deltoides · Tríceps', pattern: 'Empuje Vertical', equipment: 'Mancuernas' },
    { id: 'lateral_raise', name: 'Elevaciones Laterales', muscle: 'Deltoides Lateral', pattern: 'Empuje Vertical', equipment: 'Mancuernas' },
    { id: 'front_raise', name: 'Elevaciones Frontales', muscle: 'Deltoides Anterior', pattern: 'Empuje Vertical', equipment: 'Mancuernas' },
    // ── TRACCIÓN HORIZONTAL ────────────────────────────────────────
    { id: 'bent_row_bar', name: 'Remo Barra Inclinado', muscle: 'Dorsal · Romboides · Bíceps', pattern: 'Tracción Horizontal', equipment: 'Barra' },
    { id: 'seated_row_cable', name: 'Remo Sentado Polea', muscle: 'Dorsal · Romboides', pattern: 'Tracción Horizontal', equipment: 'Polea' },
    { id: 'chest_supported_row', name: 'Remo Pecho Apoyado', muscle: 'Dorsal · Romboides', pattern: 'Tracción Horizontal', equipment: 'Mancuernas' },
    { id: 'face_pull', name: 'Face Pull', muscle: 'Deltoides Posterior · Manguito', pattern: 'Tracción Horizontal', equipment: 'Polea' },
    // ── TRACCIÓN VERTICAL ──────────────────────────────────────────
    { id: 'pullup', name: 'Dominadas (Agarre Prono)', muscle: 'Dorsal · Bíceps · Romboides', pattern: 'Tracción Vertical', equipment: 'Barra Dominadas' },
    { id: 'chinup', name: 'Dominadas Supinas (Chin-up)', muscle: 'Dorsal · Bíceps', pattern: 'Tracción Vertical', equipment: 'Barra Dominadas' },
    { id: 'lat_pulldown', name: 'Jalón al Pecho', muscle: 'Dorsal · Bíceps', pattern: 'Tracción Vertical', equipment: 'Polea' },
    { id: 'straight_arm_pulldown', name: 'Jalón Brazos Rectos', muscle: 'Dorsal', pattern: 'Tracción Vertical', equipment: 'Polea' },
    // ── BISAGRA DE CADERA ──────────────────────────────────────────
    { id: 'deadlift', name: 'Peso Muerto Convencional', muscle: 'Isquios · Glúteos · Espalda Baja', pattern: 'Bisagra Cadera', equipment: 'Barra' },
    { id: 'rdl', name: 'Peso Muerto Rumano (RDL)', muscle: 'Isquiotibiales · Glúteos', pattern: 'Bisagra Cadera', equipment: 'Barra' },
    { id: 'hip_thrust', name: 'Hip Thrust', muscle: 'Glúteos · Isquios', pattern: 'Bisagra Cadera', equipment: 'Barra / Banco' },
    { id: 'good_morning', name: 'Good Morning', muscle: 'Isquios · Espalda Baja', pattern: 'Bisagra Cadera', equipment: 'Barra' },
    { id: 'kb_swing', name: 'Kettlebell Swing', muscle: 'Glúteos · Isquios · Core', pattern: 'Bisagra Cadera', equipment: 'Kettlebell' },
    // ── SENTADILLA ─────────────────────────────────────────────────
    { id: 'back_squat', name: 'Sentadilla Trasera', muscle: 'Cuádriceps · Glúteos · Isquios', pattern: 'Sentadilla', equipment: 'Barra' },
    { id: 'front_squat', name: 'Sentadilla Frontal', muscle: 'Cuádriceps · Core', pattern: 'Sentadilla', equipment: 'Barra' },
    { id: 'goblet_squat', name: 'Sentadilla Goblet', muscle: 'Cuádriceps · Glúteos', pattern: 'Sentadilla', equipment: 'Kettlebell / Mancuerna' },
    { id: 'leg_press', name: 'Prensa de Pierna', muscle: 'Cuádriceps · Glúteos', pattern: 'Sentadilla', equipment: 'Máquina' },
    { id: 'hack_squat', name: 'Hack Squat', muscle: 'Cuádriceps', pattern: 'Sentadilla', equipment: 'Máquina' },
    { id: 'bulgarian_split_squat', name: 'Sentadilla Búlgara', muscle: 'Cuádriceps · Glúteos', pattern: 'Sentadilla Unilateral', equipment: 'Mancuernas / Barra' },
    { id: 'lunge', name: 'Zancada', muscle: 'Cuádriceps · Glúteos', pattern: 'Sentadilla Unilateral', equipment: 'Mancuernas' },
    // ── AISLAMIENTO PIERNA ─────────────────────────────────────────
    { id: 'leg_extension', name: 'Extensión de Cuádriceps', muscle: 'Cuádriceps', pattern: 'Aislamiento Pierna', equipment: 'Máquina' },
    { id: 'leg_curl_lying', name: 'Curl Isquiotibiales Tumbado', muscle: 'Isquiotibiales', pattern: 'Aislamiento Pierna', equipment: 'Máquina' },
    { id: 'leg_curl_seated', name: 'Curl Isquiotibiales Sentado', muscle: 'Isquiotibiales', pattern: 'Aislamiento Pierna', equipment: 'Máquina' },
    { id: 'calf_raise_standing', name: 'Elevación Talones de Pie', muscle: 'Gemelos', pattern: 'Aislamiento Pierna', equipment: 'Máquina / Libre' },
    { id: 'calf_raise_seated', name: 'Elevación Talones Sentado', muscle: 'Sóleo', pattern: 'Aislamiento Pierna', equipment: 'Máquina' },
    { id: 'adductor_machine', name: 'Máquina Aductores', muscle: 'Aductores', pattern: 'Aislamiento Pierna', equipment: 'Máquina' },
    { id: 'abductor_machine', name: 'Máquina Abductores', muscle: 'Abductores · Glúteo Medio', pattern: 'Aislamiento Pierna', equipment: 'Máquina' },
    // ── BÍCEPS ─────────────────────────────────────────────────────
    { id: 'barbell_curl', name: 'Curl Barra', muscle: 'Bíceps', pattern: 'Flexión Codo', equipment: 'Barra' },
    { id: 'db_curl', name: 'Curl Mancuernas Alternado', muscle: 'Bíceps · Braquial', pattern: 'Flexión Codo', equipment: 'Mancuernas' },
    { id: 'hammer_curl', name: 'Curl Martillo', muscle: 'Braquiorradial · Bíceps', pattern: 'Flexión Codo', equipment: 'Mancuernas' },
    { id: 'cable_curl', name: 'Curl Polea Baja', muscle: 'Bíceps', pattern: 'Flexión Codo', equipment: 'Polea' },
    { id: 'incline_curl', name: 'Curl Inclinado', muscle: 'Bíceps (cabeza larga)', pattern: 'Flexión Codo', equipment: 'Mancuernas' },
    // ── TRÍCEPS ────────────────────────────────────────────────────
    { id: 'tricep_pushdown', name: 'Extensión Tríceps Polea Alta', muscle: 'Tríceps', pattern: 'Extensión Codo', equipment: 'Polea' },
    { id: 'overhead_tricep_ext', name: 'Extensión Tríceps sobre Cabeza', muscle: 'Tríceps (cabeza larga)', pattern: 'Extensión Codo', equipment: 'Mancuerna / Polea' },
    { id: 'skull_crusher', name: 'Skull Crusher', muscle: 'Tríceps', pattern: 'Extensión Codo', equipment: 'Barra / EZ' },
    { id: 'close_grip_bench', name: 'Press Banca Agarre Cerrado', muscle: 'Tríceps · Pecho', pattern: 'Extensión Codo', equipment: 'Barra' },
    // ── CORE ───────────────────────────────────────────────────────
    { id: 'plank', name: 'Plancha Isométrica', muscle: 'Core · Lumbar', pattern: 'Antiextensión Core', equipment: 'Peso corporal' },
    { id: 'ab_rollout', name: 'Ab Wheel Rollout', muscle: 'Core · Serrato', pattern: 'Antiextensión Core', equipment: 'Rueda Abdominal' },
    { id: 'pallof_press', name: 'Pallof Press', muscle: 'Core (antirotación)', pattern: 'Antirotación Core', equipment: 'Polea' },
    { id: 'cable_crunch', name: 'Crunch Polea Alta', muscle: 'Recto Abdominal', pattern: 'Flexión Lumbar', equipment: 'Polea' },
    { id: 'hanging_leg_raise', name: 'Elevación Piernas Colgado', muscle: 'Recto Abdominal · Psoas', pattern: 'Flexión Lumbar', equipment: 'Barra Dominadas' },
    { id: 'side_plank', name: 'Plancha Lateral', muscle: 'Oblicuos · Cuadrado Lumbar', pattern: 'Antiflexión Lateral', equipment: 'Peso corporal' },
    // ── CARDIO / POTENCIA ──────────────────────────────────────────
    { id: 'box_jump', name: 'Salto a Cajón', muscle: 'Cuádriceps · Glúteos · Gemelos', pattern: 'Potencia', equipment: 'Cajón Pliométrico' },
    { id: 'battle_ropes', name: 'Battle Ropes', muscle: 'Hombros · Core · Cardiovascular', pattern: 'Cardio / Potencia', equipment: 'Cuerdas' },
    { id: 'sled_push', name: 'Empuje de Trineo', muscle: 'Cuádriceps · Glúteos · Cardiovascular', pattern: 'Cardio / Potencia', equipment: 'Trineo' },
    { id: 'rowing_machine', name: 'Remoergómetro', muscle: 'Dorsal · Pierna · Cardiovascular', pattern: 'Cardio', equipment: 'Remo ergómetro' },
];

/**
 * Filtra ejercicios por texto en nombre, músculo o patrón.
 * @param {string} query
 * @returns {Exercise[]}
 */
export function searchExercises(query) {
    const q = (query || '').toLowerCase().trim();
    if (!q) return EXERCISES;
    return EXERCISES.filter(
        (e) =>
            e.name.toLowerCase().includes(q) ||
            e.muscle.toLowerCase().includes(q) ||
            e.pattern.toLowerCase().includes(q)
    );
}

/**
 * Patrones de movimiento únicos (para filtros).
 * @returns {string[]}
 */
export function getMovementPatterns() {
    return [...new Set(EXERCISES.map((e) => e.pattern))];
}
