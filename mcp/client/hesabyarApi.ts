import { getCurrentAuthToken } from '../auth/context'

export interface ApiFetchOptions {
  token?: string
  headers?: Record<string, string>
}

export class HesabyarApiClient {
  private baseUrl: string

  constructor(baseUrl?: string) {
    const port = process.env.PORT || '3000'
    const defaultLocalUrl = `http://127.0.0.1:${port}/api/v1`
    this.baseUrl = (baseUrl || process.env.HESABYAR_API_URL || defaultLocalUrl).replace(/\/$/, '')
  }

  private resolveHeaders(options?: ApiFetchOptions): HeadersInit {
    const token = options?.token || getCurrentAuthToken()
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options?.headers || {}),
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    return headers
  }

  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    path: string,
    body?: unknown,
    options?: ApiFetchOptions,
  ): Promise<T> {
    const url = `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`
    const headers = this.resolveHeaders(options)

    let response: Response
    try {
      response = await fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      })
    } catch (err) {
      throw new Error(`خطای ارتباط با سرور حسابیار: ${err instanceof Error ? err.message : String(err)}`)
    }

    const json = (await response.json().catch(() => null)) as {
      success?: boolean
      error?: string
      message?: string
      data?: T
    } | null

    if (!response.ok) {
      const errorMessage =
        json?.error ||
        json?.message ||
        `خطای سرور حسابیار (کد وضعیت: ${response.status})`

      if (response.status === 401) {
        throw new Error(`[401 Unauthorized] ${errorMessage}`)
      } else if (response.status === 403) {
        throw new Error(`[403 Forbidden] ${errorMessage}`)
      } else if (response.status === 404) {
        throw new Error(`[404 Not Found] ${errorMessage}`)
      } else if (response.status === 400) {
        throw new Error(`[400 Bad Request] ${errorMessage}`)
      } else if (response.status === 409) {
        throw new Error(`[409 Conflict] ${errorMessage}`)
      } else {
        throw new Error(`[${response.status}] ${errorMessage}`)
      }
    }

    // If API returned standard { success: true, data: ... }
    if (json && 'data' in json) {
      return json.data as T
    }

    return json as T
  }

  get<T>(path: string, query?: Record<string, string | number | boolean | undefined>, options?: ApiFetchOptions): Promise<T> {
    let queryString = ''
    if (query) {
      const params = new URLSearchParams()
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined) {
          params.set(key, String(value))
        }
      }
      const qs = params.toString()
      if (qs) {
        queryString = `?${qs}`
      }
    }
    return this.request<T>('GET', `${path}${queryString}`, undefined, options)
  }

  post<T>(path: string, body?: unknown, options?: ApiFetchOptions): Promise<T> {
    return this.request<T>('POST', path, body, options)
  }

  put<T>(path: string, body?: unknown, options?: ApiFetchOptions): Promise<T> {
    return this.request<T>('PUT', path, body, options)
  }

  patch<T>(path: string, body?: unknown, options?: ApiFetchOptions): Promise<T> {
    return this.request<T>('PATCH', path, body, options)
  }

  delete<T>(path: string, options?: ApiFetchOptions): Promise<T> {
    return this.request<T>('DELETE', path, undefined, options)
  }

  async checkHealth(): Promise<{ status: string; app?: string; version?: string }> {
    try {
      const res = await this.get<{ status: string; app?: string; version?: string }>('/health')
      return res
    } catch {
      return { status: 'unreachable' }
    }
  }
}

export const hesabyarApi = new HesabyarApiClient()
