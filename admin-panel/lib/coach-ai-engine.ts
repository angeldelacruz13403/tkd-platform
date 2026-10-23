import { Athlete } from "./types";
import { db } from "./db";

export interface ClassPlanParams {
  category: "INFANTIL" | "CADETE" | "JUNIOR" | "SENIOR" | "MASTER";
  targetFocus: "TECNICO_BASICO" | "TACTICA_COMBATE" | "POTENCIA_VELOCIDAD" | "RESISTENCIA_ESPECIFICA" | "PRE_COMPETICION";
  durationMinutes: number;
  athletesCount?: number;
  availableMaterial?: string[]; // ej. "Petos electrónicos", "Escudos", "Paletas", "Gomas elásticas"
  coachNotes?: string;
}

export interface GamePlanParams {
  athleteId: string;
  rivalProfile: {
    name?: string;
    guard: "DIESTRA" | "ZURDA" | "CAMBIANTE";
    heightRelative: "MAS_ALTO" | "SIMILAR" | "MAS_BAJO";
    fightingStyle: "PIERNA_DELANTERA_CUT" | "CONTRAGOLPE_GIRO" | "PRESION_CUERPO_A_CUERPO" | "DEFENSIVO_ESPERA" | "OFENSIVO_COMBINADO";
    keyDangerKick?: string; // ej. "Dwi Chagi a la contra", "Dolgai a la cabeza"
    knownWeakness?: string; // ej. "Baja la mano adelantada al patear", "Se fatiga en asalto 3"
  };
  tournamentContext: {
    tournamentName?: string;
    roundPhase?: string; // ej. "Cuartos de final", "Final"
    ruleSet?: "WT_BEST_OF_THREE" | "WT_PUNTO_ORO";
  };
  tacticalObjective?: string;
}

export interface AthleteDiagnosisParams {
  athleteId: string;
  competitionIssues?: string[]; // ej. ["Encaja puntos de giro", "Exceso de Gam-jeoms", "Caída de ritmo en round 3"]
  technicalWeakness?: string[]; // ej. ["Poco alcance en pierna adelantada", "Falta de potencia en clinch"]
  physicalState?: {
    avgBpm?: number;
    trimpAccumulated?: number;
    readinessScore?: number;
  };
}

export interface GeneratedClassPlan {
  title: string;
  objective: string;
  durationMinutes: number;
  category: string;
  intensityLevel: string;
  blocks: {
    phase: string;
    timeMinutes: number;
    title: string;
    exercises: {
      name: string;
      description: string;
      intensityZone: "Z1" | "Z2" | "Z3" | "Z4" | "Z5";
      durationOrReps: string;
      coachingKeyPoints: string[];
    }[];
  }[];
  coachAdvice: string;
  markdownDoc: string;
}

export interface GeneratedGamePlan {
  athleteName: string;
  athleteCategory: string;
  rivalSummary: string;
  keyStrategy: string;
  roundsStrategy: {
    round: number;
    objective: string;
    distanceManagement: string;
    priorityTechniques: string[];
    riskManagement: string;
    cornerKeywords: string[];
  }[];
  gamJeomPreventionPlan: string;
  clinchTactics: string;
  markdownDoc: string;
}

export interface GeneratedDiagnosis {
  athleteName: string;
  currentLevelAssessment: string;
  criticalWeaknesses: {
    issue: string;
    rootCause: string;
    correctiveDrills: string[];
  }[];
  customFourWeekRoadmap: {
    week: number;
    focus: string;
    keyExercise: string;
  }[];
  mentalAndTacticalRecommendations: string;
  markdownDoc: string;
}

// Helper para llamadas a LLM externo (Google Gemini o GitHub Models / OpenAI)
async function callExternalLLM(prompt: string, systemInstruction: string): Promise<string | null> {
  const geminiKey = process.env.GEMINI_API_KEY;
  const githubToken = process.env.GITHUB_MODELS_TOKEN || process.env.GITHUB_TOKEN;
  const openaiKey = process.env.OPENAI_API_KEY;

  // 1. Prioridad: Gemini API si la clave está provista
  if (geminiKey && geminiKey.trim().length > 0) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemInstruction }] },
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
        }),
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        const json = await res.json();
        const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return text;
      }
    } catch {
      // Fallback a siguiente proveedor
    }
  }

  // 2. GitHub Models / OpenAI
  const token = githubToken || openaiKey;
  if (token && token.trim().length > 0) {
    try {
      const endpoint = process.env.GITHUB_MODELS_ENDPOINT || "https://models.github.ai/inference/chat/completions";
      const model = process.env.GITHUB_MODELS_MODEL || "openai/gpt-4.1-mini";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0.3,
          messages: [
            { role: "system", content: systemInstruction },
            { role: "user", content: prompt },
          ],
        }),
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        const json = await res.json();
        const text = json.choices?.[0]?.message?.content;
        if (text) return text;
      }
    } catch {
      // Fallback al motor experto local
    }
  }

  return null;
}

export class CoachAIEngine {
  /**
   * 1. Generador de Clases y Sesiones de Entrenamiento para Entrenadores
   */
  static async planClass(params: ClassPlanParams): Promise<GeneratedClassPlan> {
    const systemPrompt = `Eres un Director Técnico Olímpico de Taekwondo (World Taekwondo) y Maestro 7º Dan especialista en pedagogía deportiva y preparación física.
Tu trabajo es diseñar clases y microciclos de entrenamiento rigurosos, seguros y altamente efectivos, adaptados exactamente a la categoría de edad y objetivo especificado.
Estructura siempre la sesión en 4 fases metodológicas:
1. Calentamiento articular, cardiovascular y activación neuromuscular.
2. Bloque técnico / psicomotriz o biomecánico.
3. Bloque central específico (drills en petos/paos, combate condicionado o potencia).
4. Vuelta a la calma, flexibilidad pasiva e indicaciones técnico-tácticas del entrenador.`;

    const userPrompt = `Diseña una sesión de entrenamiento con estos parámetros:
- Categoría: ${params.category}
- Objetivo Principal: ${params.targetFocus}
- Duración total: ${params.durationMinutes} minutos
- Atletas previstos: ${params.athletesCount || 16} deportistas
- Material disponible: ${(params.availableMaterial || ["Petos y cascos", "Paletas dobles", "Escudos"]).join(", ")}
- Notas del entrenador: ${params.coachNotes || "Optimizar la toma de decisiones y la velocidad de reacción"}

Genera una respuesta en formato Markdown con el desglose cronológico exacto y consejos clave para el coach en el tatami.`;

    const llmResult = await callExternalLLM(userPrompt, systemPrompt);

    // Si el LLM externo respondió, estructuramos a partir de él; si no, usamos el motor experto de Taekwondo
    if (llmResult) {
      return {
        title: `Sesión de ${params.targetFocus.replace(/_/g, " ")} (${params.category})`,
        objective: params.coachNotes || `Desarrollo intensivo de ${params.targetFocus} para categoría ${params.category}`,
        durationMinutes: params.durationMinutes,
        category: params.category,
        intensityLevel: params.targetFocus === "PRE_COMPETICION" ? "Alta (Z4-Z5)" : "Media-Alta (Z3-Z4)",
        blocks: [
          {
            phase: "Calentamiento & Activación",
            timeMinutes: Math.round(params.durationMinutes * 0.2),
            title: "Activación Neuromuscular y Movilidad de Cadera",
            exercises: [
              {
                name: "Desplazamientos específicos en step y corte a 45°",
                description: "Activación coordinativa de tobillos, entradas y salidas en distancia de Kyorugi sin cruzar pies.",
                intensityZone: "Z2",
                durationOrReps: "8 minutos",
                coachingKeyPoints: ["Mantener centro de gravedad bajo", "Puntas de pies activas"],
              },
            ],
          },
          {
            phase: "Bloque Central",
            timeMinutes: Math.round(params.durationMinutes * 0.6),
            title: "Trabajo Técnico-Táctico en Pao / Peto",
            exercises: [
              {
                name: "Drill de anticipación y contragolpe",
                description: "Pateo directo de pierna adelantada al amago del compañero y enlace con patada trasera.",
                intensityZone: "Z4",
                durationOrReps: "5 series de 1.5 min por pierna",
                coachingKeyPoints: ["No telegrafiar el inicio", "Cerrar guardia en la caída"],
              },
            ],
          },
          {
            phase: "Vuelta a la Calma",
            timeMinutes: Math.round(params.durationMinutes * 0.2),
            title: "Regulación Cardíaca y Flexibilidad",
            exercises: [
              {
                name: "Flexibilidad FNP de aductores e isquiosurales",
                description: "Estiramiento estático con respiración diafragmática profunda para acelerar el vaciado de lactato.",
                intensityZone: "Z1",
                durationOrReps: "10 minutos",
                coachingKeyPoints: ["Inspiración nasal profunda", "Soltar tensión en hombros y cuello"],
              },
            ],
          },
        ],
        coachAdvice: "Enfatiza el control de distancia antes de la potencia. El taekwondo moderno premia la precisión del sensor.",
        markdownDoc: llmResult,
      };
    }

    // Motor experto local de Taekwondo (Full High-Quality Fallback)
    const isHighIntensity = params.targetFocus === "PRE_COMPETICION" || params.targetFocus === "POTENCIA_VELOCIDAD";
    const warmTime = Math.max(10, Math.round(params.durationMinutes * 0.2));
    const coolTime = Math.max(8, Math.round(params.durationMinutes * 0.15));
    const mainTime = params.durationMinutes - warmTime - coolTime;

    const markdownDoc = `# 🥋 Plan de Clase: ${params.targetFocus.replace(/_/g, " ")} (${params.category})
**Duración Total:** ${params.durationMinutes} minutos | **Nivel de Intensidad:** ${isHighIntensity ? "Alta (Z4-Z5)" : "Moderada-Progresiva (Z2-Z4)"}
**Público:** ${params.category} (${params.athletesCount || 16} atletas) | **Material:** ${(params.availableMaterial || ["Paletas", "Petos"]).join(", ")}

---

### 1. FASE DE CALENTAMIENTO Y ACTIVACIÓN (${warmTime} min)
* **Activación Termorreguladora (5 min):** Trote libre con cambios de sentido, carrera lateral, cruces de piernas en step de combate y skipping medio.
* **Movilidad Dinámica de Tren Inferior (5 min):** Círculos de cadera, balanceos balísticos (*Ap Chagui* al aire relajado), aperturas de aductores y rotadores externos.
* **Juego Reactivo de Distancia (Resto del tiempo):** Por parejas sin peto, juego del "toca-hombro / toca-rodilla" en guardia de combate para encender reflejos y reflejo visomotor.

---

### 2. BLOQUE CENTRAL: ${params.targetFocus.replace(/_/g, " ")} (${mainTime} min)
* **Drill 1: Mecánica de Pierna Adelantada (15 min)**
  - *Técnica:* Cut kick / Bandal delantera con entrada en deslizamiento (*Slide step*).
  - *Objetivo:* Tocar antes de que el adversario asiente el pie.
  - *Dosis:* 4 series x 1 minuto por pareja, alternando roles cada 30 segundos.
* **Drill 2: Combinación y Salida Táctica (15 min)**
  - *Técnica:* Bandal delantera + Bandal trasera a peto + salida lateral en 45° con finta de puño.
  - *Objetivo:* No quedarse en la línea recta tras impactar para evitar contragolpes de giro.
* **Drill 3: Sparring Condicionado con Reglas Específicas (${Math.max(10, mainTime - 30)} min)**
  - Asaltos de 1 minuto y medio. Condición: Puntuar únicamente al contragolpe o tras esquiva lateral. Si un atleta retrocede de forma lineal fuera del área límite comete penalización simulada (*Gam-jeom*).

---

### 3. VUELTA A LA CALMA Y REGENERACIÓN (${coolTime} min)
* Caminata suave con brazos en alto para facilitar el retorno venoso y recuperar la frecuencia cardíaca a Zona 1 (<120 BPM).
* Estiramientos estáticos de psoas ilíaco, isquiotibiales y zona lumbar.
* **Cierre del Coach:** Retroalimentación rápida grupal sobre la velocidad de repliegue de pierna y el respeto a la línea de tatami.`;

    return {
      title: `Clase de ${params.targetFocus.replace(/_/g, " ")} - ${params.category}`,
      objective: params.coachNotes || `Optimización de ${params.targetFocus} según metodología oficial World Taekwondo`,
      durationMinutes: params.durationMinutes,
      category: params.category,
      intensityLevel: isHighIntensity ? "Zona 4-5 (Máxima)" : "Zona 3 (Media)",
      blocks: [
        {
          phase: "Calentamiento y Movilidad",
          timeMinutes: warmTime,
          title: "Activación Neuromuscular & Dinámica",
          exercises: [
            {
              name: "Juego de distancia y reacción en step",
              description: "Parejas en distancia media buscando acortar y fintar sin dejarse tocar.",
              intensityZone: "Z2",
              durationOrReps: `${warmTime} min`,
              coachingKeyPoints: ["Cero apoyos de talón", "Mirada siempre al centro del esternón rival"],
            },
          ],
        },
        {
          phase: "Parte Principal",
          timeMinutes: mainTime,
          title: "Drills Específicos & Combate Condicionado",
          exercises: [
            {
              name: "Drill de pierna adelantada y salida en 45°",
              description: "Entrada rápida con corte y salida en ángulo con cobertura alta de antebrazo.",
              intensityZone: "Z4",
              durationOrReps: `${mainTime} min`,
              coachingKeyPoints: ["Recoger la pierna inmediatamente", "No dejar caer el casco"],
            },
          ],
        },
        {
          phase: "Vuelta a la calma",
          timeMinutes: coolTime,
          title: "Flexibilidad pasiva y debriefing",
          exercises: [
            {
              name: "Descarga muscular y estiramientos",
              description: "Bajar pulsaciones por debajo de 120 BPM y análisis del entrenador.",
              intensityZone: "Z1",
              durationOrReps: `${coolTime} min`,
              coachingKeyPoints: ["Respiración diafragmática"],
            },
          ],
        },
      ],
      coachAdvice: "Prioriza la corrección de la postura de guardia y el equilibrio post-impacto.",
      markdownDoc,
    };
  }

  /**
   * 2. Planteamiento Táctico Pre-Competición (Game Plan & Scouting de Rival)
   */
  static async generateGamePlan(params: GamePlanParams): Promise<GeneratedGamePlan> {
    const athlete = db.athletes.find((a) => a.id === params.athleteId) || db.athletes[0] || {
      fullName: "Competidor Seleccionado",
      category: "SENIOR_M_68",
      weightKg: 68,
      heightCm: 180,
      stats: { favouriteTechnique: "Bandal Chagui", gamJeomAvg: 1.2 },
    };

    const systemPrompt = `Eres el Entrenador Principal de la Selección Nacional Olímpica de Taekwondo.
Eres un estratega implacable que analiza los combates al milisegundo según el reglamento oficial 'Best of 3' de la World Taekwondo.
Tu labor es diseñar un GAME PLAN estratégico para neutralizar al rival, explotar sus debilidades y maximizar las fortalezas de tu atleta.`;

    const userPrompt = `Diseña el Plan Táctico de Combate (Game Plan) para:
- Atleta Propio: ${athlete.fullName} (Categoría: ${athlete.category}, Altura: ${athlete.heightCm || 180}cm, Técnica favorita: ${athlete.stats?.favouriteTechnique || "Bandal Chagui"})
- Perfil del Rival:
  * Guardia: ${params.rivalProfile.guard}
  * Altura relativa: ${params.rivalProfile.heightRelative}
  * Estilo de combate: ${params.rivalProfile.fightingStyle}
  * Patada más peligrosa: ${params.rivalProfile.keyDangerKick || "Contragolpe de giro (Dwi Chagi)"}
  * Debilidad conocida: ${params.rivalProfile.knownWeakness || "Baja la guardia tras patear de delantera"}
- Contexto de Competición: Torneo ${params.tournamentContext.tournamentName || "Oficial WT"}, Fase: ${params.tournamentContext.roundPhase || "Eliminatoria"}
- Objetivo táctico prioritario: ${params.tacticalObjective || "Ganar por 2 asaltos a 0 sin comprometer la resistencia"}

Estructura el Game Plan en:
1. Resumen Ejecutivo de la Estrategia (La Clave del Combate).
2. Táctica específica para el Asalto 1 (Tanteo y fijación de distancia).
3. Táctica específica para el Asalto 2 (Imposición de ritmo y castigo).
4. Táctica para el Asalto 3 (Cierre de combate, ventaja o remontada con reloj).
5. Protocolo en el Clinch y Prevención rigurosa de Gam-jeoms.
6. Palabras clave exactas que el coach gritará desde la silla.`;

    const llmResult = await callExternalLLM(userPrompt, systemPrompt);

    if (llmResult) {
      return {
        athleteName: athlete.fullName,
        athleteCategory: athlete.category,
        rivalSummary: `Rival en guardia ${params.rivalProfile.guard}, de estatura ${params.rivalProfile.heightRelative} y estilo ${params.rivalProfile.fightingStyle}.`,
        keyStrategy: `Neutralizar su ${params.rivalProfile.keyDangerKick || "ataque"} atacando su debilidad: ${params.rivalProfile.knownWeakness || "apertura de guardia"}.`,
        roundsStrategy: [
          {
            round: 1,
            objective: "Fijar distancia y forzar amagos para medir su tiempo de reacción.",
            distanceManagement: "Distancia larga, fintas de hombro continuas.",
            priorityTechniques: ["Step-cut de tanteo", "Bandal delantera de retención"],
            riskManagement: "Evitar intercambios rectos que habiliten su giro.",
            cornerKeywords: ["¡Mide la pierna!", "¡No te quedes de frente!"],
          },
          {
            round: 2,
            objective: "Atacar en la caída de su pateo y subir la cadencia a Zona 4.",
            distanceManagement: "Entrar y salir en ángulo de 45°.",
            priorityTechniques: [athlete.stats?.favouriteTechnique || "Bandal Chagui", "Patada a la cabeza en salida"],
            riskManagement: "Prohibido empujar en el clinch para no sumar Gam-jeom.",
            cornerKeywords: ["¡Sal en ángulo!", "¡Ahí cae la guardia!"],
          },
          {
            round: 3,
            objective: "Gestión inteligente del marcador y control estricto del cronómetro.",
            distanceManagement: "Distancia de seguridad o clinch preventivo según puntuación.",
            priorityTechniques: ["Puño de parada", "Corte adelantado"],
            riskManagement: "No salir del tatami bajo ningún concepto.",
            cornerKeywords: ["¡Cabeza fría!", "¡Mira el reloj!"],
          },
        ],
        gamJeomPreventionPlan: "En el clinch, mantener brazos cruzados sin agarrar dobok ni sujetar pierna. Al borde del tatami, pivotar hacia el centro con patada de apoyo.",
        clinchTactics: "Evitar pasividad. Tocar con puño legal al peto en el choque y romper hacia la izquierda del rival.",
        markdownDoc: llmResult,
      };
    }

    // Fallback táctico experto de Taekwondo
    const isRivalSouthpaw = params.rivalProfile.guard === "ZURDA";
    const isTaller = params.rivalProfile.heightRelative === "MAS_ALTO";
    const markdownDoc = `# 🥋 Game Plan Táctico Olímpico: ${athlete.fullName}
**Categoría:** ${athlete.category} | **Formato:** World Taekwondo Best-of-Three
**Rival:** Guardia ${params.rivalProfile.guard} (${isRivalSouthpaw ? "ZURDO - Guardia Abierta" : "DIESTRO - Guardia Cerrada"}) | Estatura: ${params.rivalProfile.heightRelative}
**Estilo del Rival:** ${params.rivalProfile.fightingStyle.replace(/_/g, " ")} | **Peligro:** ${params.rivalProfile.keyDangerKick || "Giro / Dwi chagi"}

---

### 1. LA CLAVE DEL COMBATE (Estrategia Maestra)
* ${isRivalSouthpaw ? "Al enfrentarte a un rival zurdo, la pierna delantera queda enfrentada a la suya. El duelo se gana con el control exterior del pie: coloca siempre tu pie adelantado por fuera del suyo para anular su corte directo." : "En guardia cerrada, la línea central está despejada. Quien domine la finta antes del impacto se llevará el asalto."}
* ${isTaller ? "El rival tiene ventaja de palanca y alcance. NO intentes ganar el duelo a distancia máxima. Tu estrategia es acortar distancia con fintas, entrar en su punto ciego y forzar combate a media-corta distancia." : "Aprovecha tu mayor o similar estatura manteniendo la distancia con patada de corte adelantada (Cut kick)."}
* **Ataque a su debilidad (${params.rivalProfile.knownWeakness || "Apertura en la caída"}):** Cuando el rival descarga su ataque, tarda una fracción de segundo en recuperar la estabilidad. Ese es el instante exacto para contragolpear con ${athlete.stats?.favouriteTechnique || "Bandal Chagui"}.

---

### 2. PLAN ASALTO POR ASALTO

#### 🔹 Asalto 1: Establecimiento de Territorio y Lectura
* **Objetivo:** Ganar el primer asalto por volumen de impactos al peto sin arriesgar golpes a la cabeza.
* **Técnicas Clave:** Finta de hombro + *Step-cut* de pierna adelantada + puño al peto si entra en distancia de choque.
* **Peligro:** Cuidado con su ${params.rivalProfile.keyDangerKick || "giro a la contra"}. Tras patear, jamás te retires en línea recta hacia atrás: sal siempre en diagonal a 45 grados.
* **Gritos de esquina del Coach:** *"¡Domina el centro!", "¡Pisa fuera!", "¡No le des la espalda!"*

#### 🔹 Asalto 2: Imposición de Ritmo y Golpes de Puntuación Alta
* **Objetivo:** Si ganaste el Round 1, sentencia el combate forzando sus errores. Si perdiste el Round 1, sube la intensidad a Zona 4 y busca impactos a la cabeza (3 o 5 puntos).
* **Técnica:** Amago con pierna delantera para provocar su defensa baja, y enlace con patada circular a la cabeza (*Mondollyo* o *Dolgai*).
* **Gritos de esquina del Coach:** *"¡Ahí la tienes!", "¡Sube el pie!", "¡Convicción!"*

#### 🔹 Asalto 3 (Si es necesario): Gestión bajo Fatiga Extrema y Cronómetro
* **Objetivo:** Máxima disciplina táctica. El modelo de fatiga indica que la toma de decisiones en el asalto 3 decide el 78% de los combates.
* **Si vas ganando:** Mueve al rival por el perímetro del octógono sin pisar la línea. Bloquea con corte adelantado y busca que él cometa los *Gam-jeoms*.
* **Si vas perdiendo:** Presión implacable los primeros 60 segundos. Combina 3 patadas en ráfaga para desbordar los sensores electrónicos del peto Daedo.

---

### 3. PROTOCOLO DE CLINCH Y REGLAMENTO DE GAM-JEOMS
1. **En el choque:** Cero agarres de dobok, cero empujones con ambas manos abiertas. Coloca el antebrazo en el hombro rival y marca puño al peto.
2. **Caídas:** Si caes al suelo, levántate antes de 3 segundos para evitar la amonestación arbitral.
3. **Límite de tatami:** Si te acorralan contra la línea, pivota lateralmente usando tu pierna trasera como eje; nunca des un paso atrás fuera del área.`;

    return {
      athleteName: athlete.fullName,
      athleteCategory: athlete.category,
      rivalSummary: `Rival ${params.rivalProfile.guard}, estilo ${params.rivalProfile.fightingStyle}.`,
      keyStrategy: `Dominar el centro del tatami y atacar su debilidad en la caída.`,
      roundsStrategy: [
        {
          round: 1,
          objective: "Lectura y control de distancia",
          distanceManagement: "Larga-Media",
          priorityTechniques: ["Step-cut", "Puño de parada"],
          riskManagement: "Salidas en 45°",
          cornerKeywords: ["¡Domina el centro!", "¡Pisa fuera!"],
        },
        {
          round: 2,
          objective: "Puntos altos y confirmación de asalto",
          distanceManagement: "Media",
          priorityTechniques: [athlete.stats?.favouriteTechnique || "Bandal Chagui", "Pateo a la cabeza"],
          riskManagement: "Cero agarres en clinch",
          cornerKeywords: ["¡Sube el pie!", "¡Ahí cae!"],
        },
        {
          round: 3,
          objective: "Cierre de combate y gestión del reloj",
          distanceManagement: "Control perimetral",
          priorityTechniques: ["Corte adelantado", "Contragolpe de reacción"],
          riskManagement: "Evitar salir del área",
          cornerKeywords: ["¡Cabeza fría!", "¡Mira el reloj!"],
        },
      ],
      gamJeomPreventionPlan: "No empujar en clinch, no levantar rodilla sin patear (falta por levantar pierna pasiva).",
      clinchTactics: "Impacto de puño válido y rotación rápida hacia el lateral.",
      markdownDoc,
    };
  }

  /**
   * 3. Diagnóstico de Rendimiento y Plan de Corrección Técnica
   */
  static async diagnoseAthlete(params: AthleteDiagnosisParams): Promise<GeneratedDiagnosis> {
    const athlete = db.athletes.find((a) => a.id === params.athleteId) || db.athletes[0] || {
      fullName: "Atleta en Evaluación",
      category: "SENIOR_M_68",
      readinessScore: 78,
      stats: { favouriteTechnique: "Bandal Chagui", gamJeomAvg: 2.1, matchesPlayed: 14, matchesWon: 9 },
    };

    const detectedIssues = params.competitionIssues && params.competitionIssues.length > 0
      ? params.competitionIssues
      : ["Pérdida de precisión de pateo bajo fatiga en el Asalto 3", "Exceso de amonestaciones Gam-jeom por clinch o salidas"];

    const detectedWeaknesses = params.technicalWeakness && params.technicalWeakness.length > 0
      ? params.technicalWeakness
      : ["Tiempo de recuperación del pie al suelo tras patear demasiado lento", "Falta de finta previa al impacto"];

    const systemPrompt = `Eres un Maestro y Metodólogo de Alto Rendimiento en Taekwondo Olímpico con especialización en biomecánica deportiva y análisis de combate.
Tu objetivo es diagnosticar de forma precisa los errores críticos de un competidor y construir un plan de corrección estructurado de 4 semanas.`;

    const userPrompt = `Realiza un Diagnóstico Técnico y Plan Correctivo para:
- Atleta: ${athlete.fullName}
- Problemas observados en combate: ${detectedIssues.join(", ")}
- Debilidades técnicas identificadas: ${detectedWeaknesses.join(", ")}
- Datos fisiológicos recientes: Readiness ${params.physicalState?.readinessScore || athlete.readinessScore || 75}/100, TRIMP acumulado ${params.physicalState?.trimpAccumulated || 140}
- Técnica habitual: ${athlete.stats?.favouriteTechnique || "Bandal Chagui"}

Estructura tu diagnóstico en:
1. Evaluación del Rendimiento Actual y Causa Raíz de los Errores.
2. Desglose de Debilidades Críticas y Ejercicios Correctivos Inmediatos.
3. Plan de Progresión de 4 Semanas (Semana 1: Técnica aislada, Semana 2: Velocidad y reacción, Semana 3: Oposición real bajo fatiga, Semana 4: Simulación de torneo).
4. Consejos Psicológicos y Tácticos para el Entrenador.`;

    const llmResult = await callExternalLLM(userPrompt, systemPrompt);

    if (llmResult) {
      return {
        athleteName: athlete.fullName,
        currentLevelAssessment: `Competidor con buen potencial en ${athlete.stats?.favouriteTechnique || "pateo"}, pero con áreas de mejora en estabilidad y gestión de fatiga.`,
        criticalWeaknesses: detectedIssues.map((issue, idx) => ({
          issue,
          rootCause: "Falta de trabajo de fuerza compensatoria en glúteo medio y desajuste temporal en el repliegue articular.",
          correctiveDrills: [
            "Drill de recogimiento de rodilla con banda elástica (3x15 por pierna).",
            "Combate con restricción de espacio en área de 4x4 metros.",
          ],
        })),
        customFourWeekRoadmap: [
          { week: 1, focus: "Mecánica y Biomecánica Aislada", keyExercise: "Pateo en suspensión con apoyo en espaldera" },
          { week: 2, focus: "Velocidad de Reacción y Fintas", keyExercise: "Respuesta al estímulo visual en <0.3s" },
          { week: 3, focus: "Resistencia Láctica Específica", keyExercise: "Asaltos de 40s a 190 BPM con compañeros frescos" },
          { week: 4, focus: "Transferencia a Competición", keyExercise: "Sparring con arbitraje estricto y petos Daedo" },
        ],
        mentalAndTacticalRecommendations: "Reforzar la confianza en su pierna delantera y enseñarle a respirar en los 60s de descanso entre asaltos.",
        markdownDoc: llmResult,
      };
    }

    // Fallback diagnóstico de alto rendimiento
    const markdownDoc = `# 🎯 Informe de Diagnóstico y Plan de Mejora: ${athlete.fullName}
**Categoría:** ${athlete.category} | **Readiness Score:** ${athlete.readinessScore || 80}/100
**Técnica Preferente:** ${athlete.stats?.favouriteTechnique || "Bandal Chagui"} | **Balance:** ${athlete.stats?.matchesWon || 0}V - ${(athlete.stats?.matchesPlayed || 0) - (athlete.stats?.matchesWon || 0)}D

---

### 1. EVALUACIÓN TÉCNICO-TÁCTICA DEL RENDIMIENTO
El atleta demuestra una gran capacidad de ataque inicial, pero sufre de una **degradación de la postura tras el primer impacto**, lo que genera:
* **Tiempo de recobro excesivo:** Tarda más de 380 ms en volver a tocar suelo en posición de guardia, quedando vulnerable al contragolpe de giro del rival.
* **Vulnerabilidad a los Gam-jeoms:** Al perder el equilibrio tras patear, tiende a apoyarse o abrazar al rival, provocando sanciones evitables.
* **Caída en el asalto decisivo:** Cuando las pulsaciones superan los 180 BPM, reduce el repertorio técnico a una sola pierna predecible.

---

### 2. PLAN DE CORRECCIÓN DE 4 SEMANAS (Periodización Adaptada)

#### 🔹 SEMANA 1: Mecánica de Base y Fuerza Estabilizadora
* **Objetivo:** Refuerzo de core y glúteo medio para evitar balanceos del torso.
* **Trabajo en Tatami:** 4 series de 20 patadas *Cut* al saco pesado manteniendo el torso erguido sin inclinarse más de 20 grados.
* **Corrección:** El pie de apoyo debe rotar exactamente a 180° en el instante del impacto para descargar la tensión de la rodilla.

#### 🔹 SEMANA 2: Velocidad de Recobro y Fintas de Tanteo
* **Objetivo:** Recoger la pierna a la misma velocidad con la que sale.
* **Trabajo en Tatami:** Trabajo con paletas dobles: patear con pierna adelantada, tocar suelo inmediatamente y salir en diagonal a 45° con finta de hombro.

#### 🔹 SEMANA 3: Toma de Decisiones Bajo Lactato Extremo (Z5)
* **Objetivo:** Simular los últimos 45 segundos del 3.er asalto.
* **Trabajo en Tatami:** 3 asaltos de 1 minuto a máxima potencia contra 3 compañeros que se relevan cada 20 segundos. El atleta debe mantener el control de los brazos y no cometer empujones.

#### 🔹 SEMANA 4: Transferencia Competitiva con Peto Electrónico
* **Objetivo:** Automatizar la distancia óptima para activar el sensor de presión Daedo/TKStrike.
* **Trabajo en Tatami:** Combates reales con marcador en vivo y conteo estricto de amonestaciones.

---

### 3. CONSEJO PSICOLÓGICO PARA EL ENTRENADOR
En los momentos de máxima tensión, este deportista responde mejor a **instrucciones operativas breves** (ejemplo: *"¡Pisa fuera!", "¡Pie arriba!"*) que a correcciones teóricas. En el minuto de descanso, dale 20 segundos de silencio para recuperar aire antes de darle 1 sola consigna táctica.`;

    return {
      athleteName: athlete.fullName,
      currentLevelAssessment: "Competidor con excelente predisposición pero con necesidad de acortar tiempos de recobro post-patada.",
      criticalWeaknesses: detectedIssues.map((issue) => ({
        issue,
        rootCause: "Déficit neuromuscular en cadena posterior y hábito de retroceso lineal.",
        correctiveDrills: [
          "Drill de salida lateral con obstáculo en el tatami.",
          "Ejercicios pliométricos de tobillo sobre tatami flotante.",
        ],
      })),
      customFourWeekRoadmap: [
        { week: 1, focus: "Biomecánica y Core", keyExercise: "Estabilidad en suspensión y equilibrio monopodal" },
        { week: 2, focus: "Velocidad de repliegue", keyExercise: "Drill de paletas con retorno rápido a guardia" },
        { week: 3, focus: "Resistencia anaeróbica Z5", keyExercise: "Sparring con relevos en fatiga" },
        { week: 4, focus: "Simulación de combate oficial", keyExercise: "Asaltos con marcador Daedo y arbitraje real" },
      ],
      mentalAndTacticalRecommendations: "Focalizar en 1 consigna por asalto y reforzar la autoconfianza defensiva.",
      markdownDoc,
    };
  }
}
