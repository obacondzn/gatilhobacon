-- Execute no SQL Editor do Supabase.
-- A tabela events já existe no projeto; estes campos tornam o processador observável.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS processing_result jsonb,
  ADD COLUMN IF NOT EXISTS processed_at timestamptz;

CREATE TABLE IF NOT EXISTS public.automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword text NOT NULL,
  response text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS events_unprocessed_idx
  ON public.events (source, processed, created_at);

INSERT INTO public.automations (keyword, response, active)
SELECT 'Efeito', 'Oi! Vi seu comentário 👋', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.automations WHERE lower(keyword) = lower('Efeito')
);
