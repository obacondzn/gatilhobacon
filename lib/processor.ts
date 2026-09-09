import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  INSTAGRAM_GRAPH_URL,
  INSTAGRAM_GRAPH_VERSION,
} from "@/lib/instagram/config";

type InstagramCommentEvent = {
  entry?: Array<{
    id?: string;
    changes?: Array<{
      field?: string;
      value?: {
        id?: string;
        from?: {
          id?: string;
          username?: string;
        };
        text?: string;
        media?: {
          id?: string;
          media_product_type?: string;
        };
      };
    }>;
  }>;
};

type Automation = {
  id: string;
  name: string;
  keywords: string[];
  match_mode: string;
  static_reply: string | null;
  is_active: boolean;
  active: boolean;
};

async function replyToComment(commentId: string, message: string) {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;

  if (!token) {
    return {
      sent: false,
      reason: "INSTAGRAM_ACCESS_TOKEN não configurado",
    };
  }

  const url = `${INSTAGRAM_GRAPH_URL}/${INSTAGRAM_GRAPH_VERSION}/${commentId}/replies`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message,
      access_token: token,
    }),
    cache: "no-store",
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    return {
      sent: false,
      reason:
        data?.error?.message ||
        "Erro ao responder no Instagram",
      data,
    };
  }

  return {
    sent: true,
    data,
  };
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase();
}

function matchesKeyword(
  text: string,
  keywords: string[],
  matchMode: string
) {
  const normalizedText = normalize(text);

  return keywords.some((keyword) => {
    const normalizedKeyword = normalize(keyword);

    if (!normalizedKeyword) return false;

    switch (matchMode) {
      case "exact":
        return normalizedText === normalizedKeyword;

      case "starts_with":
        return normalizedText.startsWith(normalizedKeyword);

      case "ends_with":
        return normalizedText.endsWith(normalizedKeyword);

      case "contains":
      default:
        return normalizedText.includes(normalizedKeyword);
    }
  });
}

export async function processPendingEvents(limit = 10) {
  const { data: automations, error: automationError } =
    await supabaseAdmin
      .from("automations")
      .select(
        `
        id,
        name,
        keywords,
        match_mode,
        static_reply,
        is_active,
        active
      `
      )
      .eq("active", true);

  if (automationError) {
    throw automationError;
  }

  const { data: events, error: eventError } =
    await supabaseAdmin
      .from("events")
      .select(
        "id, payload, processed, created_at"
      )
      .eq("source", "instagram")
      .eq("processed", false)
      .order("created_at", { ascending: true })
      .limit(limit);

  if (eventError) {
    throw eventError;
  }

  const results: Record<string, unknown>[] = [];

  for (const event of events ?? []) {
    const payload = event.payload as InstagramCommentEvent;

    const comments = (payload.entry ?? []).flatMap(
      (entry) =>
        (entry.changes ?? [])
          .filter(
            (change) =>
              change.field === "comments" &&
              !!change.value?.text
          )
          .map((change) => ({
            commentId: change.value?.id,
            username: change.value?.from?.username,
            text: change.value?.text || "",
          }))
    );

    let processed = true;

    let result: Record<string, unknown> = {
      status: "ignored",
    };

    for (const comment of comments) {
      const automation = (
        (automations ?? []) as Automation[]
      ).find((automation) => {
        if (!automation.is_active && !automation.active) {
          return false;
        }

        return matchesKeyword(
          comment.text,
          automation.keywords ?? [],
          automation.match_mode ?? "contains"
        );
      });

      if (!automation) {
        result = {
          status: "no_match",
          comment: comment.text,
        };

        continue;
      }

      if (!comment.commentId) {
        processed = false;

        result = {
          status: "matched_pending",
          reason: "comment_id ausente",
          comment: comment.text,
          username: comment.username,
          automationId: automation.id,
        };

        continue;
      }

      const message = automation.static_reply?.trim();

      if (!message) {
        processed = false;

        result = {
          status: "matched_pending",
          reason: "static_reply não configurado",
          comment: comment.text,
          username: comment.username,
          automationId: automation.id,
        };

        continue;
      }

      const reply = await replyToComment(
        comment.commentId,
        message
      );

      result = {
        status: reply.sent
          ? "replied"
          : "matched_pending",

        automationId: automation.id,
        automationName: automation.name,

        keywords: automation.keywords,
        matchMode: automation.match_mode,

        comment: comment.text,
        username: comment.username,
        commentId: comment.commentId,

        reply,
      };

      if (!reply.sent) {
        processed = false;
      }
    }

    const { error: updateError } =
      await supabaseAdmin
        .from("events")
        .update({
          processed,
          processing_result: result,
          processed_at: processed
            ? new Date().toISOString()
            : null,
        })
        .eq("id", event.id);

    if (updateError) {
      throw updateError;
    }

    results.push({
      id: event.id,
      ...result,
      processed,
    });
  }

  return results;
}