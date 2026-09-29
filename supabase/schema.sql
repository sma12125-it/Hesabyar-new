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
