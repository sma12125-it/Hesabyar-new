import { useState } from 'react'
import { lookupHandle, revokeDongShare, shareDongWithHandle } from '../lib/profileApi'
import { handleError, isDongGuest, normalizeHandle } from '../lib/profile'
import { notifyUser } from '../lib/sync'
import { useExtras } from '../store/Extras'
import type { DongEvent, DongParticipant } from '../types'

export function DongMemberShare({ event, participant }: { event: DongEvent; participant: DongParticipant }) {
  const { saveDongEvent } = useExtras()
  const link = event.memberLinks?.find((item) => item.participantId === participant.id)
  const [handle, setHandle] = useState('')
  const [busy, setBusy] = useState(false)
  const guest = isDongGuest(event)

  if (guest) {
    if (!link) return null
    return (
      <div className="share-note">
        متصل به شناسه <b>{link.handle}</b>
        {link.displayName ? ` · ${link.displayName}` : ''}
      </div>
    )
  }

  async function connect() {
    const clean = normalizeHandle(handle)
    const problem = handleError(clean)
    if (problem) {
      notifyUser(problem)
      return
    }
    setBusy(true)
    try {
      const found = await lookupHandle(clean)
      if (!found) {
        notifyUser('این شناسه در حسابیار پیدا نشد')
        return
      }
      const links = [
        ...(event.memberLinks ?? []).filter((item) => item.participantId !== participant.id && item.handle !== found.handle),
        { participantId: participant.id, handle: found.handle, displayName: found.displayName },
      ]
      const next: DongEvent = { ...event, memberLinks: links, linksUpdatedAt: Date.now() }
      const shared = await shareDongWithHandle(next, found.handle, participant.id)
      await saveDongEvent({ ...next, remoteId: shared.eventId, memberLinks: links, linksUpdatedAt: next.linksUpdatedAt })
      setHandle('')
      notifyUser(`${participant.name} به ${found.displayName} (${found.handle}) وصل شد و سفر را زنده می‌بیند`)
    } catch (err) {
      notifyUser(err instanceof Error ? err.message : 'اتصال انجام نشد')
    } finally {
      setBusy(false)
    }
  }

  async function revoke() {
    if (!link) return
    setBusy(true)
    try {
      await revokeDongShare(event.id, link.handle)
      const links = (event.memberLinks ?? []).filter((item) => item.participantId !== participant.id)
      await saveDongEvent({ ...event, memberLinks: links, linksUpdatedAt: Date.now() })
      notifyUser(`دسترسی ${link.handle} قطع شد`)
    } catch (err) {
      notifyUser(err instanceof Error ? err.message : 'قطع دسترسی انجام نشد')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="share-handle-row">
      {link ? (
        <>
          <span>
            شناسه: <b>{link.handle}</b>
            {link.displayName ? ` · ${link.displayName}` : ''}
          </span>
          <button className="cat-mini danger" type="button" disabled={busy} onClick={() => void revoke()}>
            قطع دسترسی
          </button>
        </>
      ) : (
        <>
          <input
            className="field-input"
            value={handle}
            placeholder="شناسه حسابیار عضو"
            aria-label={`شناسه حسابیار ${participant.name}`}
            onChange={(e) => setHandle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void connect()
              }
            }}
          />
          <button className="cat-mini" type="button" disabled={busy || !handle.trim()} onClick={() => void connect()}>
            {busy ? '…' : 'اتصال'}
          </button>
        </>
      )}
    </div>
  )
}
