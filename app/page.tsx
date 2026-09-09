"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

type Automation = {
  id: string;
  name: string;
  keywords: string[];
  match_mode: string;
  static_reply: string | null;
  is_active: boolean;
  active: boolean;
  dm_enabled: boolean;
  dm_reply: string | null;
  ai_mode: boolean;
  ai_system_prompt: string | null;
};

type AIConfig = {
  tone: string;
  personality: string;
  instructions: string;
};

type Event = {
  id: string;
  created_at: string;
  payload: any;
  processed: boolean;
  processing_result?: any;
};

export default function Home() {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [events, setEvents] = useState<Event[]>([]);

  const [keyword, setKeyword] = useState("");
  const [response, setResponse] = useState("");

  const [dmEnabled, setDmEnabled] = useState(false);
  const [dmReply, setDmReply] = useState("");

  const [aiMode, setAiMode] = useState(false);
  const [aiSystemPrompt, setAiSystemPrompt] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const [aiConfig, setAiConfig] = useState<AIConfig>({
    tone: "Informal",
    personality: "Criativo, descontraído e brasileiro.",
    instructions: "Fale como eu falaria.",
  });

  const [aiConfigLoading, setAiConfigLoading] = useState(false);
  const [aiConfigMessage, setAiConfigMessage] = useState("");

  async function load() {
    try {
      const [a, e, c] = await Promise.all([
        fetch("/api/automations", {
          cache: "no-store",
        }),
        fetch("/api/events", {
          cache: "no-store",
        }),
        fetch("/api/ai-config", {
          cache: "no-store",
        }),
      ]);

      const aj = await a.json();
      const ej = await e.json();
      const cj = await c.json();

      setAutomations(aj.automations ?? []);
      setEvents(ej.events ?? []);

      if (cj?.config) {
        setAiConfig(cj.config);
      }
    } catch (error) {
      console.error(error);
      setMessage("Erro ao carregar dados.");
    }
  }

  useEffect(() => {
    load();

    const interval = setInterval(load, 5000);

    return () => clearInterval(interval);
  }, []);

  function resetForm() {
    setEditingId(null);
    setKeyword("");
    setResponse("");
    setDmEnabled(false);
    setDmReply("");
    setAiMode(false);
    setAiSystemPrompt("");
  }

  async function saveAiConfig(e: React.FormEvent) {
    e.preventDefault();

    setAiConfigLoading(true);
    setAiConfigMessage("");

    try {
      const res = await fetch("/api/ai-config", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(aiConfig),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        setAiConfigMessage(
          data.message ||
            "Não foi possível salvar a configuração da IA."
        );
        return;
      }

      setAiConfig(data.config);
      setAiConfigMessage("Configuração da IA salva.");
    } catch (error) {
      console.error(error);
      setAiConfigMessage("Erro ao salvar a configuração da IA.");
    } finally {
      setAiConfigLoading(false);
    }
  }

  function editAutomation(automation: Automation) {
    setEditingId(automation.id);

    setKeyword(
      automation.keywords?.[0] ?? ""
    );

    setResponse(
      automation.static_reply ?? ""
    );

    setDmEnabled(
      automation.dm_enabled ?? false
    );

    setDmReply(
      automation.dm_reply ?? ""
    );

    setAiMode(
      automation.ai_mode ?? false
    );

    setAiSystemPrompt(
      automation.ai_system_prompt ?? ""
    );

    setMessage("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function deleteAutomation(
    automation: Automation
  ) {
    const confirmed = window.confirm(
      `Excluir a automação "${automation.name}"?`
    );

    if (!confirmed) return;

    setLoading(true);
    setMessage("");

    try {
      const res = await fetch(
        `/api/automations?id=${encodeURIComponent(
          automation.id
        )}`,
        {
          method: "DELETE",
        }
      );

      const data = await res.json();

      if (!res.ok || !data.ok) {
        setMessage(
          data.message ||
            "Não foi possível excluir."
        );
        return;
      }

      if (editingId === automation.id) {
        resetForm();
      }

      setMessage("Automação excluída.");

      await load();
    } catch (error) {
      console.error(error);
      setMessage(
        "Erro ao excluir automação."
      );
    } finally {
      setLoading(false);
    }
  }

  async function saveAutomation(
    e: React.FormEvent
  ) {
    e.preventDefault();

    const cleanKeyword =
      keyword.trim();

    const cleanResponse =
      response.trim();

    const cleanDmReply =
      dmReply.trim();

    const cleanAiSystemPrompt =
      aiSystemPrompt.trim();

    if (!cleanKeyword) {
      setMessage("Palavra-chave é obrigatória.");
      return;
    }

    if (!aiMode && !cleanResponse) {
      setMessage(
        "Palavra-chave e resposta são obrigatórias."
      );
      return;
    }

    if (dmEnabled && !aiMode && !cleanDmReply) {
      setMessage(
        "Digite a mensagem direta."
      );
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const method = editingId
        ? "PUT"
        : "POST";

      const body = {
        id: editingId,
        keyword: cleanKeyword,
        response: cleanResponse,
        dm_enabled: dmEnabled,
        dm_reply: dmEnabled
          ? cleanDmReply
          : null,
        ai_mode: aiMode,
        ai_system_prompt: aiMode
          ? cleanAiSystemPrompt
          : null,
      };

      const res = await fetch(
        "/api/automations",
        {
          method,
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify(body),
        }
      );

      const data = await res.json();

      if (!res.ok || !data.ok) {
        setMessage(
          data.message ||
            "Não foi possível salvar."
        );
        return;
      }

      setMessage(
        editingId
          ? "Automação atualizada."
          : "Automação criada."
      );

      resetForm();

      await load();
    } catch (error) {
      console.error(error);

      setMessage(
        "Erro ao salvar automação."
      );
    } finally {
      setLoading(false);
    }
  }

  async function processNow() {
    setLoading(true);
    setMessage("");

    try {
      const res = await fetch(
        "/api/processor",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            limit: 20,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok || !data.ok) {
        setMessage(
          data.message ||
            "Erro ao processar eventos."
        );
        return;
      }

      setMessage(
        `${data.processed} evento(s) processado(s).`
      );

      await load();
    } catch (error) {
      console.error(error);

      setMessage(
        "Erro ao processar eventos."
      );
    } finally {
      setLoading(false);
    }
  }

  const pending = events.filter(
    (event) => !event.processed
  ).length;

  const processed = events.filter(
    (event) => event.processed
  ).length;

  const latestComment = useMemo(
    () =>
      events[0]?.payload?.entry?.[0]
        ?.changes?.[0]?.value,
    [events]
  );

  const activeAutomation =
    automations.find(
      (automation) =>
        automation.active &&
        automation.is_active
    ) || automations[0];

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 md:px-10">
          <div>
            <div className="text-xl font-extrabold tracking-tight">
              Gatilho
            </div>

            <div className="mt-0.5 text-[13px] text-muted">
              Automação para Instagram
            </div>
          </div>

          <div className="flex items-center gap-6">
            <a
              href="/pessoas"
              className="text-[13px] font-semibold text-muted underline decoration-line underline-offset-4 transition-colors hover:text-ink"
            >
              Pessoas
            </a>

            <div className="flex items-center gap-2 text-[13px] text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-ok" />
              Instagram conectado
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10 md:px-10 md:py-14">
        {/* HERO / OVERVIEW */}
        <section className="border-b border-line pb-10 md:pb-14">
          <h1 className="max-w-2xl text-[2.5rem] font-extrabold leading-[1.05] tracking-tight md:text-6xl">
            Suas automações,
            <br />
            em um só lugar.
          </h1>

          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-muted">
            Configure o que acontece quando alguém comenta ou envia
            mensagem para o seu perfil.
          </p>

          <div className="mt-10 grid grid-cols-3 divide-x divide-line border-y border-line">
            <StatBlock
              title="Eventos recebidos"
              value={events.length}
            />

            <StatBlock
              title="Pendentes"
              value={pending}
            />

            <StatBlock
              title="Processados"
              value={processed}
            />
          </div>
        </section>

        {/* FORM + FLOW */}
        <section className="grid gap-x-16 gap-y-10 border-b border-line py-10 md:py-14 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-xl font-bold tracking-tight">
                {editingId
                  ? "Editar automação"
                  : "Nova automação"}
              </h2>

              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-[13px] font-semibold text-muted underline decoration-line underline-offset-4 hover:text-ink"
                >
                  Cancelar
                </button>
              )}
            </div>

            <p className="mt-1 text-[13px] text-muted">
              Defina o comportamento quando alguém comentar.
            </p>

            <form
              onSubmit={saveAutomation}
              className="mt-8 space-y-6"
            >
              <label className="block">
                <span className="text-[13px] font-medium text-ink-soft">
                  Palavra-chave
                </span>

                <input
                  value={keyword}
                  onChange={(e) =>
                    setKeyword(e.target.value)
                  }
                  placeholder="Ex: Efeito"
                  className="mt-2 w-full border border-line bg-surface px-3.5 py-3 text-[15px] outline-none transition-colors focus:border-ink"
                />
              </label>

              <label className="block">
                <span className="text-[13px] font-medium text-ink-soft">
                  Resposta no comentário
                  {aiMode &&
                    " (fallback se a IA falhar)"}
                </span>

                <textarea
                  value={response}
                  onChange={(e) =>
                    setResponse(e.target.value)
                  }
                  rows={3}
                  placeholder="Digite a resposta pública..."
                  className="mt-2 w-full resize-none border border-line bg-surface px-3.5 py-3 text-[15px] outline-none transition-colors focus:border-ink"
                />
              </label>

              <div className="border border-line p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-[14px] font-semibold">
                      Responder com IA
                    </div>

                    <div className="mt-1 text-[13px] text-muted">
                      A resposta é gerada pelo Gemini a partir do contexto
                      real da conversa, em vez de um texto fixo.
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setAiMode(!aiMode)
                    }
                    aria-pressed={aiMode}
                    className={`relative h-5 w-9 shrink-0 border transition-colors ${
                      aiMode
                        ? "border-ink bg-ink"
                        : "border-line-strong bg-transparent"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-3.5 w-3.5 transition-transform ${
                        aiMode
                          ? "translate-x-4 bg-paper"
                          : "translate-x-0.5 bg-ink-soft"
                      }`}
                    />
                  </button>
                </div>

                {aiMode && (
                  <div className="mt-4">
                    <label className="block">
                      <span className="text-[13px] font-medium text-ink-soft">
                        Instruções específicas para este gatilho
                      </span>

                      <textarea
                        value={aiSystemPrompt}
                        onChange={(e) =>
                          setAiSystemPrompt(
                            e.target.value
                          )
                        }
                        rows={3}
                        placeholder="Ex: fale sobre o efeito de edição que a pessoa comentou, sem mencionar preço."
                        className="mt-2 w-full resize-none border border-line bg-paper px-3.5 py-3 text-[15px] outline-none transition-colors focus:border-ink"
                      />
                    </label>

                    <p className="mt-2 text-[12px] text-faint">
                      O tom geral e a personalidade vêm da configuração da
                      IA, mais abaixo.
                    </p>
                  </div>
                )}
              </div>

              <div className="border border-line p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-[14px] font-semibold">
                      Mensagem direta
                    </div>

                    <div className="mt-1 text-[13px] text-muted">
                      Envie uma DM automaticamente para quem comentar.
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setDmEnabled(!dmEnabled)
                    }
                    aria-pressed={dmEnabled}
                    className={`relative h-5 w-9 shrink-0 border transition-colors ${
                      dmEnabled
                        ? "border-ink bg-ink"
                        : "border-line-strong bg-transparent"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-3.5 w-3.5 transition-transform ${
                        dmEnabled
                          ? "translate-x-4 bg-paper"
                          : "translate-x-0.5 bg-ink-soft"
                      }`}
                    />
                  </button>
                </div>

                {dmEnabled && (
                  <div className="mt-4">
                    <label className="block">
                      <span className="text-[13px] font-medium text-ink-soft">
                        Mensagem da DM
                      </span>

                      <textarea
                        value={dmReply}
                        onChange={(e) =>
                          setDmReply(e.target.value)
                        }
                        rows={4}
                        placeholder="Digite a mensagem que será enviada..."
                        className="mt-2 w-full resize-none border border-line bg-paper px-3.5 py-3 text-[15px] outline-none transition-colors focus:border-ink"
                      />
                    </label>

                    <p className="mt-2 text-[12px] text-faint">
                      Teste sem link por enquanto.
                    </p>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-ink px-4 py-3.5 text-[14px] font-bold uppercase tracking-wide text-paper transition-opacity hover:opacity-85 disabled:opacity-50"
              >
                {loading
                  ? "Salvando..."
                  : editingId
                    ? "Salvar alterações"
                    : "Salvar automação"}
              </button>
            </form>

            {message && (
              <p className="mt-4 border border-line-strong px-4 py-3 text-[13px]">
                {message}
              </p>
            )}
          </div>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold tracking-tight">
                  Fluxo ativo
                </h2>

                <p className="mt-1 text-[13px] text-muted">
                  Comentário → palavra-chave → resposta
                  {activeAutomation?.dm_enabled &&
                    " → DM"}
                </p>
              </div>

              <button
                onClick={processNow}
                disabled={loading}
                className="border border-line px-4 py-2 text-[13px] font-bold uppercase tracking-wide transition-colors hover:border-ink disabled:opacity-50"
              >
                Processar agora
              </button>
            </div>

            <div className="mt-8 flex flex-wrap items-stretch gap-3">
              <FlowStep
                title="Comentário"
                text={latestComment?.text || "Efeito"}
              />

              <FlowArrow />

              <FlowStep
                title="Palavra-chave"
                text={
                  activeAutomation?.keywords?.[0] ||
                  "Efeito"
                }
              />

              <FlowArrow />

              <FlowStep
                title="Resposta"
                text={
                  activeAutomation?.static_reply ||
                  "Oi! Vi seu comentário 👋"
                }
              />
            </div>

            {activeAutomation?.dm_enabled && (
              <div className="mt-3 flex items-center gap-3">
                <span className="pl-1 text-faint">
                  ↓
                </span>

                <FlowStep
                  title="Mensagem direta"
                  text={
                    activeAutomation.dm_reply ||
                    "Mensagem direta"
                  }
                />
              </div>
            )}

            <div className="mt-8 border-t border-line pt-6 text-[13px]">
              <span className="font-semibold">
                Conta profissional
              </span>

              <span className="text-muted">
                {" "}
                — Instagram conectado, pronta para receber eventos.
              </span>
            </div>
          </div>
        </section>

        {/* CONFIGURAÇÃO DA IA */}
        <section className="border-b border-line py-10 md:py-14">
          <h2 className="text-xl font-bold tracking-tight">
            Configuração da IA
          </h2>

          <p className="mt-1 text-[13px] text-muted">
            Tom e personalidade usados em toda automação com IA ativada.
          </p>

          <form
            onSubmit={saveAiConfig}
            className="mt-8 grid gap-6 md:grid-cols-2"
          >
            <label className="block">
              <span className="text-[13px] font-medium text-ink-soft">
                Tom
              </span>

              <input
                value={aiConfig.tone}
                onChange={(e) =>
                  setAiConfig({
                    ...aiConfig,
                    tone: e.target.value,
                  })
                }
                placeholder="Ex: Informal"
                className="mt-2 w-full border border-line bg-surface px-3.5 py-3 text-[15px] outline-none transition-colors focus:border-ink"
              />
            </label>

            <label className="block">
              <span className="text-[13px] font-medium text-ink-soft">
                Personalidade
              </span>

              <input
                value={aiConfig.personality}
                onChange={(e) =>
                  setAiConfig({
                    ...aiConfig,
                    personality: e.target.value,
                  })
                }
                placeholder="Ex: Criativo, descontraído e brasileiro."
                className="mt-2 w-full border border-line bg-surface px-3.5 py-3 text-[15px] outline-none transition-colors focus:border-ink"
              />
            </label>

            <label className="block md:col-span-2">
              <span className="text-[13px] font-medium text-ink-soft">
                Instruções
              </span>

              <textarea
                value={aiConfig.instructions}
                onChange={(e) =>
                  setAiConfig({
                    ...aiConfig,
                    instructions: e.target.value,
                  })
                }
                rows={3}
                placeholder="Ex: Fale como eu falaria."
                className="mt-2 w-full resize-none border border-line bg-surface px-3.5 py-3 text-[15px] outline-none transition-colors focus:border-ink"
              />
            </label>

            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={aiConfigLoading}
                className="border border-line px-4 py-2.5 text-[13px] font-bold uppercase tracking-wide transition-colors hover:border-ink disabled:opacity-50"
              >
                {aiConfigLoading
                  ? "Salvando..."
                  : "Salvar configuração"}
              </button>

              {aiConfigMessage && (
                <span className="ml-4 text-[13px] text-muted">
                  {aiConfigMessage}
                </span>
              )}
            </div>
          </form>
        </section>

        {/* AUTOMAÇÕES */}
        <section className="border-b border-line py-10 md:py-14">
          <div className="flex items-end justify-between gap-4">
            <h2 className="text-xl font-bold tracking-tight">
              Minhas automações
            </h2>

            <span className="text-[13px] text-muted">
              {automations.length}{" "}
              {automations.length === 1
                ? "automação"
                : "automações"}
            </span>
          </div>

          <div className="mt-6 divide-y divide-line border-t border-line">
            {automations.length === 0 ? (
              <div className="py-10 text-center text-[14px] text-muted">
                Nenhuma automação criada.
              </div>
            ) : (
              automations.map((automation) => (
                <div
                  key={automation.id}
                  className="flex flex-col gap-4 py-5 md:flex-row md:items-center md:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-semibold">
                        {automation.name}
                      </span>

                      <Tag>
                        {automation.keywords?.[0] ||
                          "sem palavra-chave"}
                      </Tag>

                      {automation.ai_mode && (
                        <Tag>IA ativada</Tag>
                      )}

                      {automation.dm_enabled && (
                        <Tag>DM ativada</Tag>
                      )}
                    </div>

                    <div className="mt-2 text-[14px] text-muted">
                      {automation.ai_mode
                        ? "Resposta gerada por IA" +
                          (automation.static_reply
                            ? ` · fallback: ${automation.static_reply}`
                            : "")
                        : automation.static_reply ||
                          "Sem resposta configurada"}
                    </div>

                    {automation.dm_enabled &&
                      automation.dm_reply && (
                        <div className="mt-1 text-[12px] text-faint">
                          DM: {automation.dm_reply}
                        </div>
                      )}
                  </div>

                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        editAutomation(automation)
                      }
                      disabled={loading}
                      className="border border-line px-4 py-2 text-[13px] font-bold uppercase tracking-wide transition-colors hover:border-ink disabled:opacity-50"
                    >
                      Editar
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        deleteAutomation(automation)
                      }
                      disabled={loading}
                      className="border border-line px-4 py-2 text-[13px] font-bold uppercase tracking-wide text-bad transition-colors hover:border-bad disabled:opacity-50"
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* ACTIVITY */}
        <section className="py-10 md:py-14">
          <h2 className="text-xl font-bold tracking-tight">
            Atividade recente
          </h2>

          <div className="mt-6 divide-y divide-line border-t border-line">
            {events.length === 0 ? (
              <div className="py-10 text-center text-[14px] text-muted">
                Nenhum evento recebido ainda.
              </div>
            ) : (
              events.map((event) => {
                const value =
                  event.payload?.entry?.[0]?.changes?.[0]?.value;

                const result =
                  event.processing_result;

                const dmSent =
                  result?.dm?.sent === true;

                const commentSent =
                  result?.comment_reply?.sent === true;

                return (
                  <div
                    key={event.id}
                    className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="font-medium">
                        {value?.from?.username
                          ? `@${value.from.username}`
                          : "Usuário do Instagram"}
                      </div>

                      <div className="truncate text-[14px] text-muted">
                        {value?.text ||
                          "Evento recebido"}
                      </div>

                      {event.processed &&
                        result && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {commentSent && (
                              <Tag tone="ok">
                                Comentário respondido
                              </Tag>
                            )}

                            {dmSent && (
                              <Tag tone="ok">
                                DM enviada
                              </Tag>
                            )}
                          </div>
                        )}
                    </div>

                    <div className="shrink-0 text-left md:text-right">
                      <StatusLabel
                        processed={event.processed}
                      />

                      <div className="mt-1 text-[12px] text-faint">
                        {new Date(
                          event.created_at
                        ).toLocaleString("pt-BR")}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function StatBlock({
  title,
  value,
}: {
  title: string;
  value: number;
}) {
  return (
    <div className="px-0 py-6 first:pl-0 md:px-6">
      <div className="text-[13px] text-muted">
        {title}
      </div>

      <div className="mt-2 text-4xl font-extrabold tracking-tight md:text-5xl">
        {value}
      </div>
    </div>
  );
}

function FlowStep({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <div className="min-w-[9rem] flex-1 border border-line p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-faint">
        {title}
      </div>

      <div className="mt-2 truncate text-[14px] font-medium">
        {text}
      </div>
    </div>
  );
}

function FlowArrow() {
  return (
    <span
      className="flex items-center text-faint"
      aria-hidden
    >
      →
    </span>
  );
}

function Tag({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "ok";
}) {
  return (
    <span
      className={`border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
        tone === "ok"
          ? "border-ok bg-ok-bg text-ok"
          : "border-line-strong text-ink-soft"
      }`}
    >
      {children}
    </span>
  );
}

function StatusLabel({
  processed,
}: {
  processed: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide ${
        processed
          ? "text-ok"
          : "text-warn"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          processed
            ? "bg-ok"
            : "bg-warn"
        }`}
      />

      {processed
        ? "Processado"
        : "Pendente"}
    </span>
  );
}