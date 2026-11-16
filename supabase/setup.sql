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
-- materiale per UNA persona (vuoto = per tutti gli iscritti al corso)
alter table public.materials add column if not exists student_id uuid references public.profiles(id) on delete cascade;

alter table public.materials enable row level security;
drop policy if exists "materiali: leggi"   on public.materials;
drop policy if exists "materiali: gestisci" on public.materials;
create policy "materiali: leggi" on public.materials for select using (
  public.is_admin() or (
    published and (
      materials.student_id = auth.uid()
      or (materials.student_id is null and exists (select 1 from public.profiles p where p.id = auth.uid() and materials.course = any (p.courses)))
    )
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
    where m.file_path = storage.objects.name and m.published
      and (m.student_id = p.id or (m.student_id is null and m.course = any (p.courses)))
  )
);


-- ---------------------------------------------------------------------
--  RICHIESTE DAL SITO (modulo «Scrivimi»): chiunque può inviarne una,
--  solo l'amministratrice le legge (pagina gestione.html → 📩 Richieste)
-- ---------------------------------------------------------------------
create table if not exists public.requests (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  name       text not null check (char_length(name) between 1 and 120),
  email      text check (email is null or char_length(email) <= 200),
  phone      text check (phone is null or char_length(phone) <= 40),
  topic      text check (topic is null or char_length(topic) <= 120),
  message    text check (message is null or char_length(message) <= 5000),
  lang       text check (lang is null or char_length(lang) <= 5),
  page       text check (page is null or char_length(page) <= 300),
  status     text not null default 'new' check (status in ('new','answered','closed')),
  note       text
);
alter table public.requests enable row level security;
grant insert on public.requests to anon, authenticated;
grant select, update, delete on public.requests to authenticated;
drop policy if exists "richieste: invia"    on public.requests;
drop policy if exists "richieste: gestisci" on public.requests;
create policy "richieste: invia" on public.requests for insert to anon, authenticated
  with check (status = 'new' and note is null);
create policy "richieste: gestisci" on public.requests for all to authenticated
  using (public.is_admin()) with check (public.is_admin());


-- ---------------------------------------------------------------------
--  ACCOUNT CREATI DALL'AMMINISTRATRICE (pagina gestione.html)
--  Dominika crea l'accesso per uno studente/cliente con e-mail e password:
--  la persona entra subito dal sito, senza registrarsi.
-- ---------------------------------------------------------------------
create extension if not exists pgcrypto with schema extensions;

create or replace function public.admin_create_user(
  p_email text, p_password text, p_full_name text default null,
  p_phone text default null, p_lang text default 'it', p_courses text[] default '{}')
returns uuid language plpgsql security definer set search_path = public, extensions, auth as $$
declare
  uid uuid := gen_random_uuid();
  em  text := lower(trim(p_email));
begin
  if not public.is_admin() then raise exception 'Solo l''amministratrice può creare account'; end if;
  if em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'E-mail non valida'; end if;
  if char_length(coalesce(p_password,'')) < 8 then raise exception 'La password deve avere almeno 8 caratteri'; end if;
  if exists (select 1 from auth.users where lower(email) = em) then raise exception 'Esiste già un account con questa e-mail'; end if;

  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, recovery_token, email_change_token_new, email_change)
  values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', em,
          extensions.crypt(p_password, extensions.gen_salt('bf')), now(),
          '{"provider":"email","providers":["email"]}'::jsonb,
          jsonb_build_object('full_name', p_full_name, 'phone', p_phone, 'lang', coalesce(p_lang,'it')),
          now(), now(), '', '', '', '');

  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), uid, uid::text,
          jsonb_build_object('sub', uid::text, 'email', em, 'email_verified', true),
          'email', now(), now(), now());

  -- il profilo nasce dal trigger; qui aggiungo i corsi
  insert into public.profiles (id, email, full_name, phone, lang, courses)
  values (uid, em, p_full_name, p_phone, coalesce(p_lang,'it'), coalesce(p_courses,'{}'))
  on conflict (id) do update set full_name = excluded.full_name, phone = excluded.phone,
                                 lang = excluded.lang, courses = excluded.courses;
  return uid;
end $$;

create or replace function public.admin_set_password(p_user uuid, p_password text)
returns void language plpgsql security definer set search_path = public, extensions, auth as $$
begin
  if not public.is_admin() then raise exception 'Solo l''amministratrice può cambiare le password'; end if;
  if char_length(coalesce(p_password,'')) < 8 then raise exception 'La password deve avere almeno 8 caratteri'; end if;
  update auth.users set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')), updated_at = now()
  where id = p_user;
end $$;

revoke all on function public.admin_create_user(text,text,text,text,text,text[]) from public, anon;
revoke all on function public.admin_set_password(uuid,text) from public, anon;
grant execute on function public.admin_create_user(text,text,text,text,text,text[]) to authenticated;
grant execute on function public.admin_set_password(uuid,text) to authenticated;

-- =====================================================================
--  DOPO esserti registrata dall'area riservata del sito, esegui SOLO
--  questa riga (con la tua e-mail) per diventare amministratrice:
--
--  update public.profiles set role = 'admin' where email = 'LA-TUA-EMAIL';
-- =====================================================================
