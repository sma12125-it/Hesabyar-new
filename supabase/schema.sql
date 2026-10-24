create table if not exists public.snapshots (
  user_id uuid primary key references auth.users (id) on delete cascade,
  updated_at timestamptz not null default now(),
  payload jsonb not null
);

alter table public.snapshots enable row level security;

drop policy if exists "own snapshot" on public.snapshots;

create policy "own snapshot"
  on public.snapshots
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

revoke all on table public.snapshots from anon;
grant select, insert, update, delete on table public.snapshots to authenticated;
grant all on table public.snapshots to service_role;

alter table public.snapshots replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.snapshots;
exception
  when duplicate_object then null;
end $$;

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.account_recovery (
  user_id uuid primary key references auth.users (id) on delete cascade,
  code_hash text not null
);

alter table public.account_recovery enable row level security;
revoke all on table public.account_recovery from anon, authenticated;

create or replace function public.set_recovery_code(p_code text)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
begin
  if auth.uid() is null then
    raise exception 'وارد نشده‌اید';
  end if;
  if p_code is null or char_length(p_code) < 8 then
    raise exception 'کد بازیابی کوتاه است';
  end if;
  insert into public.account_recovery (user_id, code_hash)
  values (auth.uid(), encode(digest(convert_to(p_code, 'UTF8'), 'sha256'), 'hex'))
  on conflict (user_id) do update set code_hash = excluded.code_hash;
end;
$$;

create or replace function public.recover_with_code(p_email text, p_code text, p_password text)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  uid uuid;
  expected text;
  actual text;
begin
  if p_password is null or char_length(p_password) < 6 then
    raise exception 'رمز حداقل ۶ حرف است';
  end if;
  if p_code is null or char_length(trim(p_code)) < 8 then
    raise exception 'کد بازیابی نادرست است';
  end if;
  select id into uid from auth.users where lower(email) = lower(trim(p_email));
  if uid is null then
    raise exception 'کد بازیابی نادرست است';
  end if;
  select code_hash into expected from public.account_recovery where user_id = uid;
  actual := encode(digest(convert_to(trim(p_code), 'UTF8'), 'sha256'), 'hex');
  if expected is null or expected <> actual then
    raise exception 'کد بازیابی نادرست است';
  end if;
  update auth.users
     set encrypted_password = crypt(p_password, gen_salt('bf', 10)),
         updated_at = now()
   where id = uid;
end;
$$;

revoke all on function public.set_recovery_code(text) from public, anon;
revoke all on function public.recover_with_code(text, text, text) from public;
grant execute on function public.set_recovery_code(text) to authenticated;
grant execute on function public.recover_with_code(text, text, text) to anon, authenticated;

create table if not exists public.shared_ledgers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  owner_id uuid not null references auth.users (id) on delete cascade,
  account_id text not null,
  title text not null,
  updated_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb
);

create table if not exists public.shared_members (
  ledger_id uuid not null references public.shared_ledgers (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  email text not null,
  role text not null default 'member',
  primary key (ledger_id, user_id)
);

create table if not exists public.shared_invites (
  ledger_id uuid not null references public.shared_ledgers (id) on delete cascade,
  email text not null,
  primary key (ledger_id, email)
);

alter table public.shared_ledgers enable row level security;
alter table public.shared_members enable row level security;
alter table public.shared_invites enable row level security;

create or replace function public.is_share_member(p_ledger uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.shared_members
    where ledger_id = p_ledger and user_id = auth.uid()
  );
$$;

revoke all on function public.is_share_member(uuid) from public, anon;
grant execute on function public.is_share_member(uuid) to authenticated;

drop policy if exists "member read ledger" on public.shared_ledgers;
create policy "member read ledger"
  on public.shared_ledgers for select
  using (public.is_share_member(id));

drop policy if exists "member update ledger" on public.shared_ledgers;
create policy "member update ledger"
  on public.shared_ledgers for update
  using (public.is_share_member(id))
  with check (public.is_share_member(id));

drop policy if exists "member read members" on public.shared_members;
create policy "member read members"
  on public.shared_members for select
  using (public.is_share_member(ledger_id));

revoke all on table public.shared_ledgers from anon;
revoke all on table public.shared_members from anon;
revoke all on table public.shared_invites from anon;
grant select, update on table public.shared_ledgers to authenticated;
grant select on table public.shared_members to authenticated;

create or replace function public.shared_ledgers_guard()
returns trigger
language plpgsql
as $$
begin
  if new.owner_id <> old.owner_id or new.code <> old.code or new.id <> old.id or new.account_id <> old.account_id then
    raise exception 'این فیلد قابل تغییر نیست';
  end if;
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists shared_ledgers_guard on public.shared_ledgers;
create trigger shared_ledgers_guard
  before update on public.shared_ledgers
  for each row execute procedure public.shared_ledgers_guard();

create or replace function public.create_shared_ledger(p_account_id text, p_title text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  uid uuid := auth.uid();
  email text;
  new_id uuid := gen_random_uuid();
  new_code text;
begin
  if uid is null then
    raise exception 'وارد نشده‌اید';
  end if;
  if p_account_id is null or length(trim(p_account_id)) = 0 then
    raise exception 'حساب انتخاب نشده';
  end if;
  select u.email into email from auth.users u where u.id = uid;
  new_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  insert into public.shared_ledgers (id, code, owner_id, account_id, title, payload)
  values (new_id, new_code, uid, p_account_id, left(coalesce(nullif(trim(p_title), ''), 'کارت'), 48), coalesce(p_payload, '{}'::jsonb));
  insert into public.shared_members (ledger_id, user_id, email, role)
  values (new_id, uid, coalesce(email, ''), 'owner');
  return jsonb_build_object('id', new_id, 'code', new_code);
end;
$$;

create or replace function public.invite_shared_email(p_ledger_id uuid, p_email text)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
  target text := lower(trim(p_email));
  other_id uuid;
  other_email text;
begin
  if uid is null then
    raise exception 'وارد نشده‌اید';
  end if;
  if target is null or position('@' in target) = 0 then
    raise exception 'ایمیل معتبر نیست';
  end if;
  if not exists (
    select 1 from public.shared_members
    where ledger_id = p_ledger_id and user_id = uid and role = 'owner'
  ) then
    raise exception 'فقط صاحب کارت می‌تواند دعوت کند';
  end if;
  select id, email into other_id, other_email from auth.users where lower(email) = target;
  if other_id is not null then
    insert into public.shared_members (ledger_id, user_id, email, role)
    values (p_ledger_id, other_id, coalesce(other_email, target), 'member')
    on conflict (ledger_id, user_id) do nothing;
    delete from public.shared_invites where ledger_id = p_ledger_id and email = target;
  else
    insert into public.shared_invites (ledger_id, email)
    values (p_ledger_id, target)
    on conflict (ledger_id, email) do nothing;
  end if;
end;
$$;

create or replace function public.join_shared_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
  email text;
  lid uuid;
  clean text := upper(replace(trim(coalesce(p_code, '')), '-', ''));
begin
  if uid is null then
    raise exception 'وارد نشده‌اید';
  end if;
  select u.email into email from auth.users u where u.id = uid;
  select id into lid from public.shared_ledgers where code = clean;
  if lid is null then
    raise exception 'کد اشتراک پیدا نشد';
  end if;
  insert into public.shared_members (ledger_id, user_id, email, role)
  values (lid, uid, coalesce(email, ''), 'member')
  on conflict (ledger_id, user_id) do nothing;
  return lid;
end;
$$;

create or replace function public.claim_shared_invites()
returns integer
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
  email text;
  claimed integer;
begin
  if uid is null then
    return 0;
  end if;
  select lower(u.email) into email from auth.users u where u.id = uid;
  if email is null then
    return 0;
  end if;
  insert into public.shared_members (ledger_id, user_id, email, role)
  select i.ledger_id, uid, email, 'member'
  from public.shared_invites i
  where i.email = email
  on conflict (ledger_id, user_id) do nothing;
  get diagnostics claimed = row_count;
  delete from public.shared_invites where email = email;
  return claimed;
end;
$$;

revoke all on function public.create_shared_ledger(text, text, jsonb) from public, anon;
revoke all on function public.invite_shared_email(uuid, text) from public, anon;
revoke all on function public.join_shared_code(text) from public, anon;
revoke all on function public.claim_shared_invites() from public, anon;
grant execute on function public.create_shared_ledger(text, text, jsonb) to authenticated;
grant execute on function public.invite_shared_email(uuid, text) to authenticated;
grant execute on function public.join_shared_code(text) to authenticated;
grant execute on function public.claim_shared_invites() to authenticated;

alter table public.shared_ledgers replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.shared_ledgers;
exception
  when duplicate_object then null;
end $$;


-- Profiles, handles, dong sharing, and card/account sharing.
-- Also stored at supabase/migrations/20261024_profiles_and_sharing.sql

-- Hesabyar profiles, unique handles, دونگ sharing, and card/account sharing.
-- The app does not apply this itself. Run the whole file once in the
-- Supabase SQL Editor of the project the app points at.
-- Safe to run again: objects are created only if missing and functions are replaced.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  first_name text not null default '',
  last_name text not null default '',
  email text not null default '',
  phone text not null default '',
  avatar_url text not null default '',
  handle text,
  display_name text not null default '',
  about text not null default '',
  updated_at timestamptz not null default now(),
  constraint profiles_handle_format check (
    handle is null or handle ~ '^[a-z][a-z0-9_]{2,19}$'
  )
);

create unique index if not exists profiles_handle_lower_idx
  on public.profiles (lower(handle))
  where handle is not null;

alter table public.profiles enable row level security;

drop policy if exists "profile owner read" on public.profiles;
create policy "profile owner read"
  on public.profiles for select
  using (auth.uid() = user_id);

drop policy if exists "profile owner insert" on public.profiles;
create policy "profile owner insert"
  on public.profiles for insert
  with check (auth.uid() = user_id);

drop policy if exists "profile owner update" on public.profiles;
create policy "profile owner update"
  on public.profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

revoke all on table public.profiles from anon;
grant select, insert, update on table public.profiles to authenticated;

create or replace function public.profiles_guard()
returns trigger
language plpgsql
as $$
begin
  if new.handle is not null then
    new.handle := lower(trim(both '@' from trim(new.handle)));
    if new.handle = '' then
      new.handle := null;
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard
  before insert or update on public.profiles
  for each row execute procedure public.profiles_guard();

create or replace function public.handle_available(p_handle text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  clean text := lower(trim(both '@' from trim(coalesce(p_handle, ''))));
begin
  if auth.uid() is null then
    return false;
  end if;
  if clean !~ '^[a-z][a-z0-9_]{2,19}$' then
    return false;
  end if;
  if clean in ('admin', 'hesabyar', 'support', 'root', 'null', 'owner', 'system') then
    return false;
  end if;
  return not exists (
    select 1 from public.profiles
    where handle is not null and lower(handle) = clean and user_id <> auth.uid()
  );
end;
$$;

create or replace function public.lookup_handle(p_handle text)
returns table (handle text, display_name text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  clean text := lower(trim(both '@' from trim(coalesce(p_handle, ''))));
begin
  if clean !~ '^[a-z][a-z0-9_]{2,19}$' then
    return;
  end if;
  return query
  select p.handle,
         coalesce(
           nullif(trim(p.display_name), ''),
           nullif(trim(concat_ws(' ', nullif(trim(p.first_name), ''), nullif(trim(p.last_name), ''))), ''),
           p.handle
         )
    from public.profiles p
   where p.handle is not null and lower(p.handle) = clean;
end;
$$;

revoke all on function public.handle_available(text) from public, anon;
grant execute on function public.handle_available(text) to authenticated;
revoke all on function public.lookup_handle(text) from public;
grant execute on function public.lookup_handle(text) to anon, authenticated;

create table if not exists public.dong_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  local_id text not null,
  title text not null default '',
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint dong_events_owner_local unique (owner_id, local_id)
);

create table if not exists public.dong_event_access (
  event_id uuid not null references public.dong_events (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  participant_id text not null,
  handle text not null,
  display_name text not null default '',
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create index if not exists dong_event_access_user_idx on public.dong_event_access (user_id);

alter table public.dong_events enable row level security;
alter table public.dong_event_access enable row level security;

create or replace function public.can_read_dong(p_event uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.dong_events e
     where e.id = p_event
       and (
         e.owner_id = auth.uid()
         or exists (
           select 1 from public.dong_event_access a
            where a.event_id = e.id and a.user_id = auth.uid()
         )
       )
  );
$$;

revoke all on function public.can_read_dong(uuid) from public, anon;
grant execute on function public.can_read_dong(uuid) to authenticated;

drop policy if exists "dong read" on public.dong_events;
create policy "dong read"
  on public.dong_events for select
  using (public.can_read_dong(id));

drop policy if exists "dong insert own" on public.dong_events;
create policy "dong insert own"
  on public.dong_events for insert
  with check (auth.uid() = owner_id);

drop policy if exists "dong update readers" on public.dong_events;
create policy "dong update readers"
  on public.dong_events for update
  using (public.can_read_dong(id))
  with check (public.can_read_dong(id));

drop policy if exists "dong delete own" on public.dong_events;
create policy "dong delete own"
  on public.dong_events for delete
  using (auth.uid() = owner_id);

drop policy if exists "dong access read" on public.dong_event_access;
create policy "dong access read"
  on public.dong_event_access for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.dong_events e
       where e.id = event_id and e.owner_id = auth.uid()
    )
  );

revoke all on table public.dong_events from anon;
grant select, insert, update, delete on table public.dong_events to authenticated;
revoke all on table public.dong_event_access from anon, authenticated;
grant select on table public.dong_event_access to authenticated;

create or replace function public.merge_dong_payload(old_p jsonb, new_p jsonb)
returns jsonb
language plpgsql
immutable
as $$
declare
  result jsonb := coalesce(old_p, '{}'::jsonb);
  deleted jsonb := '[]'::jsonb;
  expenses jsonb := '[]'::jsonb;
  item jsonb;
  prev jsonb;
  eid text;
  taken text[] := '{}';
  old_updated numeric;
  new_updated numeric;
begin
  if jsonb_typeof(old_p -> 'deletedExpenseIds') = 'array' then
    deleted := old_p -> 'deletedExpenseIds';
  end if;
  if jsonb_typeof(new_p -> 'deletedExpenseIds') = 'array' then
    select coalesce(jsonb_agg(distinct value), '[]'::jsonb)
      into deleted
      from (
        select value from jsonb_array_elements(deleted)
        union
        select value from jsonb_array_elements(new_p -> 'deletedExpenseIds')
      ) s;
  end if;

  for item in
    select value from jsonb_array_elements(coalesce(new_p -> 'expenses', '[]'::jsonb))
  loop
    eid := item ->> 'id';
    if eid is null or eid = '' or eid = any (taken) then
      continue;
    end if;
    if deleted @> jsonb_build_array(eid) then
      continue;
    end if;
    select value into prev
      from jsonb_array_elements(coalesce(old_p -> 'expenses', '[]'::jsonb)) value
     where value ->> 'id' = eid
     limit 1;
    if prev is not null then
      new_updated := coalesce((item ->> 'updatedAt')::numeric, 0);
      old_updated := coalesce((prev ->> 'updatedAt')::numeric, 0);
      if old_updated > new_updated then
        item := prev;
      end if;
    end if;
    expenses := expenses || jsonb_build_array(item);
    taken := array_append(taken, eid);
  end loop;

  for item in
    select value from jsonb_array_elements(coalesce(old_p -> 'expenses', '[]'::jsonb))
  loop
    eid := item ->> 'id';
    if eid is null or eid = '' or eid = any (taken) then
      continue;
    end if;
    if deleted @> jsonb_build_array(eid) then
      continue;
    end if;
    expenses := expenses || jsonb_build_array(item);
    taken := array_append(taken, eid);
  end loop;

  result := jsonb_set(result, '{expenses}', expenses, true);
  result := jsonb_set(result, '{deletedExpenseIds}', deleted, true);
  return result;
end;
$$;

revoke all on function public.merge_dong_payload(jsonb, jsonb) from public, anon, authenticated;

create or replace function public.dong_events_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id
       or new.owner_id is distinct from old.owner_id
       or new.local_id is distinct from old.local_id then
      raise exception 'این فیلد قابل تغییر نیست';
    end if;
    if auth.uid() is distinct from old.owner_id then
      if not exists (
        select 1 from public.dong_event_access a
         where a.event_id = old.id and a.user_id = auth.uid()
      ) then
        raise exception 'دسترسی ندارید';
      end if;
      new.title := old.title;
      new.payload := public.merge_dong_payload(old.payload, coalesce(new.payload, old.payload));
    end if;
    new.updated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists dong_events_guard on public.dong_events;
create trigger dong_events_guard
  before update on public.dong_events
  for each row execute procedure public.dong_events_guard();

create or replace function public.share_dong_with_handle(
  p_local_id text,
  p_title text,
  p_payload jsonb,
  p_handle text,
  p_participant_id text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  clean text := lower(trim(both '@' from trim(coalesce(p_handle, ''))));
  grantee uuid;
  dname text;
  eid uuid;
begin
  if uid is null then
    raise exception 'وارد نشده‌اید';
  end if;
  if p_local_id is null or length(trim(p_local_id)) = 0 then
    raise exception 'رویداد مشخص نیست';
  end if;
  if p_participant_id is null or length(trim(p_participant_id)) = 0 then
    raise exception 'عضو مشخص نیست';
  end if;
  if clean !~ '^[a-z][a-z0-9_]{2,19}$' then
    raise exception 'شناسه معتبر نیست';
  end if;
  select p.user_id,
         coalesce(
           nullif(trim(p.display_name), ''),
           nullif(trim(concat_ws(' ', nullif(trim(p.first_name), ''), nullif(trim(p.last_name), ''))), ''),
           p.handle
         )
    into grantee, dname
    from public.profiles p
   where p.handle is not null and lower(p.handle) = clean;
  if grantee is null then
    raise exception 'این شناسه در حسابیار پیدا نشد';
  end if;
  if grantee = uid then
    raise exception 'نمی‌توانید سفر را با شناسه خودتان به اشتراک بگذارید';
  end if;
  insert into public.dong_events (owner_id, local_id, title, payload)
  values (
    uid,
    trim(p_local_id),
    left(coalesce(nullif(trim(p_title), ''), 'دونگ'), 120),
    coalesce(p_payload, '{}'::jsonb)
  )
  on conflict (owner_id, local_id) do update
    set title = excluded.title,
        payload = excluded.payload,
        updated_at = now()
  returning id into eid;
  insert into public.dong_event_access (event_id, user_id, participant_id, handle, display_name)
  values (eid, grantee, trim(p_participant_id), clean, coalesce(dname, clean))
  on conflict (event_id, user_id) do update
    set participant_id = excluded.participant_id,
        handle = excluded.handle,
        display_name = excluded.display_name;
  return jsonb_build_object(
    'eventId', eid,
    'handle', clean,
    'displayName', coalesce(dname, clean)
  );
end;
$$;

create or replace function public.revoke_dong_share(p_local_id text, p_handle text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  clean text := lower(trim(both '@' from trim(coalesce(p_handle, ''))));
  removed integer := 0;
begin
  if uid is null then
    raise exception 'وارد نشده‌اید';
  end if;
  delete from public.dong_event_access a
   using public.dong_events e
   where a.event_id = e.id
     and e.owner_id = uid
     and e.local_id = trim(coalesce(p_local_id, ''))
     and lower(a.handle) = clean;
  get diagnostics removed = row_count;
  if removed = 0 then
    raise exception 'این دسترسی پیدا نشد';
  end if;
end;
$$;

revoke all on function public.share_dong_with_handle(text, text, jsonb, text, text) from public, anon;
revoke all on function public.revoke_dong_share(text, text) from public, anon;
grant execute on function public.share_dong_with_handle(text, text, jsonb, text, text) to authenticated;
grant execute on function public.revoke_dong_share(text, text) to authenticated;

create table if not exists public.shared_assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  grantee_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  local_id text not null,
  handle text not null,
  display_name text not null default '',
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint shared_assets_kind check (kind in ('card', 'account')),
  constraint shared_assets_target unique (owner_id, kind, local_id, grantee_id)
);

create index if not exists shared_assets_grantee_idx on public.shared_assets (grantee_id);

alter table public.shared_assets enable row level security;

drop policy if exists "asset read parties" on public.shared_assets;
create policy "asset read parties"
  on public.shared_assets for select
  using (owner_id = auth.uid() or grantee_id = auth.uid());

revoke all on table public.shared_assets from anon;
grant select on table public.shared_assets to authenticated;

create or replace function public.share_asset_with_handle(
  p_kind text,
  p_local_id text,
  p_handle text,
  p_payload jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  clean text := lower(trim(both '@' from trim(coalesce(p_handle, ''))));
  grantee uuid;
  dname text;
  safe jsonb := '{}'::jsonb;
  aid uuid;
begin
  if uid is null then
    raise exception 'وارد نشده‌اید';
  end if;
  if p_kind not in ('card', 'account') then
    raise exception 'نوع اشتراک معتبر نیست';
  end if;
  if p_local_id is null or length(trim(p_local_id)) = 0 then
    raise exception 'مورد اشتراک مشخص نیست';
  end if;
  if clean !~ '^[a-z][a-z0-9_]{2,19}$' then
    raise exception 'شناسه معتبر نیست';
  end if;
  if jsonb_typeof(p_payload) = 'object' then
    select coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
      into safe
      from jsonb_each(p_payload)
     where lower(key) not in ('cvv', 'cvv2', 'pin', 'password', 'secondpassword', 'otp', 'passphrase');
  end if;
  select p.user_id,
         coalesce(
           nullif(trim(p.display_name), ''),
           nullif(trim(concat_ws(' ', nullif(trim(p.first_name), ''), nullif(trim(p.last_name), ''))), ''),
           p.handle
         )
    into grantee, dname
    from public.profiles p
   where p.handle is not null and lower(p.handle) = clean;
  if grantee is null then
    raise exception 'این شناسه در حسابیار پیدا نشد';
  end if;
  if grantee = uid then
    raise exception 'نمی‌توانید با شناسه خودتان به اشتراک بگذارید';
  end if;
  insert into public.shared_assets (owner_id, grantee_id, kind, local_id, handle, display_name, payload)
  values (uid, grantee, p_kind, trim(p_local_id), clean, coalesce(dname, clean), safe)
  on conflict (owner_id, kind, local_id, grantee_id) do update
    set handle = excluded.handle,
        display_name = excluded.display_name,
        payload = excluded.payload,
        updated_at = now()
  returning id into aid;
  return jsonb_build_object(
    'id', aid,
    'kind', p_kind,
    'localId', trim(p_local_id),
    'handle', clean,
    'displayName', coalesce(dname, clean)
  );
end;
$$;

create or replace function public.revoke_asset_share(p_kind text, p_local_id text, p_handle text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  clean text := lower(trim(both '@' from trim(coalesce(p_handle, ''))));
  removed integer := 0;
begin
  if uid is null then
    raise exception 'وارد نشده‌اید';
  end if;
  delete from public.shared_assets
   where owner_id = uid
     and kind = p_kind
     and local_id = trim(coalesce(p_local_id, ''))
     and lower(handle) = clean;
  get diagnostics removed = row_count;
  if removed = 0 then
    raise exception 'این دسترسی پیدا نشد';
  end if;
end;
$$;

revoke all on function public.share_asset_with_handle(text, text, text, jsonb) from public, anon;
revoke all on function public.revoke_asset_share(text, text, text) from public, anon;
grant execute on function public.share_asset_with_handle(text, text, text, jsonb) to authenticated;
grant execute on function public.revoke_asset_share(text, text, text) to authenticated;

alter table public.profiles replica identity full;
alter table public.dong_events replica identity full;
alter table public.dong_event_access replica identity full;
alter table public.shared_assets replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.profiles;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.dong_events;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.dong_event_access;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.shared_assets;
exception
  when duplicate_object then null;
end $$;
