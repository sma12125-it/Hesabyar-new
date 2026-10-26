-- Hesabyar: server-side version check and server clock for cloud snapshots.
-- OPTIONAL. The app works without it (it pulls, merges per row, then pushes), but this
-- closes the small race where two devices push at the same moment, and stops device
-- clocks from deciding the snapshot version.
-- Run once in the Supabase SQL Editor. Safe to run again.

-- 1) The server's clock sets updated_at on every write (millisecond precision so the
--    browser can echo it back exactly).
create or replace function public.snapshots_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := date_trunc('milliseconds', now());
  return new;
end;
$$;

drop trigger if exists snapshots_touch on public.snapshots;
create trigger snapshots_touch
  before insert or update on public.snapshots
  for each row execute function public.snapshots_touch();

-- 2) Compare-and-swap push. p_base is the updated_at the client merged against
--    (null when it saw no snapshot). If someone pushed in between, nothing is written
--    and ok=false; the app then pulls, merges and retries.
create or replace function public.push_snapshot(p_payload jsonb, p_base timestamptz default null)
returns table (ok boolean, updated_at timestamptz)
language plpgsql
security invoker
set search_path = public
as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_current timestamptz;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'payload must be an object' using errcode = '22023';
  end if;

  select s.updated_at into v_current from public.snapshots s where s.user_id = v_uid for update;

  if found then
    if p_base is null or date_trunc('milliseconds', v_current) <> date_trunc('milliseconds', p_base) then
      return query select false, v_current;
      return;
    end if;
    update public.snapshots s set payload = p_payload where s.user_id = v_uid
      returning s.updated_at into v_current;
  else
    insert into public.snapshots (user_id, payload) values (v_uid, p_payload)
      on conflict (user_id) do nothing
      returning snapshots.updated_at into v_current;
    if v_current is null then
      select s.updated_at into v_current from public.snapshots s where s.user_id = v_uid;
      return query select false, v_current;
      return;
    end if;
  end if;
  return query select true, v_current;
end;
$$;

revoke all on function public.push_snapshot(jsonb, timestamptz) from public, anon;
grant execute on function public.push_snapshot(jsonb, timestamptz) to authenticated;

-- 3) Optional safety net: keep the previous payloads for 30 days so a bad push can be
--    recovered by the owner from the SQL editor.
create table if not exists public.snapshot_history (
  id bigserial primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  updated_at timestamptz not null,
  payload jsonb not null,
  saved_at timestamptz not null default now()
);
alter table public.snapshot_history enable row level security;
drop policy if exists "own snapshot history" on public.snapshot_history;
create policy "own snapshot history" on public.snapshot_history
  for select using (auth.uid() = user_id);
revoke all on table public.snapshot_history from anon;
grant select on table public.snapshot_history to authenticated;

create or replace function public.snapshots_keep_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.snapshot_history (user_id, updated_at, payload)
    values (old.user_id, old.updated_at, old.payload);
  delete from public.snapshot_history
    where user_id = old.user_id and saved_at < now() - interval '30 days';
  return new;
end;
$$;

drop trigger if exists snapshots_keep_history on public.snapshots;
create trigger snapshots_keep_history
  before update on public.snapshots
  for each row execute function public.snapshots_keep_history();
