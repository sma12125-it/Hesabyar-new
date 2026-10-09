import { AsyncLocalStorage } from 'node:async_hooks'

export interface AuthContext {
  token?: string
}

const authStorage = new AsyncLocalStorage<AuthContext>()

/**
 * Runs a function within an authentication context.
 */
export function runWithAuthContext<T>(context: AuthContext, fn: () => Promise<T>): Promise<T> {
  return authStorage.run(context, fn)
}

/**
 * Gets the current auth token from the execution context.
 */
export function getCurrentAuthToken(): string | undefined {
  const store = authStorage.getStore()
  return store?.token
}

/**
 * Extracts Bearer token or API key from request headers.
 */
export function extractTokenFromHeaders(headers: Record<string, string | string[] | undefined>): string | undefined {
  const authHeader = headers['authorization'] || headers['Authorization']
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim()
  }

  const apiKey = headers['x-api-key'] || headers['X-Api-Key']
  if (typeof apiKey === 'string') {
    return apiKey.trim()
  }

  return undefined
}
