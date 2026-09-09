-- ============================================================
-- Migration: memória de conversas, contatos e configuração da IA
-- ============================================================
-- Idempotente: seguro para rodar mais de uma vez.
-- NÃO apaga dados existentes. Usa IF NOT EXISTS em tudo.
-- Execute no SQL Editor do Supabase.

-- ------------------------------------------------------------
-- 1. CONTACTS (pessoa do Instagram)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  instagram_user_id text NOT NULL,
  username text,
  name text,
  avatar_url text,

  first_interaction_at timestamptz NOT NULL DEFAULT now(),
  last_interaction_at timestamptz NOT NULL DEFAULT now(),

  interaction_count integer NOT NULL DEFAULT 0,
  conversation_count integer NOT NULL DEFAULT 0,
  recurring boolean NOT NULL DEFAULT false,

  -- novo | curioso | recorrente | engajado | fã | criador |
  -- potencial_cliente | cliente | suporte | spam
  classification text NOT NULL DEFAULT 'novo',

  interests text[] NOT NULL DEFAULT '{}',
  topics text[] NOT NULL DEFAULT '{}',

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS contacts_instagram_user_id_idx
  ON public.contacts (instagram_user_id);

CREATE INDEX IF NOT EXISTS contacts_recurring_idx
  ON public.contacts (recurring, last_interaction_at DESC);

-- ------------------------------------------------------------
-- 2. CONVERSATIONS (Instagram <-> Pessoa)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  contact_id uuid NOT NULL REFERENCES public.contacts (id) ON DELETE CASCADE,

  -- ID da conta profissional do Instagram que recebeu a interação
  instagram_account_id text,

  -- media/content que iniciou a conversa, quando aplicável
  source_content_id text,

  status text NOT NULL DEFAULT 'open',

  message_count integer NOT NULL DEFAULT 0,

  started_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz NOT NULL DEFAULT now(),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS conversations_contact_idx
  ON public.conversations (contact_id, instagram_account_id);

-- ------------------------------------------------------------
-- 3. CONVERSATION_MESSAGES
-- ------------------------------------------------------------
-- Se a tabela já existir no projeto (conforme a especificação
-- indica que pode existir), este bloco só garante as colunas
-- necessárias, sem apagar nada.
CREATE TABLE IF NOT EXISTS public.conversation_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid,
  contact_id uuid,
  direction text,
  message_id text,
  text text,
  source text,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.conversation_messages
  ADD COLUMN IF NOT EXISTS conversation_id uuid,
  ADD COLUMN IF NOT EXISTS contact_id uuid,
  ADD COLUMN IF NOT EXISTS direction text,
  ADD COLUMN IF NOT EXISTS message_id text,
  ADD COLUMN IF NOT EXISTS text text,
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- FKs só são adicionadas se ainda não existirem (evita erro em reexecução)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'conversation_messages_conversation_id_fkey'
  ) THEN
    ALTER TABLE public.conversation_messages
      ADD CONSTRAINT conversation_messages_conversation_id_fkey
      FOREIGN KEY (conversation_id) REFERENCES public.conversations (id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'conversation_messages_contact_id_fkey'
  ) THEN
    ALTER TABLE public.conversation_messages
      ADD CONSTRAINT conversation_messages_contact_id_fkey
      FOREIGN KEY (contact_id) REFERENCES public.contacts (id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS conversation_messages_conversation_idx
  ON public.conversation_messages (conversation_id, created_at);

-- Evita gravar o mesmo evento do Instagram duas vezes na memória.
-- message_id nulo não é considerado duplicado (índice parcial).
CREATE UNIQUE INDEX IF NOT EXISTS conversation_messages_message_id_idx
  ON public.conversation_messages (message_id)
  WHERE message_id IS NOT NULL;

-- ------------------------------------------------------------
-- 4. AI_CONFIG (tom, personalidade, instruções — linha única)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_config (
  id boolean PRIMARY KEY DEFAULT true,
  tone text NOT NULL DEFAULT 'Informal',
  personality text NOT NULL DEFAULT 'Criativo, descontraído e brasileiro.',
  instructions text NOT NULL DEFAULT 'Fale como eu falaria.',
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT ai_config_single_row CHECK (id)
);

INSERT INTO public.ai_config (id)
SELECT true
WHERE NOT EXISTS (SELECT 1 FROM public.ai_config);

-- ------------------------------------------------------------
-- 5. FUNÇÕES ATÔMICAS (seguras para serverless/múltiplas instâncias)
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.increment_contact_conversation_count(
  p_contact_id uuid
) RETURNS void
LANGUAGE sql
AS $$
  UPDATE public.contacts
  SET conversation_count = conversation_count + 1,
      updated_at = now()
  WHERE id = p_contact_id;
$$;

CREATE OR REPLACE FUNCTION public.increment_conversation_message_count(
  p_conversation_id uuid
) RETURNS void
LANGUAGE sql
AS $$
  UPDATE public.conversations
  SET message_count = message_count + 1,
      last_message_at = now(),
      updated_at = now()
  WHERE id = p_conversation_id;
$$;

CREATE OR REPLACE FUNCTION public.append_contact_topic(
  p_contact_id uuid,
  p_topic text
) RETURNS void
LANGUAGE sql
AS $$
  UPDATE public.contacts
  SET topics = CASE
        WHEN p_topic IS NULL OR p_topic = '' THEN topics
        WHEN topics @> ARRAY[p_topic] THEN topics
        ELSE array_append(topics, p_topic)
      END,
      updated_at = now()
  WHERE id = p_contact_id;
$$;

-- ------------------------------------------------------------
-- 6. AUTOMATIONS: garante colunas de IA (idempotente)
-- ------------------------------------------------------------
-- O código já seleciona estas colunas; este bloco só garante que
-- elas existam caso este ambiente específico ainda não as tenha.
ALTER TABLE public.automations
  ADD COLUMN IF NOT EXISTS ai_mode boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_system_prompt text;
