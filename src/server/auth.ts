import type { Request, Response, NextFunction } from 'express'

export interface AuthenticatedUser {
  id: string
  email: string
  token: string
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser
    }
  }
}

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  'https://yiluruldxtgfuxqwosri.supabase.co'

const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  'sb_publishable_tHV7NoCAC-3czs4yMG1Z7Q_bg05S1MI'

/**
 * Validates a Bearer token with Supabase Auth service.
 * Returns the authenticated user or null.
 */
export async function verifySupabaseToken(token: string): Promise<AuthenticatedUser | null> {
  if (!token || typeof token !== 'string') return null
  const cleanToken = token.trim()
  if (!cleanToken) return null

  // Support test tokens ONLY in test mode (vitest or NODE_ENV=test) or local development (!isProd)
  const isProd = process.env.NODE_ENV === 'production'
  const isTest = process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST)
  const isDev = !isProd && process.env.ALLOW_DEV_TOKENS !== 'false'

  if (isTest || isDev) {
    if (cleanToken.startsWith('test-user-') || cleanToken === 'dev-token') {
      return {
        id: cleanToken.startsWith('test-user-') ? cleanToken : 'dev-user-001',
        email: 'dev@hesabyar.local',
        token: cleanToken,
      }
    }
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${cleanToken}`,
      },
    })

    if (!res.ok) {
      return null
    }

    const data = (await res.json()) as { id?: string; email?: string }
    if (!data.id) return null

    return {
      id: data.id,
      email: data.email ?? '',
      token: cleanToken,
    }
  } catch (err) {
    console.error('[Auth] Error verifying token with Supabase:', err)
    return null
  }
}

/**
 * Express middleware to authenticate API requests.
 * Extracts Bearer token, validates it against Supabase Auth,
 * extracts userId and email securely, and rejects forged user_id fields in body.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization
  const apiKeyHeader = req.headers['x-api-key']
  const token =
    (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : typeof apiKeyHeader === 'string'
        ? apiKeyHeader.trim()
        : null)

  if (!token) {
    res.status(401).json({
      success: false,
      error: 'Unauthorized: توکن احراز هویت (Bearer Token) یافت نشد.',
      hint: 'هدر Authorization: Bearer <TOKEN> یا x-api-key را ارسال کنید.',
    })
    return
  }

  const user = await verifySupabaseToken(token)
  if (!user) {
    res.status(401).json({
      success: false,
      error: 'Unauthorized: توکن نامعتبر یا منقضی شده است.',
      hint: 'لطفاً دوباره در حسابیار وارد شده یا توکن جدید دریافت کنید.',
    })
    return
  }

  // Security guard: If client tried to pass a forged user_id in body, warn and overwrite/ignore it
  if (req.body && typeof req.body === 'object' && 'user_id' in req.body) {
    if (req.body.user_id !== user.id) {
      console.warn(
        `[Security Warning] Blocked attempt to pass mismatched user_id (${req.body.user_id}) for authenticated user (${user.id})`,
      )
      delete req.body.user_id
    }
  }

  req.user = user
  next()
}
