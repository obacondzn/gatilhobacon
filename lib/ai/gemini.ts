import "server-only";

/**
 * ============================================================
 * CLIENTE GEMINI (Google AI Studio) — fetch direto
 * ============================================================
 *
 * Modelo: gemini-flash-latest
 * NÃO usar gemini-2.0-flash (proibido pela especificação).
 *
 * A chave vem de GEMINI_API_KEY (variável de ambiente).
 * NUNCA é exposta no client, em logs, ou em respostas de erro.
 */

const GEMINI_MODEL = "gemini-3.5-flash-lite";

const GEMINI_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/` +
  `${GEMINI_MODEL}:generateContent`;

export type AIDecision = {
  should_reply: boolean;
  response: string;
  classification?: string;
  reason?: string;
  intent?: string;
  topic?: string;
  related_content?: string;
};

export type AIContextMessage = {
  direction: "inbound" | "outbound";
  text: string;
};

export type AIContext = {
  /** Mensagem atual que disparou a automação. */
  currentMessage: string;

  /** Comentário original, se a conversa começou em um comentário. */
  originalComment?: string | null;

  /** Conteúdo (post/reel/story) que iniciou a conversa. */
  contentTitle?: string | null;
  contentTheme?: string | null;

  /** Nome de usuário do Instagram. */
  username?: string | null;

  /** Histórico real de mensagens (só o que está armazenado). */
  history: AIContextMessage[];

  /** Informações reais já conhecidas sobre o contato. */
  contact: {
    classification: string;
    interactionCount: number;
    recurring: boolean;
    interests: string[];
    topics: string[];
  };

  /** Configuração de tom/personalidade do produto. */
  aiConfig: {
    tone: string;
    personality: string;
    instructions: string;
  };

  /** Instruções específicas da automação, se houver. */
  automationSystemPrompt?: string | null;
};

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    should_reply: { type: "boolean" },
    response: { type: "string" },
    classification: { type: "string" },
    reason: { type: "string" },
    intent: { type: "string" },
    topic: { type: "string" },
    related_content: { type: "string" },
  },
  required: ["should_reply", "response"],
} as const;

function buildSystemInstruction(context: AIContext) {
  const lines: string[] = [];

  lines.push(
    "Você está respondendo comentários e mensagens diretas de um perfil " +
      "profissional do Instagram, no lugar de uma pessoa real."
  );

  lines.push(
    `Tom de voz: ${context.aiConfig.tone}. ` +
      `Personalidade: ${context.aiConfig.personality}.`
  );

  if (context.aiConfig.instructions) {
    lines.push(`Instruções do dono da conta: ${context.aiConfig.instructions}`);
  }

  if (context.automationSystemPrompt) {
    lines.push(
      `Instruções específicas para este gatilho: ${context.automationSystemPrompt}`
    );
  }

  lines.push(
    "Regras obrigatórias:",
    "- Pense como uma pessoa real responderia, NUNCA como um vendedor tentando fechar venda.",
    "- Normalmente 1 a 3 frases. Curto, natural, sem parecer robô.",
    "- Não use saudações genéricas de atendimento ('Olá! Como posso ajudá-lo?', 'Obrigado pelo seu comentário!').",
    "- Não faça perguntas desnecessárias nem force continuar a conversa.",
    "- Não venda nada sem intenção clara da pessoa.",
    "- Não invente histórico, fatos ou proximidade que não estão no contexto fornecido.",
    "- Não finja conhecer a pessoa além do que está no contexto.",
    "- Só use familiaridade (brincadeiras sobre já ter aparecido antes, etc) se `recurring` for true. Nunca na primeira interação.",
    "- Não mencione WhatsApp automaticamente.",
    "- Se a conversa já terminou naturalmente ou não há o que responder, retorne should_reply=false.",
    "- Responda SOMENTE com o JSON pedido, sem markdown, sem texto fora do JSON."
  );

  return lines.join("\n");
}

function buildUserPrompt(context: AIContext) {
  const historyText =
    context.history.length > 0
      ? context.history
          .map(
            (m) =>
              `${m.direction === "inbound" ? "Pessoa" : "Você"}: ${m.text}`
          )
          .join("\n")
      : "(sem histórico anterior)";

  const parts = [
    `Username: ${context.username ?? "desconhecido"}`,
    `Classificação atual: ${context.contact.classification}`,
    `Número de interações anteriores: ${context.contact.interactionCount}`,
    `Pessoa recorrente: ${context.contact.recurring ? "sim" : "não"}`,
    context.contact.interests.length
      ? `Interesses conhecidos: ${context.contact.interests.join(", ")}`
      : null,
    context.contact.topics.length
      ? `Assuntos já comentados: ${context.contact.topics.join(", ")}`
      : null,
    context.contentTitle
      ? `Conteúdo que originou a conversa: ${context.contentTitle}`
      : null,
    context.contentTheme ? `Tema do conteúdo: ${context.contentTheme}` : null,
    context.originalComment
      ? `Comentário original: "${context.originalComment}"`
      : null,
    "",
    "Histórico da conversa:",
    historyText,
    "",
    `Mensagem atual da pessoa: "${context.currentMessage}"`,
    "",
    "Responda em JSON no formato:",
    JSON.stringify(
      {
        should_reply: true,
        response: "...",
        classification: "novo | curioso | recorrente | engajado | fã | criador | potencial_cliente | cliente | suporte | spam",
        reason: "...",
        intent: "...",
        topic: "...",
        related_content: "...",
      },
      null,
      2
    ),
  ];

  return parts.filter(Boolean).join("\n");
}

/**
 * Valida minimamente o formato esperado da resposta do Gemini,
 * sem confiar cegamente no modelo.
 */
function isValidDecision(value: unknown): value is AIDecision {
  if (!value || typeof value !== "object") return false;

  const v = value as Record<string, unknown>;

  return (
    typeof v.should_reply === "boolean" &&
    typeof v.response === "string"
  );
}

export async function generateAIReply(
  context: AIContext
): Promise<
  | { ok: true; decision: AIDecision }
  | { ok: false; reason: string }
> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return { ok: false, reason: "GEMINI_API_KEY não configurado" };
  }

  const systemInstruction = buildSystemInstruction(context);
  const userPrompt = buildUserPrompt(context);

  let response: Response;

  try {
    response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: systemInstruction }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: userPrompt }],
          },
        ],
        generationConfig: {
  responseMimeType: "application/json",
  temperature: 0.9,
          },
      }),
      cache: "no-store",
    });
  } catch (error) {
    return {
      ok: false,
      reason:
        error instanceof Error
          ? `Erro de conexão com o Gemini: ${error.message}`
          : "Erro de conexão com o Gemini",
    };
  }

  if (!response.ok) {
    // Nunca expor a API key nem o corpo bruto do erro (pode conter a key
    // ecoada de volta em alguns casos de erro de autenticação).
    return {
      ok: false,
      reason: `Gemini retornou status ${response.status}`,
    };
  }

  let data: unknown;

  try {
    data = await response.json();
  } catch {
    return { ok: false, reason: "Resposta do Gemini não é um JSON válido" };
  }

  const text = (
    data as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    }
  )?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    return { ok: false, reason: "Gemini não retornou conteúdo de texto" };
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, reason: "JSON da decisão da IA é inválido" };
  }

  if (!isValidDecision(parsed)) {
    return { ok: false, reason: "Formato da decisão da IA é inválido" };
  }

  return { ok: true, decision: parsed };
}
