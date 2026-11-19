-- ---------------------------------------------------------------------
--  STATISTICHE PIÙ COMPLETE: quanto resta ogni visitatore e quante
--  pagine guarda (sempre anonimo: nessun nome, nessun indirizzo IP).
-- ---------------------------------------------------------------------
alter table public.visits add column if not exists sid uuid;          -- una visita (più pagine)
alter table public.visits add column if not exists vid uuid;          -- una pagina vista
alter table public.visits add column if not exists duration_s integer check (duration_s between 0 and 86400);
create index if not exists visits_vid_idx on public.visits (vid);
create or replace function public.visit_duration(p_vid uuid, p_secs integer)
returns void language sql security definer set search_path = public as $$
  update public.visits set duration_s = least(greatest(p_secs, 0), 86400)
   where vid = p_vid and created_at > now() - interval '6 hours';
$$;
revoke all on function public.visit_duration(uuid, integer) from public;
grant execute on function public.visit_duration(uuid, integer) to anon, authenticated;
