import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  INSTAGRAM_GRAPH_URL,
  INSTAGRAM_GRAPH_VERSION,
} from "@/lib/instagram/config";
import { generateAIReply, type AIContext } from "@/lib/ai/gemini";
import {
  applyAIObservations,
  getAIConfig,
  getConversationHistory,
  getOrCreateContact,
  getOrCreateConversation,
  recordMessage,
} from "@/lib/memory";

type InstagramCommentEvent = {
  entry?: Array<{
    id?: string;
    time?: number;
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
  dm_enabled: boolean;
  dm_reply: string | null;
  ai_mode: boolean;
  ai_system_prompt: string | null;
};

type CommentData = {
  commentId?: string;
  username?: string;
  userId?: string;
  instagramUserId?: string;
  mediaId?: string;
  text: string;
};

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

    if (!normalizedKeyword) {
      return false;
    }

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

/**
 * ============================================================
 * RESPOSTA PÚBLICA AO COMENTÁRIO
 * ============================================================
 *
 * POST /{comment-id}/replies
 */
async function replyToComment(
  commentId: string,
  message: string
) {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;

  if (!token) {
    return {
      sent: false,
      reason: "INSTAGRAM_ACCESS_TOKEN não configurado",
    };
  }

  const url =
    `${INSTAGRAM_GRAPH_URL}/` +
    `${INSTAGRAM_GRAPH_VERSION}/` +
    `${commentId}/replies`;

  try {
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
          "Erro ao responder publicamente ao comentário",
        data,
      };
    }

    return {
      sent: true,
      data,
    };
  } catch (error) {
    return {
      sent: false,
      reason:
        error instanceof Error
          ? error.message
          : "Erro de conexão ao responder comentário",
    };
  }
}

/**
 * ============================================================
 * PRIVATE REPLY / DM
 * ============================================================
 *
 * IMPORTANTE:
 *
 * Para Instagram Login, a Private Reply NÃO usa:
 *
 *   /{comment-id}/private_replies
 *
 * Ela usa:
 *
 *   POST /{IG_USER_ID}/messages
 *
 * com:
 *
 * {
 *   recipient: {
 *     comment_id: "ID_DO_COMENTARIO"
 *   },
 *   message: {
 *     text: "..."
 *   }
 * }
 *
 * O ID do comentário continua sendo o destinatário lógico.
 * O IG_USER_ID é o ID da conta profissional que recebeu
 * o comentário.
 */
async function sendPrivateReply(
  instagramUserId: string,
  commentId: string,
  message: string
) {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;

  if (!token) {
    return {
      sent: false,
      reason: "INSTAGRAM_ACCESS_TOKEN não configurado",
    };
  }

  if (!instagramUserId) {
    return {
      sent: false,
      reason:
        "Instagram User ID não encontrado no webhook.",
    };
  }

  if (!commentId) {
    return {
      sent: false,
      reason: "ID do comentário não encontrado.",
    };
  }

  const url =
    `${INSTAGRAM_GRAPH_URL}/` +
    `${INSTAGRAM_GRAPH_VERSION}/` +
    `${instagramUserId}/messages`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        recipient: {
          comment_id: commentId,
        },
        message: {
          text: message,
        },
      }),
      cache: "no-store",
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        sent: false,
        reason:
          data?.error?.message ||
          "Erro ao enviar Private Reply",
        data,
      };
    }

    return {
      sent: true,
      data,
    };
  } catch (error) {
    return {
      sent: false,
      reason:
        error instanceof Error
          ? error.message
          : "Erro de conexão ao enviar Private Reply",
    };
  }
}

/**
 * ============================================================
 * EXTRAI TODOS OS COMENTÁRIOS DO WEBHOOK
 * ============================================================
 */
function extractComments(
  payload: InstagramCommentEvent
): CommentData[] {
  const comments: CommentData[] = [];

  for (const entry of payload.entry ?? []) {
    const instagramUserId = entry.id;

    for (const change of entry.changes ?? []) {
      if (change.field !== "comments") {
        continue;
      }

      const value = change.value;

      if (!value?.text) {
        continue;
      }

      comments.push({
        commentId: value.id,
        username: value.from?.username,
        userId: value.from?.id,
        instagramUserId,
        mediaId: value.media?.id,
        text: value.text,
      });
    }
  }

  return comments;
}

/**
 * ============================================================
 * PROCESSAMENTO PRINCIPAL
 * ============================================================
 */
export async function processPendingEvents(limit = 10) {
  /**
   * ----------------------------------------------------------
   * 1. BUSCA AUTOMAÇÕES ATIVAS
   * ----------------------------------------------------------
   */
  const {
    data: automations,
    error: automationError,
  } = await supabaseAdmin
    .from("automations")
    .select(`
      id,
      name,
      keywords,
      match_mode,
      static_reply,
      is_active,
      active,
      dm_enabled,
      dm_reply,
      ai_mode,
      ai_system_prompt
    `)
    .eq("active", true);

  if (automationError) {
    throw automationError;
  }

  /**
   * ----------------------------------------------------------
   * 2. BUSCA EVENTOS PENDENTES
   * ----------------------------------------------------------
   */
  const {
    data: events,
    error: eventError,
  } = await supabaseAdmin
    .from("events")
    .select(`
      id,
      payload,
      processed,
      processing_result,
      created_at
    `)
    .eq("source", "instagram")
    .eq("processed", false)
    .order("created_at", {
      ascending: true,
    })
    .limit(limit);

  if (eventError) {
    throw eventError;
  }

  const results: Record<string, unknown>[] = [];

  /**
   * ----------------------------------------------------------
   * 3. PROCESSA CADA EVENTO
   * ----------------------------------------------------------
   */
  for (const event of events ?? []) {
    const payload =
      event.payload as InstagramCommentEvent;

    const comments = extractComments(payload);

    /**
     * Se não existem comentários nesse evento,
     * marcamos como processado.
     */
    if (comments.length === 0) {
      const result = {
        status: "ignored",
      };

      const { error: updateError } =
        await supabaseAdmin
          .from("events")
          .update({
            processed: true,
            processing_result: result,
            processed_at: new Date().toISOString(),
          })
          .eq("id", event.id);

      if (updateError) {
        throw updateError;
      }

      results.push({
        id: event.id,
        ...result,
        processed: true,
      });

      continue;
    }

    /**
     * --------------------------------------------------------
     * RECUPERA RESULTADO ANTERIOR
     * --------------------------------------------------------
     *
     * Isso permite:
     *
     * comentário público = enviado
     * DM = falhou
     *
     * Na próxima tentativa:
     *
     * NÃO responde o comentário novamente
     * TENTA somente a DM
     */
    const previousResult =
      event.processing_result as
        | {
            comments?: Array<{
              commentId?: string;

              comment_reply?: {
                sent?: boolean;
              };

              dm?: {
                sent?: boolean;
              };
            }>;
          }
        | null;

    const previousComments =
      previousResult?.comments ?? [];

    const commentResults: Record<string, unknown>[] = [];

    let eventProcessed = true;

    /**
     * --------------------------------------------------------
     * 4. PROCESSA TODOS OS COMENTÁRIOS
     * --------------------------------------------------------
     */
    for (const comment of comments) {
      /**
       * ------------------------------------------------------
       * ENCONTRA AUTOMAÇÃO
       * ------------------------------------------------------
       */
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

      /**
       * Nenhuma automação encontrada.
       */
      if (!automation) {
        commentResults.push({
          status: "no_match",
          comment: comment.text,
          username: comment.username,
          userId: comment.userId,
          commentId: comment.commentId,
        });

        continue;
      }

      /**
       * ------------------------------------------------------
       * PRECISA DO ID DO COMENTÁRIO
       * ------------------------------------------------------
       */
      if (!comment.commentId) {
        eventProcessed = false;

        commentResults.push({
          status: "matched_pending",
          reason: "comment_id ausente",
          comment: comment.text,
          username: comment.username,
          userId: comment.userId,
          automationId: automation.id,
        });

        continue;
      }

      /**
       * ------------------------------------------------------
       * PRECISA DO ID DA CONTA PROFISSIONAL
       * ------------------------------------------------------
       */
      if (!comment.instagramUserId) {
        eventProcessed = false;

        commentResults.push({
          status: "matched_pending",
          reason:
            "Instagram User ID ausente no payload do webhook.",
          comment: comment.text,
          username: comment.username,
          userId: comment.userId,
          commentId: comment.commentId,
          automationId: automation.id,
        });

        continue;
      }

      /**
       * ------------------------------------------------------
       * LOCALIZA TENTATIVA ANTERIOR
       * ------------------------------------------------------
       */
      const previousComment =
        previousComments.find(
          (item) =>
            item.commentId === comment.commentId
        );

      /**
       * ------------------------------------------------------
       * MEMÓRIA: contato + conversa
       * ------------------------------------------------------
       *
       * Registrado independente de ser automação com IA ou
       * static_reply, para que o histórico exista de verdade
       * caso a automação seja migrada para IA no futuro.
       *
       * Uma falha aqui NUNCA deve derrubar o fluxo de resposta
       * já existente — só a memória fica indisponível.
       */
      let contact: Awaited<
        ReturnType<typeof getOrCreateContact>
      > | null = null;

      let conversation: Awaited<
        ReturnType<typeof getOrCreateConversation>
      > | null = null;

      if (comment.userId) {
        try {
          contact = await getOrCreateContact({
            instagramUserId: comment.userId,
            username: comment.username,
          });

          conversation = await getOrCreateConversation({
            contactId: contact.id,
            instagramAccountId: comment.instagramUserId,
            sourceContentId: comment.mediaId,
          });

          await recordMessage({
            conversationId: conversation.id,
            contactId: contact.id,
            direction: "inbound",
            messageId: comment.commentId,
            text: comment.text,
            source: "comment",
          });
        } catch (memoryError) {
          console.error(
            "Falha ao registrar memória do contato:",
            memoryError
          );

          contact = null;
          conversation = null;
        }
      }

      /**
       * ======================================================
       * 5. RESPOSTA PÚBLICA
       * ======================================================
       */
      let commentReply: Record<string, unknown>;

      const previousPublicReplySent =
        previousComment?.comment_reply?.sent === true;

      if (previousPublicReplySent) {
        /**
         * Já enviamos anteriormente.
         *
         * Não envia novamente.
         */
        commentReply = {
          sent: true,
          skipped: true,
          reason:
            "Resposta pública já enviada anteriormente.",
        };
      } else {
        /**
         * ----------------------------------------------------
         * DETERMINA A MENSAGEM: IA (quando ai_mode) ou
         * static_reply (fallback / automações sem IA).
         * ----------------------------------------------------
         */
        let publicMessage = automation.static_reply?.trim();
        let aiFailureReason: string | null = null;

        if (automation.ai_mode === true) {
          if (!contact || !conversation) {
            aiFailureReason =
              "Memória indisponível para gerar contexto da IA.";
          } else {
            try {
              const [history, aiConfig] = await Promise.all([
                getConversationHistory(conversation.id),
                getAIConfig(),
              ]);

              const context: AIContext = {
                currentMessage: comment.text,
                originalComment: comment.text,
                contentTitle: null,
                contentTheme: null,
                username: comment.username ?? null,
                history,
                contact: {
                  classification: contact.classification,
                  interactionCount: contact.interaction_count,
                  recurring: contact.recurring,
                  interests: contact.interests,
                  topics: contact.topics,
                },
                aiConfig,
                automationSystemPrompt:
                  automation.ai_system_prompt,
              };

              const aiResult = await generateAIReply(context);

              if (!aiResult.ok) {
                aiFailureReason = aiResult.reason;
              } else {
                // Registra o que a IA observou (classificação/assunto),
                // mesmo quando ela decide não responder.
                await applyAIObservations(contact.id, {
                  classification: aiResult.decision.classification,
                  topic: aiResult.decision.topic,
                });

                if (aiResult.decision.should_reply === false) {
                  /**
                   * A conversa terminou naturalmente ou não há
                   * motivo para responder. Isso é uma conclusão
                   * válida, não um erro — não cai no fallback
                   * static_reply e não tenta a DM.
                   */
                  commentResults.push({
                    status: "ai_skipped",
                    automationId: automation.id,
                    automationName: automation.name,
                    comment: comment.text,
                    username: comment.username,
                    userId: comment.userId,
                    commentId: comment.commentId,
                    ai: {
                      should_reply: false,
                      reason: aiResult.decision.reason ?? null,
                    },
                  });

                  continue;
                }

                publicMessage = aiResult.decision.response.trim();
              }
            } catch (aiError) {
              aiFailureReason =
                aiError instanceof Error
                  ? aiError.message
                  : "Erro inesperado ao gerar resposta com IA";
            }
          }

          // Falha técnica da IA -> cai no static_reply como fallback
          // (seção 7 da especificação). Se também não houver
          // static_reply, fica pendente para nova tentativa.
          if (aiFailureReason && !publicMessage) {
            eventProcessed = false;

            commentResults.push({
              status: "matched_pending",
              reason: `IA indisponível (${aiFailureReason}) e static_reply não configurado`,
              automationId: automation.id,
              automationName: automation.name,
              comment: comment.text,
              username: comment.username,
              userId: comment.userId,
              commentId: comment.commentId,
            });

            continue;
          }
        }

        if (!publicMessage) {
          eventProcessed = false;

          commentResults.push({
            status: "matched_pending",
            reason:
              "static_reply não configurado",
            automationId: automation.id,
            automationName: automation.name,
            comment: comment.text,
            username: comment.username,
            userId: comment.userId,
            commentId: comment.commentId,
          });

          continue;
        }

        commentReply =
          await replyToComment(
            comment.commentId,
            publicMessage
          );

        /**
         * Se a resposta pública falhou,
         * não tentamos a DM.
         */
        if (!commentReply.sent) {
          eventProcessed = false;

          commentResults.push({
            status: "comment_reply_pending",

            automationId: automation.id,
            automationName: automation.name,

            keywords: automation.keywords,
            matchMode: automation.match_mode,

            comment: comment.text,
            username: comment.username,
            userId: comment.userId,
            commentId: comment.commentId,

            comment_reply: commentReply,

            dm: {
              enabled:
                automation.dm_enabled === true,
              sent: false,
              reason:
                "DM não enviada porque a resposta pública falhou.",
            },
          });

          continue;
        }

        if (contact && conversation) {
          try {
            await recordMessage({
              conversationId: conversation.id,
              contactId: contact.id,
              direction: "outbound",
              text: publicMessage,
              source: "comment_reply",
            });
          } catch (memoryError) {
            console.error(
              "Falha ao registrar resposta pública na memória:",
              memoryError
            );
          }
        }
      }

      /**
       * ======================================================
       * 6. PRIVATE REPLY / DM
       * ======================================================
       */
      let dmResult: Record<string, unknown> = {
        enabled: false,
        sent: false,
      };

      if (automation.dm_enabled === true) {
        const dmMessage =
          automation.dm_reply?.trim();

        /**
         * DM ativada mas sem texto.
         */
        if (!dmMessage) {
          eventProcessed = false;

          dmResult = {
            enabled: true,
            sent: false,
            reason:
              "Mensagem da DM não configurada.",
          };
        } else {
          /**
           * Verifica se a DM já foi enviada.
           */
          const previousDmSent =
            previousComment?.dm?.sent === true;

          if (previousDmSent) {
            dmResult = {
              enabled: true,
              sent: true,
              skipped: true,
              reason:
                "Private Reply já enviado anteriormente.",
            };
          } else {
            /**
             * ------------------------------------------------
             * PRIVATE REPLY REAL
             * ------------------------------------------------
             *
             * IMPORTANTE:
             *
             * instagramUserId =
             * ID DA CONTA PROFISSIONAL
             *
             * commentId =
             * ID DO COMENTÁRIO
             *
             * Não usamos userId.
             */
            const privateReply =
              await sendPrivateReply(
                comment.instagramUserId,
                comment.commentId,
                dmMessage
              );

            dmResult = {
              enabled: true,
              ...privateReply,
            };

            if (!privateReply.sent) {
              eventProcessed = false;
            } else if (contact && conversation) {
              try {
                await recordMessage({
                  conversationId: conversation.id,
                  contactId: contact.id,
                  direction: "outbound",
                  text: dmMessage,
                  source: "dm",
                });
              } catch (memoryError) {
                console.error(
                  "Falha ao registrar DM na memória:",
                  memoryError
                );
              }
            }
          }
        }
      }

      /**
       * ======================================================
       * 7. RESULTADO FINAL DO COMENTÁRIO
       * ======================================================
       */
      const publicSent =
        commentReply.sent === true;

      const dmSent =
        automation.dm_enabled !== true ||
        dmResult.sent === true;

      if (!publicSent || !dmSent) {
        eventProcessed = false;
      }

      commentResults.push({
        status:
          publicSent && dmSent
            ? "completed"
            : publicSent
              ? "comment_replied_dm_pending"
              : "comment_reply_pending",

        automationId: automation.id,
        automationName: automation.name,

        keywords: automation.keywords,
        matchMode: automation.match_mode,

        comment: comment.text,
        username: comment.username,
        userId: comment.userId,

        /**
         * ID ORIGINAL DO COMENTÁRIO
         */
        commentId: comment.commentId,

        /**
         * ID DA CONTA PROFISSIONAL
         */
        instagramUserId:
          comment.instagramUserId,

        comment_reply: commentReply,

        dm: dmResult,
      });
    }

    /**
     * ========================================================
     * 8. SALVA RESULTADO NO SUPABASE
     * ========================================================
     */
    const result = {
      status: eventProcessed
        ? "completed"
        : "pending",

      comments: commentResults,
    };

    const { error: updateError } =
      await supabaseAdmin
        .from("events")
        .update({
          processed: eventProcessed,
          processing_result: result,
          processed_at: eventProcessed
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
      processed: eventProcessed,
    });
  }

  return results;
}