import { useEffect, useRef } from 'react'
import * as db from '../db/db'
import { syncProfile } from '../lib/profileCloud'
import {
  listSharedAssets,
  pullReadableDong,
  pushMemberDong,
  pushOwnerDong,
} from '../lib/profileApi'
import { isSharedDong, type SharedAssetView } from '../lib/profile'
import { replaceSharedAssets } from '../lib/shareInbox'
import { ensureSession, notifyUser, onLocalChange, supabaseConfig } from '../lib/sync'
import type { DongEvent } from '../types'
import { useExtras } from '../store/Extras'

export function ProfileSync() {
  const extras = useExtras()
  const extrasRef = useRef(extras)
  extrasRef.current = extras

  useEffect(() => {
    let closed = false
    let timer = 0
    let socket: WebSocket | null = null
    let pushing = false
    let told = ''

    function fail(err: unknown) {
      const message = err instanceof Error ? err.message : ''
      if (!message || message.includes('وارد حساب') || message.includes('SQL Editor')) return
      if (message === told) return
      told = message
      notifyUser(message)
    }

    async function pullDong() {
      const incoming = await pullReadableDong()
      if (closed) return
      await extrasRef.current.absorbSharedDong(incoming)
    }

    async function pullAssets() {
      const rows = await listSharedAssets()
      if (closed) return
      replaceSharedAssets(rows)
      await db.setKv('sharedAssets', rows)
    }

    async function pushSharedDong() {
      if (pushing || closed) return
      pushing = true
      try {
        const events = (await db.getKv<DongEvent[]>('dongEvents')) ?? extrasRef.current.dongEvents
        for (const event of events) {
          if (!isSharedDong(event)) continue
          if (event.shareRole === 'member') {
            await pushMemberDong(event)
          } else {
            const remoteId = await pushOwnerDong(event)
            if (remoteId && event.remoteId !== remoteId) {
              await extrasRef.current.saveDongEvent({ ...event, remoteId })
            }
          }
        }
      } finally {
        pushing = false
      }
    }

    async function refresh() {
      if (closed || !navigator.onLine) return
      const session = await ensureSession()
      if (!session || closed) return
      await syncProfile()
      if (closed) return
      try {
        await pullDong()
      } catch (err) {
        fail(err)
      }
      if (closed) return
      try {
        await pullAssets()
      } catch (err) {
        fail(err)
      }
    }

    function connect(session: { accessToken: string }) {
      const cfg = supabaseConfig()
      let host = ''
      try {
        host = new URL(cfg.url).host
      } catch {
        return
      }
      const ws = new WebSocket(`wss://${host}/realtime/v1/websocket?apikey=${encodeURIComponent(cfg.key)}&vsn=1.0.0`)
      socket = ws
      let ref = 0
      const send = (topic: string, event: string, payload: unknown) => {
        ref += 1
        ws.send(JSON.stringify({ topic, event, payload, ref: String(ref) }))
      }
      const tables = ['profiles', 'dong_events', 'dong_event_access', 'shared_assets']
      ws.onopen = () => {
        for (const table of tables) {
          send(`realtime:${table}`, 'phx_join', {
            config: {
              broadcast: { ack: false, self: false },
              presence: { enabled: false },
              postgres_changes: [{ event: '*', schema: 'public', table }],
            },
            access_token: session.accessToken,
          })
        }
      }
      ws.onmessage = (message) => {
        try {
          const frame = JSON.parse(String(message.data)) as { event?: string }
          if (frame.event === 'postgres_changes') void refresh().catch(fail)
        } catch {
          // Ignore a malformed realtime frame.
        }
      }
      const beat = window.setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) send('phoenix', 'heartbeat', {})
      }, 25000)
      ws.onclose = () => window.clearInterval(beat)
    }

    void db.getKv<SharedAssetView[]>('sharedAssets').then((rows) => {
      if (!closed && rows?.length) replaceSharedAssets(rows)
    })

    const stopListen = onLocalChange(() => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        void pushSharedDong().catch(fail)
      }, 400)
    })

    const poll = window.setInterval(() => {
      void refresh().catch(fail)
    }, 5000)
    const onWake = () => {
      if (document.visibilityState === 'hidden') return
      void refresh().catch(fail)
    }
    const onSession = () => {
      socket?.close()
      void (async () => {
        const session = await ensureSession()
        if (!session || closed) return
        connect(session)
        await refresh().catch(fail)
      })()
    }
    window.addEventListener('hy-cloud-session', onSession)
    window.addEventListener('online', onWake)
    window.addEventListener('visibilitychange', onWake)
    window.addEventListener('focus', onWake)
    onSession()

    return () => {
      closed = true
      window.clearInterval(poll)
      window.clearTimeout(timer)
      stopListen()
      socket?.close()
      window.removeEventListener('hy-cloud-session', onSession)
      window.removeEventListener('online', onWake)
      window.removeEventListener('visibilitychange', onWake)
      window.removeEventListener('focus', onWake)
    }
  }, [])

  return null
}
