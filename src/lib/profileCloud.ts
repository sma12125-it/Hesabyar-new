import * as db from '../db/db'
import { fetchMyProfile, saveMyProfile } from './profileApi'
import { chooseProfileSync, profileIsBlank, type UserProfile } from './profile'
import { ensureSession, notifyUser } from './sync'

export const PROFILE_DIRTY_KEY = 'hy-profile-dirty'

export type ProfileCloudState = 'pushed' | 'pulled' | 'kept' | 'local' | 'offline' | 'failed'

export interface ProfileSyncResult {
  profile: UserProfile | null
  error: string
  cloud: ProfileCloudState
}

export interface ProfileSyncOptions {
  /** The user just pressed save. Send this copy unless it would wipe a filled cloud profile. */
  force?: 'push'
  /** Written at the start of this sync turn so an in-flight pull cannot drop it. */
  profile?: UserProfile
  /** Show a toast for a new cloud failure. Defaults to true. */
  notify?: boolean
  /** Show the toast even when the same failure was already shown. */
  forceNotify?: boolean
}

const OFFLINE_ERROR = 'اینترنت قطع است. پروفایل روی این دستگاه ماند و با وصل شدن دوباره به ابر فرستاده می‌شود.'
const LOCAL_ONLY_ERROR = 'پروفایل روی این دستگاه ذخیره شد. تا وقتی از تنظیمات وارد حساب ابری نشوید، در دستگاه دیگر دیده نمی‌شود.'

let lastError = ''
let tail: Promise<void> = Promise.resolve()

export function profileCloudError(): string {
  return lastError
}

export function syncProfile(opts?: ProfileSyncOptions): Promise<ProfileSyncResult> {
  const run = tail.then(() => doSync(opts), () => doSync(opts))
  tail = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

async function readLocal(): Promise<UserProfile | null> {
  return (await db.getKv<UserProfile>('userProfile')) ?? null
}

function readDirty(): boolean {
  return typeof localStorage !== 'undefined' && localStorage.getItem(PROFILE_DIRTY_KEY) === '1'
}

function clearDirty() {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem(PROFILE_DIRTY_KEY)
}

function publish(profile: UserProfile) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('hy-profile-updated', { detail: { profile } }))
}

function report(message: string, opts?: ProfileSyncOptions) {
  const changed = message !== lastError
  lastError = message
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('hy-profile-cloud-error', { detail: { message } }))
  if (opts?.notify === false) return
  if (changed || opts?.forceNotify) notifyUser(message)
}

function clearError(cloud: ProfileCloudState) {
  if (!lastError) return
  lastError = ''
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('hy-profile-cloud-error', { detail: { message: '', cloud } }))
}

async function doSync(opts?: ProfileSyncOptions): Promise<ProfileSyncResult> {
  if (opts?.profile) {
    await db.setKv('userProfile', opts.profile)
    if (typeof localStorage !== 'undefined') localStorage.setItem(PROFILE_DIRTY_KEY, '1')
  }
  const local = await readLocal()
  const dirty = readDirty()
  const wantsCloud = dirty || opts?.force === 'push'
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false
  if (offline) {
    if (!wantsCloud) return { profile: local, error: '', cloud: 'kept' }
    report(OFFLINE_ERROR, opts)
    return { profile: local, error: OFFLINE_ERROR, cloud: 'offline' }
  }

  const session = await ensureSession()
  if (!session) {
    if (!wantsCloud) return { profile: local, error: '', cloud: 'kept' }
    return { profile: local, error: LOCAL_ONLY_ERROR, cloud: 'local' }
  }

  try {
    const remote = await fetchMyProfile()
    let action = chooseProfileSync(local, remote, dirty)
    if (opts?.force === 'push' && local && !profileIsBlank(local)) action = 'push'
    if (opts?.force === 'push' && local && profileIsBlank(local) && profileIsBlank(remote)) action = 'push'

    if (action === 'push' && local) {
      const saved = await saveMyProfile(local)
      await db.setKv('userProfile', saved)
      clearDirty()
      publish(saved)
      clearError('pushed')
      return { profile: saved, error: '', cloud: 'pushed' }
    }
    if (action === 'pull' && remote) {
      await db.setKv('userProfile', remote)
      clearDirty()
      publish(remote)
      clearError('pulled')
      return { profile: remote, error: '', cloud: 'pulled' }
    }
    clearError('kept')
    return { profile: local, error: '', cloud: 'kept' }
  } catch (err) {
    const error = err instanceof Error && err.message ? err.message : 'ذخیره ابری پروفایل انجام نشد'
    report(error, opts)
    return { profile: local, error, cloud: 'failed' }
  }
}
