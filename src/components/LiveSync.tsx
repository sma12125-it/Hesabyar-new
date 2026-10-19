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
  investments?: unknown
  dongEvents?: unknown
  cheques: unknown
  debts: unknown
  reminders: unknown
  cardVault: unknown
  currencyUnit?: string
  origin?: string
}

function mergeCollection<T extends { id: string; createdAt?: number; updatedAt?: number }>(
  local: unknown,
  remote: unknown,
  _remoteTime?: number,
): T[] {
  const remoteList = Array.isArray(remote) ? (remote as T[]) : []
  const localList = Array.isArray(local) ? (local as T[]) : []

  if (remoteList.length === 0) return localList
  if (localList.length === 0) return remoteList

  const remoteMap = new Map<string, T>()
  for (const item of remoteList) {
    if (item && item.id) remoteMap.set(item.id, item)
  }

  // Any local items that are newer or do not exist on remote yet
  const localMap = new Map<string, T>()
  for (const item of localList) {
    if (!item || !item.id) continue
    // If remote does not have this item at all, IT MUST BE PRESERVED!
    if (!remoteMap.has(item.id)) {
      localMap.set(item.id, item)
      continue
    }
    const itemTime = item.updatedAt ?? item.createdAt ?? 0
    const rItem = remoteMap.get(item.id)!
    const rTime = rItem.updatedAt ?? rItem.createdAt ?? 0
    if (itemTime > rTime) {
      localMap.set(item.id, item)
    }
  }

  const result: T[] = []
  for (const [id, rItem] of remoteMap.entries()) {
    const lItem = localMap.get(id)
    if (lItem) {
      result.push(lItem)
      localMap.delete(id)
    } else {
      result.push(rItem)
    }
  }
  for (const lItem of localMap.values()) {
    result.push(lItem)
  }
  return result
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
          investments: local.investments,
          dongEvents: local.dongEvents,
          cheques: local.cheques,
          debts: local.debts,
          reminders: local.reminders,
          cardVault: local.cardVault,
          currencyUnit: local.currencyUnit,
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

    async function applyRemote(force = false) {
      const session = await ensureSession()
      if (!session || closed) return
      const remote = await pullSnapshot<Payload>(session)
      if (!remote) {
        if (cloudDirty() || force) {
          await pushNow()
        }
        return
      }

      const remoteTime = remote.updatedAt
      const data = remote.data
      if (!data) return

      // If remote has newer data, or force pull on start/focus
      if ((remoteTime > lastSent || force) && (data.origin !== deviceId || force)) {
        const currentStore = storeRef.current
        const local = await extrasRef.current.exportLocal()

        // ادغام هوشمند و امن داده‌ها تا هیچ تراکنش یا حسابی حذف نشود
        const mergedAccounts = mergeCollection(currentStore.accounts, data.accounts, remoteTime)
        const mergedTransactions = mergeCollection(currentStore.transactions, data.transactions, remoteTime)
        const mergedPlans = mergeCollection(currentStore.plans, data.plans, remoteTime)
        const mergedItems = mergeCollection(currentStore.items, data.items, remoteTime)
        const mergedCategories = mergeCollection(currentStore.customCategories, data.customCategories, remoteTime)

        const mergedCheques = mergeCollection(local.cheques, data.cheques, remoteTime)
        const mergedDebts = mergeCollection(local.debts, data.debts, remoteTime)
        const mergedBudgets = mergeCollection(local.budgets, data.budgets, remoteTime)
        const mergedGoals = mergeCollection(local.goals, data.goals, remoteTime)
        const mergedInvestments = mergeCollection(local.investments, data.investments, remoteTime)
        const mergedDongEvents = mergeCollection(local.dongEvents, data.dongEvents, remoteTime)

        const hadLocalAdditions =
          mergedTransactions.length > (data.transactions?.length ?? 0) ||
          mergedAccounts.length > (data.accounts?.length ?? 0)

        await withoutSync(async () => {
          await storeRef.current.importCloud({
            accounts: mergedAccounts as any,
            transactions: mergedTransactions as any,
            plans: mergedPlans as any,
            items: mergedItems as any,
            customCategories: mergedCategories as any,
          })
          await extrasRef.current.importLocal({
            ...(data as unknown as Record<string, unknown>),
            cheques: mergedCheques,
            debts: mergedDebts,
            budgets: mergedBudgets,
            goals: mergedGoals,
            investments: mergedInvestments,
            dongEvents: mergedDongEvents,
          })
        })
        lastSent = remoteTime
        localStorage.setItem('hy-cloud-seen', String(lastSent))
        clearCloudDirty()

        // اگر تغییرات محلی ادغام شده بود، وضعیت جدید را به ابر ارسال کنیم
        if (hadLocalAdditions) {
          schedulePush()
        }

        notifyUser('همگام‌سازی با ابر انجام شد')
        return
      }

      if (cloudDirty()) {
        await pushNow()
      }
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
      await applyRemote(true)
      socket?.close()
      connect(session)
    }

    const poll = window.setInterval(() => {
      if (!navigator.onLine) return
      void applyRemote().catch(fail)
    }, 2500)

    const onVisibility = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        void applyRemote().catch(fail)
      }
    }
    const onFocus = () => {
      if (navigator.onLine) {
        void applyRemote().catch(fail)
      }
    }

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
    window.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', onFocus)
    void start().catch(fail)

    return () => {
      closed = true
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
