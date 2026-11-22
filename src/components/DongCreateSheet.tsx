import { useState } from 'react'
import { WindowPopup } from './WindowPopup'
import { toFaDigits } from '../lib/money'
import { notifyUser } from '../lib/sync'
import { todayIso } from '../lib/iso'
import { useExtras } from '../store/Extras'
import type { DongEvent } from '../types'

interface DongCreateSheetProps {
  onClose: () => void
  onMinimize?: () => void
  onCreated?: (eventId: string) => void
}

export function DongCreateSheet({ onClose, onMinimize, onCreated }: DongCreateSheetProps) {
  const { saveDongEvent } = useExtras()
  const [dongTitle, setDongTitle] = useState('')
  const [dongMemberInput, setDongMemberInput] = useState('')
  const [dongMembers, setDongMembers] = useState<string[]>(['من'])
  const [editingMemberIdx, setEditingMemberIdx] = useState<number | null>(null)
  const [editingMemberName, setEditingMemberName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleAddMember = () => {
    const trimmed = dongMemberInput.trim()
    if (!trimmed) return
    if (dongMembers.includes(trimmed)) {
      setError('این نام قبلاً اضافه شده است')
      return
    }
    setDongMembers([...dongMembers, trimmed])
    setDongMemberInput('')
    setError(null)
  }

  const handleCreate = async () => {
    if (!dongTitle.trim()) {
      setError('عنوان رویداد الزامی است')
      return
    }
    if (dongMembers.length === 0) {
      setError('حداقل یک عضو برای رویداد الزامی است')
      return
    }

    setSaving(true)
    setError(null)
    try {
      const newEvent: Omit<DongEvent, 'id' | 'createdAt'> = {
        title: dongTitle.trim(),
        date: todayIso(),
        participants: dongMembers.map((name, i) => ({ id: `p_${Date.now()}_${i + 1}`, name })),
        expenses: [],
        settled: false,
      }
      const saved = await saveDongEvent(newEvent)
      notifyUser(`رویداد دونگ «${saved.title}» ساخته شد ✨`)
      onClose()
      if (onCreated) {
        onCreated(saved.id)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در ایجاد رویداد دونگ')
    } finally {
      setSaving(false)
    }
  }

  return (
    <WindowPopup
      title="ایجاد رویداد دونگ جدید"
      subtitle="سفر، مهمانی، دورهمی یا خریدهای مشترک"
      icon="👥"
      isOpen={true}
      onClose={onClose}
      onMinimize={onMinimize}
      defaultWidth={480}
      defaultHeight={540}
      footer={
        <div style={{ display: 'flex', gap: 8, width: '100%' }}>
          <button
            type="button"
            className="cat-mini"
            style={{ minWidth: 70 }}
            onClick={onClose}
          >
            انصراف
          </button>
          <button
            type="button"
            className="cta-confirm"
            disabled={saving || !dongTitle.trim()}
            onClick={() => void handleCreate()}
            style={{ flex: 1 }}
          >
            {saving ? 'در حال ثبت…' : '✨ ثبت و ایجاد رویداد دونگ'}
          </button>
        </div>
      }
    >
      <div className="sheet-body-scroll" style={{ padding: '6px 2px 18px', direction: 'rtl' }}>
        {error && (
          <div className="banner error" style={{ margin: '0 0 12px', fontSize: 12 }}>
            <span>⚠️ {error}</span>
          </div>
        )}

        <div className="field-stack">
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--hy-text)' }}>
            عنوان رویداد (سفر، دورهمی، خرید):
          </label>
          <input
            className="field-input"
            placeholder="مثلاً: سفر شمال، کافه جمعه، شام تولد"
            value={dongTitle}
            onChange={(e) => {
              setDongTitle(e.target.value)
              if (error) setError(null)
            }}
            autoFocus
          />

          <label style={{ fontSize: 12, fontWeight: 700, marginTop: 12, color: 'var(--hy-text)' }}>
            افراد حاضر در رویداد ({toFaDigits(dongMembers.length)} نفر):
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8, minHeight: 36 }}>
            {dongMembers.map((m, idx) => (
              <span
                key={idx}
                style={{
                  fontSize: 12,
                  padding: '4px 10px',
                  borderRadius: 10,
                  background: 'var(--hy-input-bg, rgba(37, 99, 235, 0.15))',
                  border: '1px solid var(--hy-border-color, rgba(255, 255, 255, 0.12))',
                  color: 'var(--hy-text)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {editingMemberIdx === idx ? (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <input
                      className="field-input"
                      style={{ height: 24, fontSize: 11, padding: '2px 4px', width: 75 }}
                      value={editingMemberName}
                      autoFocus
                      onChange={(e) => setEditingMemberName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && editingMemberName.trim()) {
                          e.preventDefault()
                          const updated = [...dongMembers]
                          updated[idx] = editingMemberName.trim()
                          setDongMembers(updated)
                          setEditingMemberIdx(null)
                        }
                      }}
                    />
                    <button
                      type="button"
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: 11,
                        color: 'var(--hy-income, #10b981)',
                      }}
                      onClick={() => {
                        if (editingMemberName.trim()) {
                          const updated = [...dongMembers]
                          updated[idx] = editingMemberName.trim()
                          setDongMembers(updated)
                        }
                        setEditingMemberIdx(null)
                      }}
                    >
                      ✓
                    </button>
                  </div>
                ) : (
                  <>
                    <span>👤 {m}</span>
                    <button
                      type="button"
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: 11,
                        opacity: 0.8,
                        color: 'var(--hy-text)',
                      }}
                      title="ویرایش نام"
                      onClick={() => {
                        setEditingMemberIdx(idx)
                        setEditingMemberName(m)
                      }}
                    >
                      ✏️
                    </button>
                    {dongMembers.length > 1 ? (
                      <button
                        type="button"
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: 11,
                          opacity: 0.7,
                          color: 'var(--hy-expense, #ef4444)',
                        }}
                        title="حذف فرد"
                        onClick={() => setDongMembers(dongMembers.filter((_, i) => i !== idx))}
                      >
                        ✕
                      </button>
                    ) : null}
                  </>
                )}
              </span>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            <input
              className="field-input"
              style={{ flex: 1, height: 38, fontSize: 12 }}
              placeholder="نام نفر جدید…"
              value={dongMemberInput}
              onChange={(e) => setDongMemberInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleAddMember()
                }
              }}
            />
            <button
              className="cat-mini"
              type="button"
              onClick={handleAddMember}
              style={{ height: 38, padding: '0 14px' }}
            >
              + افزودن فرد
            </button>
          </div>
        </div>
      </div>
    </WindowPopup>
  )
}
