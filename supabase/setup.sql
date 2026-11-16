-- =====================================================================
--  Włoski z Dominiką – database dell'area riservata
--  Da incollare UNA VOLTA in Supabase → SQL Editor → New query → Run
-- =====================================================================

-- ---------- PROFILI (un profilo per ogni persona registrata) ----------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  full_name   text,
  phone       text,
  lang        text not null default 'it',
  role        text not null default 'client' check (role in ('client','admin')),
  courses     text[] not null default '{}',          -- corsi a cui è iscritto: 'it', 'pl'
  created_at  timestamptz not null default now()
);

-- Crea il profilo automaticamente alla registrazione
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, phone, lang)
  values (new.id, new.email,
          new.raw_user_meta_data->>'full_name',
          new.raw_user_meta_data->>'phone',
          coalesce(new.raw_user_meta_data->>'lang','it'))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- È amministratrice?
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- Solo l'amministratrice può cambiare ruolo e iscrizioni ai corsi
create or replace function public.protect_profile()
returns trigger language plpgsql set search_path = public as $$
begin
  -- le modifiche fatte da Supabase (SQL Editor) sono sempre permesse
  if current_user in ('authenticated','anon') and not public.is_admin() then
    new.role    := old.role;
    new.courses := old.courses;
    new.email   := old.email;
  end if;
  return new;
end $$;

drop trigger if exists protect_profile on public.profiles;
create trigger protect_profile before update on public.profiles
  for each row execute function public.protect_profile();

alter table public.profiles enable row level security;
drop policy if exists "profili: leggi" on public.profiles;
drop policy if exists "profili: modifica" on public.profiles;
create policy "profili: leggi"    on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "profili: modifica" on public.profiles for update using (id = auth.uid() or public.is_admin());

-- ---------- PRENOTAZIONI ----------
create table if not exists public.bookings (
  id          bigint generated always as identity primary key,
  user_id     uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  kind        text not null check (kind in ('excursion','lesson_it','lesson_pl','house','other')),
  item        text,                 -- nome escursione / casa / tipo di lezione
  mode        text,                 -- per le lezioni: individual, group, online
  date_from   date,
  date_to     date,
  people      int  not null default 1 check (people between 1 and 99),
  notes       text,
  status      text not null default 'pending' check (status in ('pending','confirmed','cancelled')),
  paid        boolean not null default false,
  admin_note  text,                 -- messaggio di Dominika al cliente
  payment_url text,                 -- link di pagamento (Stripe/PayPal) aggiunto da Dominika
  created_at  timestamptz not null default now()
);

-- se la tabella esisteva già (versione precedente), aggiunge la colonna del link di pagamento
alter table public.bookings add column if not exists payment_url text;

-- Il cliente può solo creare richieste e annullarle; il resto lo decide Dominika
create or replace function public.protect_booking()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user not in ('authenticated','anon') or public.is_admin() then return new; end if;
  if tg_op = 'INSERT' then
    new.user_id := auth.uid(); new.status := 'pending'; new.paid := false; new.admin_note := null; new.payment_url := null;
  else
    if new.status <> old.status and new.status <> 'cancelled' then
      raise exception 'Non permesso';
    end if;
    new.user_id := old.user_id; new.kind := old.kind; new.item := old.item; new.mode := old.mode;
    new.date_from := old.date_from; new.date_to := old.date_to; new.people := old.people;
    new.notes := old.notes; new.paid := old.paid; new.admin_note := old.admin_note; new.payment_url := old.payment_url;
  end if;
  return new;
end $$;

drop trigger if exists protect_booking on public.bookings;
create trigger protect_booking before insert or update on public.bookings
  for each row execute function public.protect_booking();

alter table public.bookings enable row level security;
drop policy if exists "prenotazioni: leggi"    on public.bookings;
drop policy if exists "prenotazioni: crea"     on public.bookings;
drop policy if exists "prenotazioni: modifica" on public.bookings;
drop policy if exists "prenotazioni: elimina"  on public.bookings;
create policy "prenotazioni: leggi"    on public.bookings for select using (user_id = auth.uid() or public.is_admin());
create policy "prenotazioni: crea"     on public.bookings for insert with check (user_id = auth.uid() or public.is_admin());
create policy "prenotazioni: modifica" on public.bookings for update using (user_id = auth.uid() or public.is_admin());
create policy "prenotazioni: elimina"  on public.bookings for delete using (public.is_admin());

-- ---------- MATERIALI DIDATTICI ----------
create table if not exists public.materials (
  id          bigint generated always as identity primary key,
  title       text not null,
  description text,
  course      text not null check (course in ('it','pl')),
  level       text,                 -- es. A1, A2, B1…
  kind        text not null check (kind in ('file','video','link','text')),
  url         text,                 -- link YouTube o altro sito
  file_path   text,                 -- file caricato nello storage
  body        text,                 -- testo / esercizio scritto
  published   boolean not null default true,
  created_at  timestamptz not null default now()
);

alter table public.materials enable row level security;
drop policy if exists "materiali: leggi"   on public.materials;
drop policy if exists "materiali: gestisci" on public.materials;
create policy "materiali: leggi" on public.materials for select using (
  public.is_admin() or (
    published and exists (select 1 from public.profiles p where p.id = auth.uid() and materials.course = any (p.courses))
  )
);
create policy "materiali: gestisci" on public.materials for all using (public.is_admin()) with check (public.is_admin());

-- ---------- FILE DEI MATERIALI (privati) ----------
insert into storage.buckets (id, name, public) values ('materials', 'materials', false)
on conflict (id) do nothing;

drop policy if exists "file materiali: admin"    on storage.objects;
drop policy if exists "file materiali: studenti" on storage.objects;
create policy "file materiali: admin" on storage.objects for all
  using (bucket_id = 'materials' and public.is_admin())
  with check (bucket_id = 'materials' and public.is_admin());
create policy "file materiali: studenti" on storage.objects for select using (
  bucket_id = 'materials' and exists (
    select 1 from public.materials m join public.profiles p on p.id = auth.uid()
    where m.file_path = storage.objects.name and m.published and m.course = any (p.courses)
  )
);

-- =====================================================================
--  DOPO esserti registrata dall'area riservata del sito, esegui SOLO
--  questa riga (con la tua e-mail) per diventare amministratrice:
--
--  update public.profiles set role = 'admin' where email = 'LA-TUA-EMAIL';
-- =====================================================================
