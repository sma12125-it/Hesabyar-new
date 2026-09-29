import { loadSession } from './sync'

export function currentActorEmail(): string | undefined {
  const email = loadSession()?.email?.trim().toLowerCase()
  return email || undefined
}

export function actorStamp(now = Date.now()): { actorEmail?: string; updatedAt: number } {
  return { actorEmail: currentActorEmail(), updatedAt: now }
}

export function actorLabel(email: string | undefined, mine = currentActorEmail()): string | null {
  if (!email) return null
  if (mine && email.toLowerCase() === mine.toLowerCase()) return 'شما'
  const name = email.split('@')[0]?.trim()
  return name || email
}
