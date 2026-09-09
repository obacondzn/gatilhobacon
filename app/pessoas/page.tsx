"use client";

import { useEffect, useMemo, useState } from "react";

type Contact = {
  id: string;
  instagram_user_id: string;
  username: string | null;
  name: string | null;
  avatar_url: string | null;
  first_interaction_at: string | null;
  last_interaction_at: string | null;
  interaction_count: number;
  conversation_count: number;
  recurring: boolean;
  classification: string;
  interests: string[];
  topics: string[];
};

type ContactsResponse = {
  ok: boolean;
  contacts: Contact[];
  page: number;
  pageSize: number;
  total: number;
  message?: string;
};

function formatDate(value: string | null) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function PessoasPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function loadContacts() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch("/api/contacts");
        const data: ContactsResponse = await response.json();

        if (!response.ok || !data.ok) {
          throw new Error(data.message || "Não foi possível carregar os contatos.");
        }

        setContacts(data.contacts ?? []);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Não foi possível carregar os contatos."
        );
      } finally {
        setLoading(false);
      }
    }

    loadContacts();
  }, []);

  const filteredContacts = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return contacts;

    return contacts.filter((contact) => {
      return (
        contact.username?.toLowerCase().includes(query) ||
        contact.name?.toLowerCase().includes(query) ||
        contact.classification?.toLowerCase().includes(query) ||
        contact.topics?.some((topic) =>
          topic.toLowerCase().includes(query)
        )
      );
    });
  }, [contacts, search]);

  const recurringCount = contacts.filter(
    (contact) => contact.recurring
  ).length;

  const newCount = contacts.filter(
    (contact) => !contact.recurring
  ).length;

  return (
    <main className="min-h-screen bg-paper text-ink">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <header className="mb-10 flex items-end justify-between gap-6">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-muted">
              Contact / Pessoas
            </p>

            <h1 className="text-3xl font-semibold tracking-tight">
              Pessoas
            </h1>

            <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
              Contatos que já interagiram com seu Instagram e o histórico
              básico de relacionamento identificado pelo sistema.
            </p>
          </div>

          <div className="rounded-full border border-line bg-white px-4 py-2 text-sm text-muted">
            {contacts.length} {contacts.length === 1 ? "pessoa" : "pessoas"}
          </div>
        </header>

        <section className="mb-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-line bg-white p-5">
            <p className="text-xs uppercase tracking-[0.14em] text-muted">
              Total
            </p>
            <p className="mt-3 text-3xl font-semibold">
              {contacts.length}
            </p>
          </div>

          <div className="rounded-2xl border border-line bg-white p-5">
            <p className="text-xs uppercase tracking-[0.14em] text-muted">
              Recorrentes
            </p>
            <p className="mt-3 text-3xl font-semibold">
              {recurringCount}
            </p>
          </div>

          <div className="rounded-2xl border border-line bg-white p-5">
            <p className="text-xs uppercase tracking-[0.14em] text-muted">
              Novos
            </p>
            <p className="mt-3 text-3xl font-semibold">
              {newCount}
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-line bg-white">
          <div className="flex flex-col gap-4 border-b border-line p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold">
                Todos os contatos
              </h2>

              <p className="mt-1 text-sm text-muted">
                Pessoas identificadas pelas interações do Instagram.
              </p>
            </div>

            <div className="w-full sm:w-72">
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar pessoa..."
                className="h-10 w-full rounded-xl border border-line bg-paper px-3 text-sm outline-none transition focus:border-ink"
              />
            </div>
          </div>

          {loading && (
            <div className="p-8 text-sm text-muted">
              Carregando pessoas...
            </div>
          )}

          {!loading && error && (
            <div className="p-8 text-sm text-red-600">
              {error}
            </div>
          )}

          {!loading && !error && filteredContacts.length === 0 && (
            <div className="p-8 text-sm text-muted">
              {search
                ? "Nenhuma pessoa encontrada."
                : "Ainda não existem pessoas registradas."}
            </div>
          )}

          {!loading && !error && filteredContacts.length > 0 && (
            <div className="divide-y divide-line">
              {filteredContacts.map((contact) => (
                <div
                  key={contact.id}
                  className="flex flex-col gap-5 p-5 transition hover:bg-paper/60 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-paper text-sm font-semibold">
                      {contact.avatar_url ? (
                        <img
                          src={contact.avatar_url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        (contact.username?.[0] ||
                          contact.name?.[0] ||
                          "?").toUpperCase()
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold">
                          {contact.name ||
                            (contact.username
                              ? `@${contact.username}`
                              : "Usuário do Instagram")}
                        </p>

                        {contact.recurring && (
                          <span className="rounded-full border border-line px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted">
                            Recorrente
                          </span>
                        )}
                      </div>

                      {contact.username && contact.name && (
                        <p className="mt-1 text-xs text-muted">
                          @{contact.username}
                        </p>
                      )}

                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                        <span>
                          {contact.interaction_count}{" "}
                          {contact.interaction_count === 1
                            ? "interação"
                            : "interações"}
                        </span>

                        <span>
                          {contact.conversation_count}{" "}
                          {contact.conversation_count === 1
                            ? "conversa"
                            : "conversas"}
                        </span>

                        <span>
                          {contact.classification || "sem classificação"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 sm:text-right">
                    <p className="text-xs uppercase tracking-[0.12em] text-muted">
                      Última interação
                    </p>

                    <p className="mt-1 text-sm">
                      {formatDate(contact.last_interaction_at)}
                    </p>

                    {contact.topics.length > 0 && (
                      <div className="mt-2 flex flex-wrap justify-start gap-1 sm:justify-end">
                        {contact.topics.slice(0, 3).map((topic) => (
                          <span
                            key={topic}
                            className="rounded-full bg-paper px-2 py-1 text-[10px] text-muted"
                          >
                            {topic}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}