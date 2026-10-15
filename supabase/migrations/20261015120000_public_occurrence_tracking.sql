-- Citizen-safe status tracking through a high-entropy QR capability token.
alter table public.ocorrencias
  add column if not exists public_tracking_token_hash text;

create index if not exists ocorrencias_public_tracking_token_hash_idx
  on public.ocorrencias (public_tracking_token_hash)
  where public_tracking_token_hash is not null;

comment on column public.ocorrencias.public_tracking_token_hash is
  'SHA-256 hash of a random, single-occurrence public tracking token. Never expose this hash through the public API.';
