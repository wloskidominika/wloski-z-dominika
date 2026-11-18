-- =====================================================================
--  IL SITO DENTRO L'APP (un solo accesso, senza GitHub)
--  Testi, foto, case, hotel, escursioni, servizi, galleria, contatti e
--  blog si salvano qui. Il sito li legge subito: niente pubblicazione.
--  Incolla tutto in Supabase → SQL Editor → Run (una volta sola).
-- =====================================================================
create table if not exists public.site_content (
  key        text primary key check (key in ('look','houses','hotels','excursions','services','gallery','lessons','settings','texts')),
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create table if not exists public.site_posts (
  slug       text primary key check (slug ~ '^[a-z0-9][a-z0-9-]{0,90}$'),
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
-- impostazioni private dell'app (es. collegamento «aggiorna Google»)
create table if not exists public.app_settings (
  key   text primary key,
  value text
);
alter table public.site_content enable row level security;
alter table public.site_posts   enable row level security;
alter table public.app_settings enable row level security;
grant select on public.site_content, public.site_posts to anon, authenticated;
grant insert, update, delete on public.site_content, public.site_posts to authenticated;
grant select, insert, update, delete on public.app_settings to authenticated;
drop policy if exists "sito: leggi"      on public.site_content;
drop policy if exists "sito: gestisci"   on public.site_content;
drop policy if exists "articoli: leggi"  on public.site_posts;
drop policy if exists "articoli: gestisci" on public.site_posts;
drop policy if exists "impostazioni: gestisci" on public.app_settings;
create policy "sito: leggi" on public.site_content for select to anon, authenticated using (true);
create policy "sito: gestisci" on public.site_content for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "articoli: leggi" on public.site_posts for select to anon, authenticated
  using (coalesce((data->>'draft')::text, 'false') not in ('true','True') or public.is_admin());
create policy "articoli: gestisci" on public.site_posts for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "impostazioni: gestisci" on public.app_settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- foto del sito (pubbliche: le vede chiunque visita il sito)
insert into storage.buckets (id, name, public) values ('site', 'site', true)
  on conflict (id) do update set public = true;
drop policy if exists "foto sito: gestisci" on storage.objects;
create policy "foto sito: gestisci" on storage.objects for all to authenticated
  using (bucket_id = 'site' and public.is_admin())
  with check (bucket_id = 'site' and public.is_admin());
