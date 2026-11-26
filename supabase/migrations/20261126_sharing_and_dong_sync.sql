-- Migration: Support User ID & Handle lookup, multi-asset sharing (installments, debts, cheques),
-- and bidirectional Dong settlement / pending approval convergence.

create or replace function public.lookup_profile_public(p_query text)
returns table (user_id uuid, handle text, display_name text, avatar_url text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  clean text := lower(trim(both '@' from trim(coalesce(p_query, ''))));
begin
  if clean = '' then
    return;
  end if;
  return query
  select p.user_id,
         coalesce(p.handle, 'user_' || left(p.user_id::text, 6)),
         coalesce(
           nullif(trim(p.display_name), ''),
           nullif(trim(concat_ws(' ', nullif(trim(p.first_name), ''), nullif(trim(p.last_name), ''))), ''),
           p.handle,
           'کاربر حسابیار'
         ),
         coalesce(p.avatar_url, '')
    from public.profiles p
   where (p.handle is not null and lower(p.handle) = clean)
      or p.user_id::text = clean
      or left(p.user_id::text, 12) = clean
   limit 1;
end;
$$;

revoke all on function public.lookup_profile_public(text) from public;
grant execute on function public.lookup_profile_public(text) to anon, authenticated;

alter table public.shared_assets
  drop constraint if exists shared_assets_kind;

alter table public.shared_assets
  add constraint shared_assets_kind check (kind in ('card', 'account', 'installment', 'debt', 'cheque'));

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
  if p_kind not in ('card', 'account', 'installment', 'debt', 'cheque') then
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

  old_ts jsonb := coalesce(old_p -> 'settledTransferTimestamps', '{}'::jsonb);
  new_ts jsonb := coalesce(new_p -> 'settledTransferTimestamps', '{}'::jsonb);
  merged_ts jsonb := '{}'::jsonb;
  settled_arr jsonb := '[]'::jsonb;
  tkey text;
  l_entry jsonb;
  r_entry jsonb;
  l_t numeric;
  r_t numeric;
  chosen_entry jsonb;

  old_settled_at numeric := coalesce((old_p ->> 'settledUpdatedAt')::numeric, 0);
  new_settled_at numeric := coalesce((new_p ->> 'settledUpdatedAt')::numeric, 0);

  handled_ids jsonb := '[]'::jsonb;
  approvals jsonb := '[]'::jsonb;
  approval_taken text[] := '{}';
  aid text;
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

  -- Merge transfer settlements by per-transfer updatedAt timestamp
  for tkey in
    select distinct k
      from (
        select key as k from jsonb_object_keys(case when jsonb_typeof(old_ts) = 'object' then old_ts else '{}'::jsonb end) as key
        union
        select key as k from jsonb_object_keys(case when jsonb_typeof(new_ts) = 'object' then new_ts else '{}'::jsonb end) as key
        union
        select value #>> '{}' as k from jsonb_array_elements(coalesce(old_p -> 'settledTransfers', '[]'::jsonb))
        union
        select value #>> '{}' as k from jsonb_array_elements(coalesce(new_p -> 'settledTransfers', '[]'::jsonb))
      ) keys
     where k is not null and k <> ''
  loop
    l_entry := case
      when jsonb_typeof(old_ts) = 'object' and old_ts ? tkey then old_ts -> tkey
      when coalesce(old_p -> 'settledTransfers', '[]'::jsonb) @> jsonb_build_array(tkey) then jsonb_build_object('settled', true, 'updatedAt', 1)
      else null
    end;
    r_entry := case
      when jsonb_typeof(new_ts) = 'object' and new_ts ? tkey then new_ts -> tkey
      when coalesce(new_p -> 'settledTransfers', '[]'::jsonb) @> jsonb_build_array(tkey) then jsonb_build_object('settled', true, 'updatedAt', 1)
      else null
    end;

    if l_entry is not null and r_entry is not null then
      l_t := coalesce((l_entry ->> 'updatedAt')::numeric, 0);
      r_t := coalesce((r_entry ->> 'updatedAt')::numeric, 0);
      if r_t >= l_t then
        chosen_entry := r_entry;
      else
        chosen_entry := l_entry;
      end if;
    else
      chosen_entry := coalesce(r_entry, l_entry);
    end if;

    if chosen_entry is not null then
      merged_ts := jsonb_set(merged_ts, array[tkey], chosen_entry, true);
      if coalesce((chosen_entry ->> 'settled')::boolean, false) then
        settled_arr := settled_arr || jsonb_build_array(tkey);
      end if;
    end if;
  end loop;

  -- Merge event-level settled flag by settledUpdatedAt
  if new_settled_at > old_settled_at then
    result := jsonb_set(result, '{settled}', coalesce(new_p -> 'settled', 'false'::jsonb), true);
    result := jsonb_set(result, '{settledUpdatedAt}', to_jsonb(new_settled_at), true);
  end if;

  -- Merge pendingApprovals & handledApprovalIds
  select coalesce(jsonb_agg(distinct value), '[]'::jsonb)
    into handled_ids
    from (
      select value from jsonb_array_elements(coalesce(old_p -> 'handledApprovalIds', '[]'::jsonb))
      union
      select value from jsonb_array_elements(coalesce(new_p -> 'handledApprovalIds', '[]'::jsonb))
    ) h;

  for item in
    select value from jsonb_array_elements(coalesce(new_p -> 'pendingApprovals', '[]'::jsonb))
    union all
    select value from jsonb_array_elements(coalesce(old_p -> 'pendingApprovals', '[]'::jsonb))
  loop
    aid := item ->> 'id';
    if aid is null or aid = '' or aid = any (approval_taken) then
      continue;
    end if;
    if handled_ids @> jsonb_build_array(aid) then
      continue;
    end if;
    approvals := approvals || jsonb_build_array(item);
    approval_taken := array_append(approval_taken, aid);
  end loop;

  result := jsonb_set(result, '{expenses}', expenses, true);
  result := jsonb_set(result, '{deletedExpenseIds}', deleted, true);
  result := jsonb_set(result, '{settledTransfers}', settled_arr, true);
  result := jsonb_set(result, '{settledTransferTimestamps}', merged_ts, true);
  result := jsonb_set(result, '{pendingApprovals}', approvals, true);
  result := jsonb_set(result, '{handledApprovalIds}', handled_ids, true);
  result := jsonb_set(
    result,
    '{approvalsUpdatedAt}',
    to_jsonb(greatest(coalesce((old_p ->> 'approvalsUpdatedAt')::numeric, 0), coalesce((new_p ->> 'approvalsUpdatedAt')::numeric, 0))),
    true
  );
  return result;
end;
$$;
