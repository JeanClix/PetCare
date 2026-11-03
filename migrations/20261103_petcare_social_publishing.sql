-- Cuentas Meta conectadas, publicaciones del panel y medios servidos para la API de Instagram.
-- Idempotente: la función admin crea las mismas tablas al atender su primera solicitud.
BEGIN;

CREATE TABLE IF NOT EXISTS public.petcare_social_connections (
  id TEXT PRIMARY KEY,
  facebook_page_id TEXT NOT NULL,
  facebook_page_name TEXT NOT NULL,
  instagram_account_id TEXT,
  instagram_username TEXT NOT NULL DEFAULT '',
  encrypted_page_access_token TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.petcare_social_oauth_states (
  state_hash TEXT PRIMARY KEY,
  admin_id TEXT NOT NULL,
  encrypted_user_access_token TEXT,
  pages JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS public.petcare_social_media (
  id UUID PRIMARY KEY,
  mime_type TEXT NOT NULL CHECK (mime_type = 'image/jpeg'),
  data_base64 TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.petcare_social_posts (
  id UUID PRIMARY KEY,
  platform TEXT NOT NULL CHECK (platform IN ('facebook', 'instagram')),
  caption TEXT NOT NULL,
  media_id UUID NOT NULL REFERENCES public.petcare_social_media(id),
  provider_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('published', 'failed')),
  error TEXT NOT NULL DEFAULT '',
  created_by_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS petcare_social_posts_created_idx ON public.petcare_social_posts (created_at DESC);

COMMIT;
