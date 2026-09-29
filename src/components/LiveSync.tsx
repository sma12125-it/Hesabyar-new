import { useEffect, useRef } from 'react'
import {
  clearCloudDirty,
  cloudDirty,
  ensureSession,
  notifyUser,
  onLocalChange,
  pullSnapshot,
  pushSnapshot,
  supabaseConfig,
  withoutSync,
} from '../lib/sync'
import { useExtras } from '../store/Extras'
import { useStore } from '../store/Store'

interface Payload {
  accounts: never[]
  transactions: never[]
  plans: never[]
  items: never[]
  customCategories: unknown
  budgets: unknown
  goals: unknown
  reminders: unknown
  cardVault: unknown
  origin?: string
}

export function LiveSync() {
  const store = useStore()
  const extras = useExtras()
  const storeRef = useRef(store)
  const extrasRef = useRef(extras)
  storeRef.current = store
  extrasRef.current = extras

  useEffect(() => {
    let closed = false
    let timer = 0
    let socket: WebSocket | null = null
    let lastSent = Number(localStorage.getItem('hy-cloud-seen') || 0)
    let toldSignedOut = false
    const deviceId = sessionStorage.getItem('hy-device') ?? crypto.randomUUID()
    sessionStorage.setItem('hy-device', deviceId)

    async function snapshot() {
      const current = storeRef.current
      const local = await extrasRef.current.exportLocal()
      return {
        updatedAt: Date.now(),
        data: {
          accounts: current.accounts,
          transactions: current.transactions,
          plans: current.plans,
          items: current.items,
          customCategories: current.customCategories,
          budgets: local.budgets,
          goals: local.goals,
          reminders: local.reminders,
          cardVault: local.cardVault,
          origin: deviceId,
        },
      }
    }

    async function pushNow() {
      const session = await ensureSession()
      if (!session || closed) {
        if (!toldSignedOut) {
          toldSignedOut = true
          notifyUser('برای ذخیرهٔ زنده، از تنظیمات وارد حساب ابری شوید')
        }
        return
      }
      toldSignedOut = false
      const body = await snapshot()
      try {
        await pushSnapshot(session, body)
      } catch (err) {
        if (!navigator.onLine) throw new Error('اینترنت قطع است. تغییر روی گوشی ماند و با اتصال دوباره به ابر می‌رود')
        throw err
      }
      lastSent = body.updatedAt
      localStorage.setItem('hy-cloud-seen', String(lastSent))
      clearCloudDirty()
      lastFail = ''
      notifyUser('روی ابر ذخیره شد')
    }

    async function applyRemote() {
      if (cloudDirty()) {
        await pushNow()
        return
      }
      const session = await ensureSession()
      if (!session || closed) return
      const remote = await pullSnapshot<Payload>(session)
      if (!remote || remote.updatedAt <= lastSent) return
      lastSent = remote.updatedAt
      localStorage.setItem('hy-cloud-seen', String(lastSent))
      const data = remote.data
      if (data?.origin === deviceId) return
      await withoutSync(async () => {
        await storeRef.current.importCloud({
          accounts: data.accounts ?? [],
          transactions: data.transactions ?? [],
          plans: data.plans ?? [],
          items: data.items ?? [],
          customCategories: (data.customCategories as never) ?? [],
        })
        await extrasRef.current.importLocal(data as unknown as Record<string, unknown>)
      })
      clearCloudDirty()
      notifyUser('از دستگاه دیگر به‌روز شد')
    }

    let lastFail = ''
    function fail(err: unknown) {
      const message = err instanceof Error ? err.message : 'همگام‌سازی ناموفق بود'
      if (message === lastFail) return
      lastFail = message
      notifyUser(message)
    }

    function schedulePush() {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        void pushNow().catch(fail)
      }, 250)
    }

    function connect(session: { accessToken: string; userId: string }) {
      const cfg = supabaseConfig()
      const host = new URL(cfg.url).host
      const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'wss'}://${host}/realtime/v1/websocket?apikey=${encodeURIComponent(cfg.key)}&vsn=1.0.0`)
      socket = ws
      let ref = 0
      const send = (topic: string, event: string, payload: unknown) => {
        ref += 1
        ws.send(JSON.stringify({ topic, event, payload, ref: String(ref) }))
      }
      ws.onopen = () => {
        send(`realtime:snapshots:${session.userId}`, 'phx_join', {
          config: {
            broadcast: { ack: false, self: false },
            presence: { enabled: false },
            postgres_changes: [{ event: '*', schema: 'public', table: 'snapshots', filter: `user_id=eq.${session.userId}` }],
          },
          access_token: session.accessToken,
        })
      }
      ws.onmessage = (message) => {
        const frame = JSON.parse(String(message.data)) as { event?: string; payload?: { status?: string } }
        if (frame.event === 'phx_reply' && frame.payload?.status === 'error') fail(new Error('اتصال زنده به ابر برقرار نشد'))
        if (frame.event === 'postgres_changes') void applyRemote().catch(fail)
      }
      const beat = window.setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) send('phoenix', 'heartbeat', {})
      }, 25000)
      ws.onclose = () => window.clearInterval(beat)
    }

    async function start() {
      if (!navigator.onLine || closed) return
      const session = await ensureSession()
      if (!session || closed) return
      if (cloudDirty()) await pushNow()
      else await applyRemote()
      socket?.close()
      connect(session)
    }

    const poll = window.setInterval(() => {
      if (!navigator.onLine) return
      void applyRemote().catch(fail)
    }, 2500)

    const stopListen = onLocalChange(schedulePush)
    const onSession = () => {
      socket?.close()
      void start().catch(fail)
    }
    const onOnline = () => {
      void start().catch(fail)
    }
    window.addEventListener('hy-cloud-session', onSession)
    window.addEventListener('online', onOnline)
    void start().catch(fail)
    return () => {
      closed = true
      window.clearInterval(poll)
      window.clearTimeout(timer)
      stopListen()
      window.removeEventListener('hy-cloud-session', onSession)
      window.removeEventListener('online', onOnline)
      socket?.close()
    }
  }, [])

  return null
}
