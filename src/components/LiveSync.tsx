import { useEffect, useRef } from 'react'
import { lastSeenVersion, registerSyncAccessors, syncNow } from '../lib/cloudSync'
import { ensureSession, notifyUser, onLocalChange, supabaseConfig } from '../lib/sync'
import { useExtras } from '../store/Extras'
import { readLiveStore, useStore } from '../store/Store'

/**
 * Keeps this device and the cloud snapshot in step.
 * Every round pulls first, merges row by row (see lib/syncMerge), applies, then pushes the
 * merged result, so a device can no longer overwrite rows it has not seen.
 */
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
    let toldSignedOut = false
    let lastFail = ''
    const deviceId = sessionStorage.getItem('hy-device') ?? crypto.randomUUID()
    sessionStorage.setItem('hy-device', deviceId)

    registerSyncAccessors({
      deviceId,
      readStore: () => {
        const live = readLiveStore()
        return { ...live, customCategories: storeRef.current.customCategories }
      },
      exportExtras: () => extrasRef.current.exportLocal(),
      importStore: (data) => storeRef.current.importCloud(data as never),
      importExtras: (data) => extrasRef.current.importLocal(data),
    })

    function fail(err: unknown) {
      const message = err instanceof Error ? err.message : 'همگام‌سازی ناموفق بود'
      if (message === lastFail) return
      lastFail = message
      notifyUser(message)
    }

    async function round(force = false) {
      if (closed || !storeRef.current.ready || !navigator.onLine) return
      const result = await syncNow({ force })
      if (result.status === 'signed-out') {
        if (!toldSignedOut && force) {
          toldSignedOut = true
          notifyUser('برای ذخیرهٔ زنده، از تنظیمات وارد حساب ابری شوید')
        }
        return
      }
      toldSignedOut = false
      lastFail = ''
      if (result.status === 'synced') notifyUser('همگام‌سازی با ابر انجام شد')
    }

    function schedulePush() {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        void round(true).catch(fail)
      }, 250)
    }

    function connect(session: { accessToken: string; userId: string }) {
      const cfg = supabaseConfig()
      const host = new URL(cfg.url).host
      const ws = new WebSocket(`wss://${host}/realtime/v1/websocket?apikey=${encodeURIComponent(cfg.key)}&vsn=1.0.0`)
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
        if (frame.event === 'postgres_changes') void round().catch(fail)
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
      await round(true)
      socket?.close()
      connect(session)
    }

    // round() without force returns early when the cloud version is the one we last saw.
    const poll = window.setInterval(() => {
      if (navigator.onLine && lastSeenVersion() >= 0) void round().catch(fail)
    }, 2500)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void round().catch(fail)
    }
    const onFocus = () => void round().catch(fail)
    const stopListen = onLocalChange(schedulePush)
    const onSession = () => {
      socket?.close()
      void start().catch(fail)
    }
    const onOnline = () => void start().catch(fail)
    window.addEventListener('hy-cloud-session', onSession)
    window.addEventListener('online', onOnline)
    window.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', onFocus)
    void start().catch(fail)

    return () => {
      closed = true
      registerSyncAccessors(null)
      window.clearInterval(poll)
      window.clearTimeout(timer)
      stopListen()
      window.removeEventListener('hy-cloud-session', onSession)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', onFocus)
      socket?.close()
    }
  }, [])

  return null
}
