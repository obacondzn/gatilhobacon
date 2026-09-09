"use client";

import { useEffect, useMemo, useState } from "react";

type Automation = {
  id: string;
  name: string;
  keywords: string[];
  static_reply: string | null;
  is_active: boolean;
  active: boolean;
  match_mode?: string;
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

  const [keyword, setKeyword] = useState("Efeito");
  const [response, setResponse] = useState(
    "Oi! Vi seu comentário 👋"
  );

  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    try {
      const [a, e] = await Promise.all([
        fetch("/api/automations", { cache: "no-store" }),
        fetch("/api/events", { cache: "no-store" }),
      ]);

      const aj = await a.json();
      const ej = await e.json();

      setAutomations(aj.automations ?? []);
      setEvents(ej.events ?? []);
    } catch (error) {
      console.error("Erro ao carregar dashboard:", error);
    }
  }

  useEffect(() => {
    load();

    const id = setInterval(load, 5000);

    return () => clearInterval(id);
  }, []);

  function startEditing(automation: Automation) {
    setEditingId(automation.id);

    setKeyword(
      automation.keywords?.[0] || ""
    );

    setResponse(
      automation.static_reply || ""
    );

    setMessage("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function cancelEditing() {
    setEditingId(null);
    setKeyword("Efeito");
    setResponse("Oi! Vi seu comentário 👋");
    setMessage("");
  }

  async function saveAutomation(
    e: React.FormEvent
  ) {
    e.preventDefault();

    setLoading(true);
    setMessage("");

    const method = editingId ? "PUT" : "POST";

    const body = {
      ...(editingId ? { id: editingId } : {}),
      keyword,
      response,
    };

    try {
      const res = await fetch("/api/automations", {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!data.ok) {
        setMessage(data.message || "Erro ao salvar automação.");
        setLoading(false);
        return;
      }

      setMessage(
        editingId
          ? "Automação atualizada."
          : "Automação criada."
      );

      setEditingId(null);

      await load();
    } catch {
      setMessage("Não foi possível salvar a automação.");
    }

    setLoading(false);
  }

  async function processNow() {
    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/processor", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          limit: 20,
        }),
      });

      const data = await res.json();

      setMessage(
        data.ok
          ? `${data.processed} evento(s) processado(s).`
          : data.message
      );

      await load();
    } catch {
      setMessage("Não foi possível processar os eventos.");
    }

    setLoading(false);
  }

  const pending = events.filter(
    (event) => !event.processed
  ).length;

  const processed = events.filter(
    (event) => event.processed
  ).length;

  const latestComment = useMemo(
    () =>
      events[0]?.payload?.entry?.[0]?.changes?.[0]?.value,
    [events]
  );

  const activeAutomation =
    automations.find(
      (automation) =>
        automation.is_active && automation.active
    ) ||
    automations[0];

  return (
    <div className="min-h-screen bg-[#f7f7fb] text-[#17151d]">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-8 py-5">
          <div>
            <div className="text-2xl font-bold tracking-tight">
              gatilho
              <span className="text-violet-600">.</span>
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
            Configure automações e acompanhe as interações recebidas.
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
          {/* AUTOMATION FORM */}
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold">
                  {editingId
                    ? "Editar automação"
                    : "Nova automação"}
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Quando alguém comentar a palavra-chave, o Gatilho executa a resposta.
                </p>
              </div>

              {editingId && (
                <button
                  type="button"
                  onClick={cancelEditing}
                  className="rounded-xl border px-3 py-2 text-sm font-semibold hover:bg-gray-50"
                >
                  Cancelar
                </button>
              )}
            </div>

            <form
              onSubmit={saveAutomation}
              className="mt-6 space-y-4"
            >
              <label className="block text-sm font-medium">
                Palavra-chave

                <input
                  value={keyword}
                  onChange={(e) =>
                    setKeyword(e.target.value)
                  }
                  className="mt-2 w-full rounded-xl border px-4 py-3 outline-none focus:border-violet-500"
                  placeholder="Ex.: efeito"
                />
              </label>

              <label className="block text-sm font-medium">
                Resposta automática

                <textarea
                  value={response}
                  onChange={(e) =>
                    setResponse(e.target.value)
                  }
                  rows={4}
                  className="mt-2 w-full rounded-xl border px-4 py-3 outline-none focus:border-violet-500"
                  placeholder="Digite a resposta que será enviada..."
                />
              </label>

              <button
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

          {/* FLOW */}
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">
                  Fluxo ativo
                </h2>

                <p className="text-sm text-gray-500">
                  Comentário → palavra-chave → resposta
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

            <div className="mt-6 flex items-center gap-3">
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
                  activeAutomation?.keywords?.[0] ||
                  "Efeito"
                }
              />

              <span className="text-gray-300">
                →
              </span>

              <Flow
                title="Resposta"
                text={
                  activeAutomation?.static_reply ||
                  "Oi! Vi seu comentário 👋"
                }
              />
            </div>

            <div className="mt-6 rounded-xl bg-gray-50 p-4 text-sm">
              <b>Conta profissional</b>

              <div className="mt-1 text-gray-500">
                Instagram conectado • pronto para receber eventos
              </div>
            </div>
          </div>
        </section>

        {/* AUTOMATIONS */}
        <section className="rounded-2xl border bg-white shadow-sm">
          <div className="border-b px-6 py-5">
            <h2 className="font-bold">
              Automações
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Gerencie suas automações existentes.
            </p>
          </div>

          <div className="divide-y">
            {automations.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-500">
                Nenhuma automação criada ainda.
              </div>
            ) : (
              automations.map((automation) => (
                <div
                  key={automation.id}
                  className="flex flex-col gap-4 px-6 py-5 md:flex-row md:items-center md:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">
                        {automation.name}
                      </h3>

                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          automation.is_active &&
                          automation.active
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {automation.is_active &&
                        automation.active
                          ? "Ativa"
                          : "Inativa"}
                      </span>
                    </div>

                    <div className="mt-2 text-sm text-gray-500">
                      Palavra-chave:{" "}
                      <span className="font-medium text-gray-700">
                        {automation.keywords?.join(", ") ||
                          "—"}
                      </span>
                    </div>

                    <div className="mt-1 truncate text-sm text-gray-500">
                      Resposta:{" "}
                      {automation.static_reply ||
                        "Nenhuma resposta configurada."}
                    </div>
                  </div>

                  <button
                    onClick={() =>
                      startEditing(automation)
                    }
                    className="shrink-0 rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-gray-50"
                  >
                    Editar
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        {/* RECENT ACTIVITY */}
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

                return (
                  <div
                    key={event.id}
                    className="flex items-center justify-between gap-4 px-6 py-4"
                  >
                    <div>
                      <div className="font-medium">
                        {value?.from?.username
                          ? `@${value.from.username}`
                          : "Usuário do Instagram"}
                      </div>

                      <div className="text-sm text-gray-500">
                        {value?.text ||
                          "Evento recebido"}
                      </div>
                    </div>

                    <div className="text-right">
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