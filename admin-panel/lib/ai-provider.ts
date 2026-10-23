export class AIProviderError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "AIProviderError";
  }
}

export interface AIImageInput {
  dataUrl: string;
  detail?: "auto" | "low" | "high";
}

export interface AICompletion {
  text: string;
  provider: string;
  model: string;
}

function getProviderConfig() {
  const githubToken = process.env.GITHUB_MODELS_TOKEN || process.env.GITHUB_TOKEN;
  if (githubToken) {
    return {
      token: githubToken,
      endpoint:
        process.env.GITHUB_MODELS_ENDPOINT ||
        "https://models.github.ai/inference/chat/completions",
      model: process.env.GITHUB_VISION_MODEL || "openai/gpt-4o",
      provider: "github-models",
    };
  }

  const openAIKey = process.env.OPENAI_API_KEY;
  if (openAIKey) {
    return {
      token: openAIKey,
      endpoint:
        process.env.OPENAI_BASE_URL ||
        "https://api.openai.com/v1/chat/completions",
      model: process.env.OPENAI_VISION_MODEL || "gpt-4o",
      provider: "openai",
    };
  }

  throw new AIProviderError(
    "Configura GITHUB_MODELS_TOKEN o OPENAI_API_KEY para habilitar el análisis de IA.",
    503
  );
}

export async function requestAICompletion(
  systemPrompt: string,
  userPrompt: string,
  images: AIImageInput[] = [],
  timeoutMs = 45000
): Promise<AICompletion> {
  const config = getProviderConfig();
  const content = [
    { type: "text", text: userPrompt },
    ...images.map((image) => ({
      type: "image_url",
      image_url: { url: image.dataUrl, detail: image.detail || "auto" },
    })),
  ];

  let response: Response;
  try {
    response = await fetch(config.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.token}`,
      },
      body: JSON.stringify({
        model: config.model,
        temperature: images.length ? 0.1 : 0.2,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: images.length ? content : userPrompt },
        ],
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const message =
      error instanceof Error && error.name === "TimeoutError"
        ? "El proveedor de IA agotó el tiempo de espera."
        : "No se pudo conectar con el proveedor de IA.";
    throw new AIProviderError(message, 502);
  }

  if (!response.ok) {
    throw new AIProviderError(
      `El proveedor de IA respondió con estado ${response.status}.`,
      response.status === 429 ? 429 : 502
    );
  }

  const payload: unknown = await response.json();
  if (
    !payload ||
    typeof payload !== "object" ||
    !("choices" in payload) ||
    !Array.isArray(payload.choices)
  ) {
    throw new AIProviderError("El proveedor devolvió una respuesta no válida.", 502);
  }

  const firstChoice = payload.choices[0] as
    | { message?: { content?: unknown } }
    | undefined;
  const text = firstChoice?.message?.content;
  if (typeof text !== "string" || !text.trim()) {
    throw new AIProviderError("El proveedor no devolvió contenido de análisis.", 502);
  }

  return { text: text.trim(), provider: config.provider, model: config.model };
}

export function parseAIJson<T>(text: string): T {
  const normalized = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  try {
    return JSON.parse(normalized) as T;
  } catch {
    throw new AIProviderError(
      "La respuesta de IA no cumple el formato estructurado esperado.",
      502
    );
  }
}
