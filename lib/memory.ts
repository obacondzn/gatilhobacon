import "server-only";

import { supabaseAdmin } from "@/lib/supabase-admin";
import type { AIContext, AIContextMessage } from "@/lib/ai/gemini";

/**
 * ============================================================
 * MEMÓRIA: contatos, conversas e mensagens
 * ============================================================
 *
 * Regra: só armazenamos o que realmente aconteceu. A IA nunca
 * recebe nada além do que está persistido aqui.
 */

export type ContactRow = {
  id: string;
  instagram_user_id: string;
  username: string | null;
  interaction_count: number;
  conversation_count: number;
  recurring: boolean;
  classification: string;
  interests: string[];
  topics: string[];
};

export type ConversationRow = {
  id: string;
  contact_id: string;
  message_count: number;
};

/**
 * Busca ou cria o contato (pessoa do Instagram) e aplica a lógica
 * de recorrência da especificação:
 *
 *   1ª interação  -> interaction_count = 1, recurring = false
 *   2ª interação+ -> interaction_count += 1, recurring = true
 */
export async function getOrCreateContact(params: {
  instagramUserId: string;
  username?: string | null;
}): Promise<ContactRow> {
  const { instagramUserId, username } = params;

  const { data: existing, error: findError } = await supabaseAdmin
    .from("contacts")
    .select(
      "id, instagram_user_id, username, interaction_count, conversation_count, recurring, classification, interests, topics"
    )
    .eq("instagram_user_id", instagramUserId)
    .maybeSingle();

  if (findError) {
    throw findError;
  }

  if (!existing) {
    const { data: created, error: insertError } = await supabaseAdmin
      .from("contacts")
      .insert({
        instagram_user_id: instagramUserId,
        username: username ?? null,
        interaction_count: 1,
        conversation_count: 0,
        recurring: false,
        classification: "novo",
      })
      .select(
        "id, instagram_user_id, username, interaction_count, conversation_count, recurring, classification, interests, topics"
      )
      .single();

    if (insertError) {
      throw insertError;
    }

    return created as ContactRow;
  }

  const newInteractionCount = existing.interaction_count + 1;

  const { data: updated, error: updateError } = await supabaseAdmin
    .from("contacts")
    .update({
      username: username ?? existing.username,
      last_interaction_at: new Date().toISOString(),
      interaction_count: newInteractionCount,
      // Nunca marcar a primeira interação como recorrente.
      recurring: newInteractionCount >= 2,
      updated_at: new Date().toISOString(),
    })
    .eq("id", existing.id)
    .select(
      "id, instagram_user_id, username, interaction_count, conversation_count, recurring, classification, interests, topics"
    )
    .single();

  if (updateError) {
    throw updateError;
  }

  return updated as ContactRow;
}

/**
 * Busca a conversa em aberto do contato com esta conta profissional,
 * ou cria uma nova. Uma conversa representa Instagram <-> Pessoa.
 */
export async function getOrCreateConversation(params: {
  contactId: string;
  instagramAccountId?: string | null;
  sourceContentId?: string | null;
}): Promise<ConversationRow> {
  const { contactId, instagramAccountId, sourceContentId } = params;

  const { data: existing, error: findError } = await supabaseAdmin
    .from("conversations")
    .select("id, contact_id, message_count")
    .eq("contact_id", contactId)
    .eq("status", "open")
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (findError) {
    throw findError;
  }

  if (existing) {
    return existing as ConversationRow;
  }

  const { data: created, error: insertError } = await supabaseAdmin
    .from("conversations")
    .insert({
      contact_id: contactId,
      instagram_account_id: instagramAccountId ?? null,
      source_content_id: sourceContentId ?? null,
      status: "open",
      message_count: 0,
    })
    .select("id, contact_id, message_count")
    .single();

  if (insertError) {
    throw insertError;
  }

  // Nova conversa real -> incrementa conversation_count da pessoa.
  const { error: incrementError } = await supabaseAdmin.rpc(
    "increment_contact_conversation_count",
    { p_contact_id: contactId }
  );

  // A função RPC é opcional (criada por conveniência). Se não existir
  // no banco ainda, fazemos um fallback não-atômico em vez de falhar
  // o fluxo inteiro por causa de uma métrica.
  if (incrementError) {
    console.error(
      "increment_contact_conversation_count indisponível:",
      incrementError.message
    );

    await supabaseAdmin
      .from("contacts")
      .update({ conversation_count: 1 })
      .eq("id", contactId)
      .is("conversation_count", 0);
  }

  return created as ConversationRow;
}

/**
 * Registra uma mensagem (inbound ou outbound) na conversa.
 * Deduplica por message_id quando disponível — não falha o fluxo
 * se a mensagem já tiver sido registrada antes (idempotente).
 */
export async function recordMessage(params: {
  conversationId: string;
  contactId: string;
  direction: "inbound" | "outbound";
  messageId?: string | null;
  text: string;
  source: string;
  metadata?: Record<string, unknown>;
}) {
  const { conversationId, contactId, direction, messageId, text, source, metadata } =
    params;

  if (!text) {
    return;
  }

  const { error } = await supabaseAdmin.from("conversation_messages").insert({
    conversation_id: conversationId,
    contact_id: contactId,
    direction,
    message_id: messageId ?? null,
    text,
    source,
    metadata: metadata ?? {},
  });

  // 23505 = unique_violation (mensagem já registrada) -> ignorar,
  // idempotente por design (retries do processor não duplicam).
  if (error && (error as { code?: string }).code !== "23505") {
    throw error;
  }

  if (!error) {
    const { error: rpcError } = await supabaseAdmin.rpc(
      "increment_conversation_message_count",
      { p_conversation_id: conversationId }
    );

    // Fallback não-atômico apenas se a função SQL ainda não existir
    // neste ambiente (migration não aplicada) — não deve travar o envio.
    if (rpcError) {
      console.error(
        "increment_conversation_message_count indisponível:",
        rpcError.message
      );

      await supabaseAdmin
        .from("conversations")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", conversationId);
    }
  }
}

/**
 * Monta o histórico real (só o que está armazenado) para dar contexto
 * à IA, sem inventar nada.
 */
export async function getConversationHistory(
  conversationId: string,
  limit = 12
): Promise<AIContextMessage[]> {
  const { data, error } = await supabaseAdmin
    .from("conversation_messages")
    .select("direction, text, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? [])
    .reverse()
    .map((row) => ({
      direction: row.direction as "inbound" | "outbound",
      text: row.text as string,
    }));
}

export async function getAIConfig(): Promise<AIContext["aiConfig"]> {
  const { data, error } = await supabaseAdmin
    .from("ai_config")
    .select("tone, personality, instructions")
    .eq("id", true)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return {
    tone: data?.tone ?? "Informal",
    personality: data?.personality ?? "Criativo, descontraído e brasileiro.",
    instructions: data?.instructions ?? "Fale como eu falaria.",
  };
}

/**
 * Atualiza classificação/interesses/assuntos do contato com base no
 * que a IA observou nesta interação — nunca inventa, só registra o
 * que a própria IA identificou na mensagem real.
 */
export async function applyAIObservations(
  contactId: string,
  observations: { classification?: string; topic?: string }
) {
  const updates: Record<string, unknown> = {};

  if (observations.classification) {
    updates.classification = observations.classification;
  }

  if (Object.keys(updates).length === 0) {
    return;
  }

  updates.updated_at = new Date().toISOString();

  await supabaseAdmin.from("contacts").update(updates).eq("id", contactId);

  if (observations.topic) {
    await supabaseAdmin.rpc("append_contact_topic", {
      p_contact_id: contactId,
      p_topic: observations.topic,
    });
  }
}
