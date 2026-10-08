import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export interface SupabaseSettings {
  url: string
  anonKey: string
  isCustom: boolean
}

const DEFAULT_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) ||
  (typeof process !== 'undefined' && (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL)) ||
  'https://yiluruldxtgfuxqwosri.supabase.co'

const DEFAULT_KEY =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) ||
  (typeof process !== 'undefined' && (process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY)) ||
  'sb_publishable_tHV7NoCAC-3czs4yMG1Z7Q_bg05S1MI'

const STORAGE_KEY_URL = 'hy-custom-supabase-url'
const STORAGE_KEY_KEY = 'hy-custom-supabase-key'

export function getSupabaseSettings(): SupabaseSettings {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return {
      url: DEFAULT_URL,
      anonKey: DEFAULT_KEY,
      isCustom: false,
    }
  }

  const customUrl = localStorage.getItem(STORAGE_KEY_URL)?.trim()
  const customKey = localStorage.getItem(STORAGE_KEY_KEY)?.trim()

  if (customUrl && customKey) {
    return {
      url: customUrl,
      anonKey: customKey,
      isCustom: true,
    }
  }

  return {
    url: DEFAULT_URL,
    anonKey: DEFAULT_KEY,
    isCustom: false,
  }
}

export function saveCustomSupabaseSettings(url: string, anonKey: string): void {
  const cleanUrl = url.trim().replace(/\/$/, '')
  const cleanKey = anonKey.trim()

  if (!cleanUrl || !cleanKey) {
    throw new Error('لطفاً هم آدرس پروژه (Project URL) و هم کلید عمومی (Anon Key) را وارد کنید.')
  }

  if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
    throw new Error('آدرس پروژه باید با https:// یا http:// شروع شود.')
  }

  localStorage.setItem(STORAGE_KEY_URL, cleanUrl)
  localStorage.setItem(STORAGE_KEY_KEY, cleanKey)
  window.dispatchEvent(new Event('hy-supabase-config-changed'))
}

export function resetToDefaultSupabaseSettings(): void {
  localStorage.removeItem(STORAGE_KEY_URL)
  localStorage.removeItem(STORAGE_KEY_KEY)
  window.dispatchEvent(new Event('hy-supabase-config-changed'))
}

let cachedClient: SupabaseClient | null = null
let cachedUrl = ''
let cachedKey = ''

export function getSupabaseClient(): SupabaseClient {
  const { url, anonKey } = getSupabaseSettings()

  if (cachedClient && cachedUrl === url && cachedKey === anonKey) {
    return cachedClient
  }

  cachedClient = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })
  cachedUrl = url
  cachedKey = anonKey

  return cachedClient
}

export async function testSupabaseConnection(url: string, anonKey: string): Promise<{ success: boolean; message: string }> {
  const cleanUrl = url.trim().replace(/\/$/, '')
  const cleanKey = anonKey.trim()

  if (!cleanUrl || !cleanKey) {
    return { success: false, message: 'آدرس و کلید Supabase نمی‌تواند خالی باشد.' }
  }

  try {
    // Test a basic ping or public healthcheck by testing auth settings endpoint
    const res = await fetch(`${cleanUrl}/auth/v1/settings`, {
      headers: {
        apikey: cleanKey,
        Authorization: `Bearer ${cleanKey}`,
      },
    })

    if (res.ok || res.status === 200 || res.status === 400 || res.status === 401) {
      // 200 means success; 401 might mean anon key needs rest check:
      const restTest = await fetch(`${cleanUrl}/rest/v1/`, {
        headers: {
          apikey: cleanKey,
          Authorization: `Bearer ${cleanKey}`,
        },
      })

      if (restTest.ok || restTest.status === 200 || restTest.status === 404) {
        return { success: true, message: 'اتصال به پروژه Supabase با موفقیت برقرار شد!' }
      }
    }

    return { success: false, message: `پاسخ از سرور دریافت نشد (کد وضعیت: ${res.status})` }
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'خطای برقراری ارتباط با سرور Supabase',
    }
  }
}
