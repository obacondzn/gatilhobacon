"use client";

import { useEffect, useMemo, useState } from "react";

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

  const [editingId, setEditingId] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    try {
      const [a, e] = await Promise.all([
        fetch("/api/automations", {
          cache: "no-store",
        }),
        fetch("/api/events", {
          cache: "no-store",
        }),
      ]);

      const aj = await a.json();
      const ej = await e.json();

      setAutomations(aj.automations ?? []);
      setEvents(ej.events ?? []);
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

    if (!cleanKeyword || !cleanResponse) {
      setMessage(
        "Palavra-chave e resposta são obrigatórias."
      );
      return;
    }

    if (dmEnabled && !cleanDmReply) {
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
    <div className="min-h-screen bg-[#f7f7fb] text-[#17151d]">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-8 py-5">
          <div>
            <div className="text-2xl font-bold tracking-tight">
              gatilho
              <span className="text-violet-600">
                .
              </span>
            </div>

            <div className="text-xs text-gray-500">
              Instagram automation
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              Instagram conectado
            </span>

            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-violet-500 to-pink-500" />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-8 py-8">
        <div>
          <h1 className="text-3xl font-bold">
            Dashboard
          </h1>

          <p className="mt-1 text-gray-500">
            Configure automações e acompanhe as
            interações recebidas.
          </p>
        </div>

        <section className="grid gap-4 md:grid-cols-3">
          <Stat
            title="Eventos recebidos"
            value={events.length}
          />

          <Stat
            title="Pendentes"
            value={pending}
          />

          <Stat
            title="Processados"
            value={processed}
          />
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold">
                  {editingId
                    ? "Editar automação"
                    : "Nova automação"}
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Configure o comportamento quando
                  alguém comentar.
                </p>
              </div>

              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-lg border px-3 py-2 text-xs font-semibold hover:bg-gray-50"
                >
                  Cancelar
                </button>
              )}
            </div>

            <form
              onSubmit={saveAutomation}
              className="mt-6 space-y-5"
            >
              <label className="block text-sm font-medium">
                Palavra-chave

                <input
                  value={keyword}
                  onChange={(e) =>
                    setKeyword(
                      e.target.value
                    )
                  }
                  placeholder="Ex: Efeito"
                  className="mt-2 w-full rounded-xl border px-4 py-3 outline-none focus:border-violet-500"
                />
              </label>

              <label className="block text-sm font-medium">
                Resposta no comentário

                <textarea
                  value={response}
                  onChange={(e) =>
                    setResponse(
                      e.target.value
                    )
                  }
                  rows={3}
                  placeholder="Digite a resposta pública..."
                  className="mt-2 w-full resize-none rounded-xl border px-4 py-3 outline-none focus:border-violet-500"
                />
              </label>

              <div className="border-t" />

              <div className="rounded-xl border bg-gray-50 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="font-semibold">
                      Mensagem direta
                    </div>

                    <div className="mt-1 text-sm text-gray-500">
                      Envie uma DM automaticamente
                      para quem comentar.
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setDmEnabled(
                        !dmEnabled
                      )
                    }
                    aria-pressed={dmEnabled}
                    className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                      dmEnabled
                        ? "bg-violet-600"
                        : "bg-gray-300"
                    }`}
                  >
                    <span
                      className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition ${
                        dmEnabled
                          ? "left-6"
                          : "left-1"
                      }`}
                    />
                  </button>
                </div>

                {dmEnabled && (
                  <div className="mt-4">
                    <label className="block text-sm font-medium">
                      Mensagem da DM

                      <textarea
                        value={dmReply}
                        onChange={(e) =>
                          setDmReply(
                            e.target.value
                          )
                        }
                        rows={4}
                        placeholder="Digite a mensagem que será enviada..."
                        className="mt-2 w-full resize-none rounded-xl border bg-white px-4 py-3 outline-none focus:border-violet-500"
                      />
                    </label>

                    <p className="mt-2 text-xs text-gray-400">
                      Teste sem link por enquanto.
                    </p>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-[#17151d] px-4 py-3 font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {loading
                  ? "Salvando..."
                  : editingId
                    ? "Salvar alterações"
                    : "Salvar automação"}
              </button>
            </form>

            {message && (
              <p className="mt-4 rounded-xl bg-violet-50 p-3 text-sm text-violet-800">
                {message}
              </p>
            )}
          </div>

          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">
                  Fluxo ativo
                </h2>

                <p className="text-sm text-gray-500">
                  Comentário → palavra-chave →
                  resposta
                  {activeAutomation?.dm_enabled &&
                    " → DM"}
                </p>
              </div>

              <button
                onClick={processNow}
                disabled={loading}
                className="rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50"
              >
                Processar agora
              </button>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Flow
                title="Comentário"
                text={
                  latestComment?.text ||
                  "Efeito"
                }
              />

              <span className="text-gray-300">
                →
              </span>

              <Flow
                title="Palavra-chave"
                text={
                  activeAutomation
                    ?.keywords?.[0] ||
                  "Efeito"
                }
              />

              <span className="text-gray-300">
                →
              </span>

              <Flow
                title="Resposta"
                text={
                  activeAutomation
                    ?.static_reply ||
                  "Oi! Vi seu comentário 👋"
                }
              />
            </div>

            {activeAutomation?.dm_enabled && (
              <div className="mt-4 flex items-center gap-3">
                <span className="text-gray-300">
                  ↓
                </span>

                <Flow
                  title="Mensagem direta"
                  text={
                    activeAutomation
                      .dm_reply ||
                    "Mensagem direta"
                  }
                />
              </div>
            )}

            <div className="mt-6 rounded-xl bg-gray-50 p-4 text-sm">
              <b>Conta profissional</b>

              <div className="mt-1 text-gray-500">
                Instagram conectado • pronto para
                receber eventos
              </div>
            </div>
          </div>
        </section>

        {/* AUTOMAÇÕES */}
        <section className="rounded-2xl border bg-white shadow-sm">
          <div className="border-b px-6 py-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold">
                  Minhas automações
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Edite ou exclua suas regras.
                </p>
              </div>

              <span className="text-sm text-gray-400">
                {automations.length}{" "}
                {automations.length === 1
                  ? "automação"
                  : "automações"}
              </span>
            </div>
          </div>

          <div className="divide-y">
            {automations.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-500">
                Nenhuma automação criada.
              </div>
            ) : (
              automations.map(
                (automation) => (
                  <div
                    key={automation.id}
                    className="flex flex-col gap-4 px-6 py-5 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">
                          {automation.name}
                        </span>

                        <span className="rounded-full bg-violet-50 px-2 py-1 text-xs font-semibold text-violet-700">
                          {automation.keywords?.[0] ||
                            "sem palavra-chave"}
                        </span>

                        {automation.dm_enabled && (
                          <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">
                            DM ativada
                          </span>
                        )}
                      </div>

                      <div className="mt-2 text-sm text-gray-500">
                        {automation.static_reply ||
                          "Sem resposta configurada"}
                      </div>

                      {automation.dm_enabled &&
                        automation.dm_reply && (
                          <div className="mt-1 text-xs text-gray-400">
                            DM:{" "}
                            {
                              automation.dm_reply
                            }
                          </div>
                        )}
                    </div>

                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          editAutomation(
                            automation
                          )
                        }
                        disabled={loading}
                        className="rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50"
                      >
                        Editar
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          deleteAutomation(
                            automation
                          )
                        }
                        disabled={loading}
                        className="rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        Excluir
                      </button>
                    </div>
                  </div>
                )
              )
            )}
          </div>
        </section>

        {/* ACTIVITY */}
        <section className="rounded-2xl border bg-white shadow-sm">
          <div className="border-b px-6 py-5">
            <h2 className="font-bold">
              Atividade recente
            </h2>
          </div>

          <div className="divide-y">
            {events.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-500">
                Nenhum evento recebido ainda.
              </div>
            ) : (
              events.map((event) => {
                const value =
                  event.payload?.entry?.[0]
                    ?.changes?.[0]?.value;

                const result =
                  event.processing_result;

                const dmSent =
                  result?.dm?.sent === true;

                const commentSent =
                  result?.comment_reply?.sent ===
                  true;

                return (
                  <div
                    key={event.id}
                    className="flex items-center justify-between gap-4 px-6 py-4"
                  >
                    <div className="min-w-0">
                      <div className="font-medium">
                        {value?.from?.username
                          ? `@${value.from.username}`
                          : "Usuário do Instagram"}
                      </div>

                      <div className="truncate text-sm text-gray-500">
                        {value?.text ||
                          "Evento recebido"}
                      </div>

                      {event.processed &&
                        result && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {commentSent && (
                              <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
                                Comentário respondido
                              </span>
                            )}

                            {dmSent && (
                              <span className="rounded-full bg-violet-50 px-2 py-1 text-[11px] font-semibold text-violet-700">
                                DM enviada
                              </span>
                            )}
                          </div>
                        )}
                    </div>

                    <div className="shrink-0 text-right">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          event.processed
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {event.processed
                          ? "Processado"
                          : "Pendente"}
                      </span>

                      <div className="mt-1 text-xs text-gray-400">
                        {new Date(
                          event.created_at
                        ).toLocaleString(
                          "pt-BR"
                        )}
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

function Stat({
  title,
  value,
}: {
  title: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="text-sm text-gray-500">
        {title}
      </div>

      <div className="mt-2 text-3xl font-bold">
        {value}
      </div>
    </div>
  );
}

function Flow({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <div className="min-w-0 flex-1 rounded-xl border p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">
        {title}
      </div>

      <div className="mt-2 truncate text-sm font-medium">
        {text}
      </div>
    </div>
  );
}