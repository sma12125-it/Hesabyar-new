import type { DongEvent } from '../types'
import {
  dongFromRemote,
  explainCloudError,
  presentSharedAsset,
  profileFromRow,
  profileToRow,
  toPublicHandle,
  type PublicHandle,
  type SharedAssetView,
  type UserProfile,
} from './profile'
import { ensureSession, supabaseConfig, type CloudSession } from './sync'

export interface ShareLinkResult {
  eventId: string
  handle: string
  displayName: string
}

async function authed(): Promise<CloudSession> {
  const session = await ensureSession()
  if (!session) throw new Error('برای این کار از تنظیمات وارد حساب ابری شوید')
  return session
}

async function request(session: CloudSession, path: string, init?: RequestInit): Promise<{ status: number; text: string }> {
  const cfg = supabaseConfig()
  const res = await fetch(`${cfg.url}${path}`, {
    ...init,
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${session.accessToken}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  const text = await res.text()
  if (!res.ok) throw new Error(explainCloudError(res.status, text))
  return { status: res.status, text }
}

async function rpc<T>(name: string, body: unknown, session: CloudSession): Promise<T> {
  const { text } = await request(session, `/rest/v1/rpc/${name}`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
  return text ? (JSON.parse(text) as T) : (undefined as T)
}

export async function fetchMyProfile(): Promise<UserProfile | null> {
  const session = await authed()
  const { text } = await request(
    session,
    `/rest/v1/profiles?user_id=eq.${encodeURIComponent(session.userId)}&select=first_name,last_name,email,phone,avatar_url,handle,display_name,about,updated_at`,
  )
  const rows = text ? (JSON.parse(text) as unknown[]) : []
  return profileFromRow(rows[0] ?? null)
}

export async function saveMyProfile(profile: UserProfile): Promise<void> {
  const session = await authed()
  await request(session, '/rest/v1/profiles?on_conflict=user_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(profileToRow(profile, session.userId)),
  })
}

export async function checkHandleAvailable(handle: string): Promise<boolean> {
  const session = await authed()
  const result = await rpc<boolean>('handle_available', { p_handle: handle }, session)
  return result === true
}

export async function lookupHandle(handle: string): Promise<PublicHandle | null> {
  const session = await authed()
  const rows = await rpc<unknown[]>('lookup_handle', { p_handle: handle }, session)
  const first = Array.isArray(rows) ? rows[0] : null
  return toPublicHandle(first)
}

export async function shareDongWithHandle(event: DongEvent, handle: string, participantId: string): Promise<ShareLinkResult> {
  const session = await authed()
  const result = await rpc<{ eventId?: string; handle?: string; displayName?: string }>(
    'share_dong_with_handle',
    {
      p_local_id: event.id,
      p_title: event.title,
      p_payload: event,
      p_handle: handle,
      p_participant_id: participantId,
    },
    session,
  )
  if (!result?.eventId || !result.handle) throw new Error('اشتراک دونگ انجام نشد')
  return { eventId: result.eventId, handle: result.handle, displayName: result.displayName || result.handle }
}

export async function revokeDongShare(localId: string, handle: string): Promise<void> {
  const session = await authed()
  await rpc<void>('revoke_dong_share', { p_local_id: localId, p_handle: handle }, session)
}

export async function pushOwnerDong(event: DongEvent): Promise<string | undefined> {
  const session = await authed()
  const { text } = await request(session, '/rest/v1/dong_events?on_conflict=owner_id,local_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({
      owner_id: session.userId,
      local_id: event.id,
      title: event.title,
      payload: event,
    }),
  })
  const rows = text ? (JSON.parse(text) as { id?: string }[]) : []
  return rows[0]?.id
}

export async function pushMemberDong(event: DongEvent): Promise<void> {
  if (!event.remoteId) return
  const session = await authed()
  await request(session, `/rest/v1/dong_events?id=eq.${encodeURIComponent(event.remoteId)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ payload: event, title: event.title }),
  })
}

export async function deleteRemoteDong(remoteId: string): Promise<void> {
  const session = await authed()
  await request(session, `/rest/v1/dong_events?id=eq.${encodeURIComponent(remoteId)}`, { method: 'DELETE' })
}

export async function pullReadableDong(): Promise<DongEvent[]> {
  const session = await authed()
  const { text } = await request(
    session,
    '/rest/v1/dong_events?select=id,owner_id,local_id,title,payload,updated_at&order=updated_at.desc',
  )
  const rows = text
    ? (JSON.parse(text) as {
        id: string
        owner_id: string
        local_id: string
        title?: string
        payload?: DongEvent
        updated_at?: string
      }[])
    : []
  return rows.map((row) => dongFromRemote(row, session.userId))
}

export async function shareAssetWithHandle(
  kind: 'card' | 'account',
  localId: string,
  handle: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const session = await authed()
  await rpc('share_asset_with_handle', {
    p_kind: kind,
    p_local_id: localId,
    p_handle: handle,
    p_payload: payload,
  }, session)
}

export async function revokeAssetShare(kind: 'card' | 'account', localId: string, handle: string): Promise<void> {
  const session = await authed()
  await rpc<void>('revoke_asset_share', { p_kind: kind, p_local_id: localId, p_handle: handle }, session)
}

export async function listSharedAssets(): Promise<SharedAssetView[]> {
  const session = await authed()
  const { text } = await request(
    session,
    '/rest/v1/shared_assets?select=id,owner_id,kind,local_id,handle,display_name,payload,updated_at&order=updated_at.desc',
  )
  const rows = text ? (JSON.parse(text) as unknown[]) : []
  return rows.map((row) => presentSharedAsset(row, session.userId)).filter((row): row is SharedAssetView => Boolean(row))
}
