import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { SettingsButton } from '../components/SettingsButton'
import { WindowPopup } from '../components/WindowPopup'
import { DongMemberShare } from '../components/DongMemberShare'
import { MadreKharjSetup, MadreKharjOverview, MemberPotFigures } from '../components/MadreKharjSetup'
import {
  computeDongSettlement,
  defaultDongPayerId,
  dongPayerLabel,
  emptyDongSummary,
  isMadreKharjEnabled,
  memberHasPotRole,
  MADRE_KHARJ_PAYER_ID,
} from '../lib/dong'
import { isDongGuest } from '../lib/profile'
import { toFaDigits, digitsOnly, formatSeparatedNumber } from '../lib/money'
import { notifyUser } from '../lib/sync'
import { createId } from '../lib/ids'
import { todayIso } from '../lib/iso'
import { useExtras } from '../store/Extras'
import type { DongEvent, DongExpenseItem } from '../types'

export function DongPage({ onScroll }: { onScroll?: (compact: boolean) => void }) {
  const { id: urlDongId } = useParams()
  const {
    dongEvents,
    saveDongEvent,
    deleteDongEvent,
    currencyUnit,
    unitLabel,
    formatMoney,
  } = useExtras()

  const parseAmountToRials = (val: string): number => {
    const raw = Number(digitsOnly(val))
    if (isNaN(raw) || raw <= 0) return 0
    return currencyUnit === 'IRT' ? raw * 10 : raw
  }

  const [dongFilter, setDongFilter] = useState<'active' | 'settled'>('active')
  const [selectedDongId, setSelectedDongId] = useState<string | null>(null)
  const [isCreateDongOpen, setIsCreateDongOpen] = useState(false)
  const [dongTitle, setDongTitle] = useState('')
  const [dongMemberInput, setDongMemberInput] = useState('')
  const [dongMembers, setDongMembers] = useState<string[]>(['من'])
  const [editingMemberIdx, setEditingMemberIdx] = useState<number | null>(null)
  const [editingMemberName, setEditingMemberName] = useState('')

  // Selected Dong detail view states
  const selectedDongEvent = useMemo(
    () => (selectedDongId ? dongEvents.find((d) => d.id === selectedDongId) : null),
    [dongEvents, selectedDongId]
  )
  const dongSummary = useMemo(() => {
    if (!selectedDongEvent) return emptyDongSummary()
    return computeDongSettlement(selectedDongEvent)
  }, [selectedDongEvent])

  const [settlementViewMode, setSettlementViewMode] = useState<'group' | 'individual'>('group')
  const activeDongTransfers = useMemo(() => {
    if (settlementViewMode === 'group' && (selectedDongEvent?.groups?.length || 0) > 0) {
      return dongSummary.groupTransfers
    }
    return dongSummary.transfers
  }, [dongSummary, settlementViewMode, selectedDongEvent])

  // Dong Modals & Grouping UI State
  const [isDongExpenseModalOpen, setIsDongExpenseModalOpen] = useState(false)
  const [isDongMembersAndGroupsModalOpen, setIsDongMembersAndGroupsModalOpen] = useState(false)
  const [membersModalTab, setMembersModalTab] = useState<'members' | 'groups' | 'madre'>('members')
  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<string>>(new Set())
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
  const [groupNameInput, setGroupNameInput] = useState('')
  const [groupSelectedMemberIds, setGroupSelectedMemberIds] = useState<string[]>([])

  const [editingParticipantId, setEditingParticipantId] = useState<string | null>(null)
  const [editingParticipantName, setEditingParticipantName] = useState('')
  const [eventNewMemberInput, setEventNewMemberInput] = useState('')

  // Expense form states
  const [editingExpId, setEditingExpId] = useState<string | null>(null)
  const [newExpTitle, setNewExpTitle] = useState('')
  const [newExpAmount, setNewExpAmount] = useState('')
  const [newExpPayer, setNewExpPayer] = useState('')
  const [newExpSplits, setNewExpSplits] = useState<string[]>([])
  const [newExpSplitMode, setNewExpSplitMode] = useState<'equal' | 'custom'>('equal')
  const [newExpCustomAmounts, setNewExpCustomAmounts] = useState<Record<string, string>>({})
  const [manualEditedIds, setManualEditedIds] = useState<Set<string>>(new Set())

  // Automatic balanced distribution for "تقسیم دستی"
  const recalculateManualDistribution = (
    totalUnits: number,
    splits: string[],
    manuallyEdited: Set<string>,
    currentAmounts: Record<string, string>
  ) => {
    if (splits.length === 0) return currentAmounts
    const nextAmounts: Record<string, string> = { ...currentAmounts }

    let sumManualUnits = 0
    const autoIds: string[] = []

    for (const id of splits) {
      if (manuallyEdited.has(id)) {
        const valUnits = Number(digitsOnly(nextAmounts[id] ?? '0')) || 0
        sumManualUnits += valUnits
      } else {
        autoIds.push(id)
      }
    }

    if (autoIds.length > 0) {
      const remainingUnits = Math.max(0, totalUnits - sumManualUnits)
      const basePerUserUnits = Math.floor(remainingUnits / autoIds.length)
      const remainderUnits = remainingUnits % autoIds.length

      autoIds.forEach((id, idx) => {
        const userUnits = basePerUserUnits + (idx < remainderUnits ? 1 : 0)
        nextAmounts[id] = formatSeparatedNumber(userUnits)
      })
    }

    return nextAmounts
  }

  // Handle total amount change in expense form
  const handleExpenseAmountChange = (rawText: string) => {
    const formatted = formatSeparatedNumber(rawText)
    setNewExpAmount(formatted)
    if (newExpSplitMode === 'custom' && selectedDongEvent) {
      const splits = newExpSplits.length > 0 ? newExpSplits : selectedDongEvent.participants.map((p) => p.id)
      const totalUnits = Number(digitsOnly(formatted)) || 0
      const updated = recalculateManualDistribution(totalUnits, splits, manualEditedIds, newExpCustomAmounts)
      setNewExpCustomAmounts(updated)
    }
  }

  // Reset custom amounts back to equal distribution
  const resetCustomAmountsToEqual = () => {
    if (!selectedDongEvent) return
    const splits = newExpSplits.length > 0 ? newExpSplits : selectedDongEvent.participants.map((p) => p.id)
    const totalUnits = Number(digitsOnly(newExpAmount)) || 0
    setManualEditedIds(new Set())
    const balanced = recalculateManualDistribution(totalUnits, splits, new Set(), {})
    setNewExpCustomAmounts(balanced)
  }

  // Handle individual user manual amount change
  const handleUserCustomAmountChange = (participantId: string, val: string) => {
    const formatted = formatSeparatedNumber(val)
    const splits = selectedDongEvent
      ? (newExpSplits.length > 0 ? newExpSplits : selectedDongEvent.participants.map((p) => p.id))
      : []

    const nextEdited = new Set(manualEditedIds)
    if (digitsOnly(val) === '') {
      nextEdited.delete(participantId)
    } else {
      nextEdited.add(participantId)
      if (nextEdited.size >= splits.length && splits.length > 1) {
        nextEdited.clear()
        nextEdited.add(participantId)
      }
    }
    setManualEditedIds(nextEdited)

    const updatedAmounts = { ...newExpCustomAmounts, [participantId]: formatted }
    if (selectedDongEvent) {
      const totalUnits = Number(digitsOnly(newExpAmount)) || 0
      const balanced = recalculateManualDistribution(totalUnits, splits, nextEdited, updatedAmounts)
      setNewExpCustomAmounts(balanced)
    } else {
      setNewExpCustomAmounts(updatedAmounts)
    }
  }


  // If URL param is set, sync it with selectedDongId
  if (urlDongId && selectedDongId !== urlDongId) {
    const exists = dongEvents.some((d) => d.id === urlDongId)
    if (exists) {
      setSelectedDongId(urlDongId)
    }
  }

  return (
    <div className="app-scroll page-dong" onScroll={(e) => onScroll?.(e.currentTarget.scrollTop > 28)}>
      {/* Top Header */}
      <div className="top-row">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h1>محاسبه دونگ و سفر</h1>
            <span
              style={{
                fontSize: 11,
                padding: '2px 8px',
                borderRadius: 8,
                background: 'rgba(37, 99, 235, 0.15)',
                color: 'var(--hy-accent)',
                fontWeight: 700,
              }}
            >
              👥 گروهی
            </span>
          </div>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--hy-text-secondary)' }}>
            تقسیم هزینه‌های گروهی، تعیین مادرخرج، تراز حساب‌ها و تسویه بدهی‌ها
          </p>
        </div>
        <SettingsButton showLabel={true} />
      </div>

        <div>
          {/* If NO event is selected: ONLY display list of events and "+ New Event" button */}
          {!selectedDongEvent ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                {/* Active vs Settled Events Filter */}
                <div className="seg" style={{ margin: 0, padding: 2 }}>
                  <button
                    className={`seg-btn${dongFilter === 'active' ? ' active' : ''}`}
                    type="button"
                    onClick={() => setDongFilter('active')}
                    style={{ fontSize: 12, padding: '4px 14px' }}
                  >
                    👥 رویدادهای فعال ({toFaDigits(dongEvents.filter((d) => !d.settled).length)})
                  </button>
                  <button
                    className={`seg-btn${dongFilter === 'settled' ? ' active' : ''}`}
                    type="button"
                    onClick={() => setDongFilter('settled')}
                    style={{ fontSize: 12, padding: '4px 14px' }}
                  >
                    ✓ تسویه شده ({toFaDigits(dongEvents.filter((d) => d.settled).length)})
                  </button>
                </div>

                <button
                  className="cta-confirm"
                  type="button"
                  style={{ height: 36, fontSize: 12, padding: '0 14px' }}
                  onClick={() => {
                    setDongTitle('')
                    setDongMembers(['من'])
                    setDongMemberInput('')
                    setIsCreateDongOpen(true)
                  }}
                >
                  + رویداد جدید
                </button>
              </div>

              {/* Events List */}
              <section className="lg report-card">
                {dongEvents.filter((d) => (dongFilter === 'active' ? !d.settled : d.settled)).length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '36px 14px', color: 'var(--hy-text-secondary)' }}>
                    <span style={{ fontSize: 36 }}>👥</span>
                    <p style={{ marginTop: 8 }}>
                      {dongFilter === 'active'
                        ? 'هیچ رویداد فعالی وجود ندارد.'
                        : 'رویداد تسویه‌شده‌ای موجود نیست.'}
                    </p>
                    {dongFilter === 'active' ? (
                      <button
                        className="cat-mini"
                        type="button"
                        style={{ marginTop: 8 }}
                        onClick={() => setIsCreateDongOpen(true)}
                      >
                        + ایجاد اولین رویداد دونگ
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {dongEvents
                      .filter((d) => (dongFilter === 'active' ? !d.settled : d.settled))
                      .map((evt) => {
                        const totalCost = evt.expenses.reduce((sum, e) => sum + e.amount, 0)
                        return (
                          <div
                            key={evt.id}
                            style={{
                              padding: '12px 16px',
                              borderRadius: 14,
                              background: 'rgba(255,255,255,0.04)',
                              border: '1px solid rgba(255,255,255,0.08)',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                            }}
                            onClick={() => setSelectedDongId(evt.id)}
                          >
                            <div>
                              <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--hy-text)' }}>
                                {evt.title}
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--hy-text-secondary)', marginTop: 4 }}>
                                <span>{toFaDigits(evt.participants.length)} نفر حاضر</span>
                                <span style={{ margin: '0 6px', opacity: 0.5 }}>·</span>
                                <span>کل مخارج: <b>{formatMoney(totalCost)}</b></span>
                                {isMadreKharjEnabled(evt) ? (
                                  <span style={{ color: 'var(--hy-accent)', marginRight: 8, fontWeight: 700 }}>
                                    مادرخرج
                                  </span>
                                ) : null}
                                {evt.shareRole === 'member' ? (
                                  <span style={{ color: 'var(--hy-accent)', marginRight: 8, fontWeight: 700 }}>
                                    اشتراکی
                                  </span>
                                ) : null}
                                {evt.memberLinks && evt.memberLinks.length > 0 ? (
                                  <span style={{ color: 'var(--hy-accent)', marginRight: 8, fontWeight: 700 }}>
                                    شناسه
                                  </span>
                                ) : null}
                                {evt.settled ? (
                                  <span style={{ color: 'var(--hy-income)', marginRight: 8, fontWeight: 700 }}>
                                    ✓ تسویه شده
                                  </span>
                                ) : (
                                  <span style={{ color: 'var(--hy-accent)', marginRight: 8 }}>
                                    در جریان
                                  </span>
                                )}
                              </div>
                            </div>

                            <div style={{ display: 'flex', gap: 6 }} onClick={(e) => e.stopPropagation()}>
                              <button
                                className="cat-mini"
                                type="button"
                                onClick={() => setSelectedDongId(evt.id)}
                              >
                                مشاهده و تسویه ←
                              </button>
                              {evt.shareRole === 'member' ? null : (
                                <button
                                  className="cat-mini"
                                  type="button"
                                  title={evt.settled ? 'بازگردانی به رویدادهای فعال' : 'اتمام و انتقال به تسویه شده'}
                                  onClick={() => {
                                    void saveDongEvent({ ...evt, settled: !evt.settled })
                                    notifyUser(evt.settled ? 'رویداد به حالت فعال برگشت' : 'رویداد پایان یافت و تسویه شد')
                                  }}
                                >
                                  {evt.settled ? '↺ فعال کردن' : '✓ پایان و تسویه'}
                                </button>
                              )}
                              {evt.shareRole === 'member' ? null : (
                                <button
                                  className="cat-mini danger"
                                  type="button"
                                  onClick={() => {
                                    if (confirm(`آیا از حذف رویداد «${evt.title}» اطمینان دارید؟`)) {
                                      void deleteDongEvent(evt.id)
                                      notifyUser('رویداد حذف شد')
                                    }
                                  }}
                                >
                                  حذف
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                  </div>
                )}
              </section>

              {/* Modal for Creating New Dong Event */}
              {isCreateDongOpen && (
                <WindowPopup
                  title="ایجاد رویداد دونگ جدید"
                  subtitle="سفر، مهمانی، دورهمی یا خریدهای مشترک"
                  icon="👥"
                  isOpen={true}
                  onClose={() => setIsCreateDongOpen(false)}
                  defaultWidth={480}
                  defaultHeight={520}
                >
                  <div className="sheet-body-scroll" style={{ padding: '4px 0 16px' }}>
                    <div className="field-stack">
                      <label style={{ fontSize: 12, fontWeight: 700 }}>عنوان رویداد:</label>
                      <input
                        className="field-input"
                        placeholder="مثلاً: سفر شمال، کافه جمعه، شام تولد"
                        value={dongTitle}
                        onChange={(e) => setDongTitle(e.target.value)}
                      />

                      <label style={{ fontSize: 12, fontWeight: 700, marginTop: 6 }}>
                        افراد حاضر در رویداد ({toFaDigits(dongMembers.length)} نفر):
                      </label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                        {dongMembers.map((m, idx) => (
                          <span
                            key={idx}
                            style={{
                              fontSize: 12,
                              padding: '4px 10px',
                              borderRadius: 10,
                              background: 'rgba(37, 99, 235, 0.2)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                            }}
                          >
                            {editingMemberIdx === idx ? (
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <input
                                  className="field-input"
                                  style={{ height: 24, fontSize: 11, padding: '2px 4px', width: 70 }}
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
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--hy-income)' }}
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
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, opacity: 0.8 }}
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
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, opacity: 0.7 }}
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
                          style={{ flex: 1, height: 34, fontSize: 12 }}
                          placeholder="نام نفر جدید…"
                          value={dongMemberInput}
                          onChange={(e) => setDongMemberInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && dongMemberInput.trim()) {
                              e.preventDefault()
                              if (!dongMembers.includes(dongMemberInput.trim())) {
                                setDongMembers([...dongMembers, dongMemberInput.trim()])
                              }
                              setDongMemberInput('')
                            }
                          }}
                        />
                        <button
                          className="cat-mini"
                          type="button"
                          onClick={() => {
                            if (dongMemberInput.trim() && !dongMembers.includes(dongMemberInput.trim())) {
                              setDongMembers([...dongMembers, dongMemberInput.trim()])
                              setDongMemberInput('')
                            }
                          }}
                        >
                          + افزودن فرد
                        </button>
                      </div>

                      <button
                        className="cta-confirm"
                        type="button"
                        style={{ marginTop: 14 }}
                        onClick={() => {
                          if (!dongTitle.trim() || dongMembers.length === 0) {
                            notifyUser('عنوان رویداد و حداقل یک عضو الزامی است')
                            return
                          }
                          const newEvent: Omit<DongEvent, 'id' | 'createdAt'> = {
                            title: dongTitle.trim(),
                            date: todayIso(),
                            participants: dongMembers.map((name, i) => ({ id: `p_${Date.now()}_${i + 1}`, name })),
                            expenses: [],
                            settled: false,
                          }
                          void saveDongEvent(newEvent).then((saved) => {
                            setSelectedDongId(saved.id)
                            setIsCreateDongOpen(false)
                            setMembersModalTab('groups')
                            setIsDongMembersAndGroupsModalOpen(true)
                            notifyUser('رویداد ساخته شد. گروه‌ها را مشخص کنید؛ تعیین مادرخرج در مرحله بعد اختیاری است.')
                          })
                        }}
                      >
                        ثبت و ایجاد رویداد دونگ
                      </button>
                    </div>
                  </div>
                </WindowPopup>
              )}
            </div>
          ) : (
            /* Dedicated Event Detail View */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Event Header & Back Button */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'var(--glass-chrome)',
                  padding: '12px 16px',
                  borderRadius: 16,
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    className="cat-mini"
                    type="button"
                    onClick={() => setSelectedDongId(null)}
                    style={{ fontWeight: 700 }}
                  >
                    ← بازگشت به لیست رویدادها
                  </button>
                  <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{selectedDongEvent.title}</h2>
                  {selectedDongEvent.settled ? (
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, background: 'rgba(16, 185, 129, 0.2)', color: 'var(--hy-income)', fontWeight: 700 }}>
                      ✓ تسویه شده
                    </span>
                  ) : (
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, background: 'rgba(37, 99, 235, 0.2)', color: 'var(--hy-accent)' }}>
                      در جریان
                    </span>
                  )}
                </div>

                {isDongGuest(selectedDongEvent) ? (
                  <span className="share-note">این سفر با شما به اشتراک گذاشته شده</span>
                ) : (
                  <button
                    className="cat-mini"
                    type="button"
                    style={{
                      background: selectedDongEvent.settled ? 'rgba(16, 185, 129, 0.18)' : 'rgba(255,255,255,0.1)',
                      color: selectedDongEvent.settled ? 'var(--hy-income)' : 'var(--hy-text)',
                    }}
                    onClick={() => {
                      void saveDongEvent({ ...selectedDongEvent, settled: !selectedDongEvent.settled })
                      notifyUser(selectedDongEvent.settled ? 'رویداد به حالت فعال بازگردانده شد' : 'رویداد تسویه اعلام شد')
                    }}
                  >
                    {selectedDongEvent.settled ? '↺ بازگردانی به فعال' : '✓ پایان و علامت تسویه'}
                  </button>
                )}
              </div>

              {/* Quick Actions & Event Summary Bar */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: 10,
                  alignItems: 'stretch',
                }}
              >
                {/* Button: Add Expense */}
                <button
                  type="button"
                  className="cta-confirm"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    fontSize: 14,
                    fontWeight: 800,
                    padding: '12px 18px',
                    borderRadius: 14,
                    background: 'linear-gradient(135deg, var(--hy-accent) 0%, #1d4ed8 100%)',
                    boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
                    cursor: 'pointer',
                  }}
                  onClick={() => {
                    setEditingExpId(null)
                    setNewExpTitle('')
                    setNewExpAmount('')
                    setNewExpPayer(defaultDongPayerId(selectedDongEvent))
                    setNewExpSplits(selectedDongEvent.participants.map((p) => p.id))
                    setNewExpSplitMode('equal')
                    setNewExpCustomAmounts({})
                    setManualEditedIds(new Set())
                    setIsDongExpenseModalOpen(true)
                  }}
                >
                  <span style={{ fontSize: 18 }}>＋</span>
                  <span>ثبت خرج جدید</span>
                </button>

                {/* Button: Manage Members & Groups */}
                <button
                  type="button"
                  className="cat-mini"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    fontSize: 13,
                    fontWeight: 800,
                    padding: '12px 18px',
                    borderRadius: 14,
                    background: 'rgba(255, 255, 255, 0.07)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    cursor: 'pointer',
                    color: 'var(--hy-text)',
                  }}
                  onClick={() => {
                    setMembersModalTab('members')
                    setIsDongMembersAndGroupsModalOpen(true)
                  }}
                >
                  <span style={{ fontSize: 16 }}>👥</span>
                  <span>
                    تنظیم گروه ({toFaDigits(selectedDongEvent.participants.length)} نفر
                    {selectedDongEvent.groups && selectedDongEvent.groups.length > 0
                      ? ` · ${toFaDigits(selectedDongEvent.groups.length)} گروه`
                      : ''}
                    {isMadreKharjEnabled(selectedDongEvent) ? ' · مادرخرج' : ''}
                    )
                  </span>
                </button>
              </div>

              <div className="madre-card" style={{ padding: '10px 12px' }}>
                <div style={{ fontSize: 11, color: 'var(--hy-text-secondary)', marginBottom: 6 }}>
                  مراحل تنظیم گروه: افراد، سپس گروه‌ها، و بعد مادرخرج که اختیاری است
                </div>
                <div className="seg" style={{ margin: 0 }}>
                  <button
                    type="button"
                    className="seg-btn"
                    style={{ fontSize: 12, padding: '6px 4px' }}
                    onClick={() => {
                      setMembersModalTab('members')
                      setIsDongMembersAndGroupsModalOpen(true)
                    }}
                  >
                    ۱. افراد
                  </button>
                  <button
                    type="button"
                    className="seg-btn"
                    style={{ fontSize: 12, padding: '6px 4px' }}
                    onClick={() => {
                      setMembersModalTab('groups')
                      setIsDongMembersAndGroupsModalOpen(true)
                    }}
                  >
                    ۲. گروه‌ها
                  </button>
                  <button
                    type="button"
                    className={`seg-btn${isMadreKharjEnabled(selectedDongEvent) ? ' active' : ''}`}
                    style={{ fontSize: 12, padding: '6px 4px' }}
                    onClick={() => {
                      setMembersModalTab('madre')
                      setIsDongMembersAndGroupsModalOpen(true)
                    }}
                  >
                    ۳. مادرخرج{isMadreKharjEnabled(selectedDongEvent) ? ' ✓' : ' (اختیاری)'}
                  </button>
                </div>
              </div>

              {/* Event KPI Strip */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                  gap: 8,
                }}
              >
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: 12,
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                  }}
                >
                  <div style={{ fontSize: 10, color: 'var(--hy-text-secondary)', marginBottom: 2 }}>مجموع مخارج کل</div>
                  <div style={{ fontSize: 15, fontWeight: 900, color: 'var(--hy-text)' }}>
                    {formatMoney(dongSummary.totalCost)}
                  </div>
                </div>

                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: 12,
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    cursor: 'pointer',
                  }}
                  onClick={() => {
                    setMembersModalTab('members')
                    setIsDongMembersAndGroupsModalOpen(true)
                  }}
                  title="مدیریت اعضا"
                >
                  <div style={{ fontSize: 10, color: 'var(--hy-text-secondary)', marginBottom: 2 }}>تعداد افراد حاضر</div>
                  <div style={{ fontSize: 15, fontWeight: 900, color: 'var(--hy-accent)' }}>
                    {toFaDigits(selectedDongEvent.participants.length)} نفر
                  </div>
                </div>

                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: 12,
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    cursor: 'pointer',
                  }}
                  onClick={() => {
                    setMembersModalTab('groups')
                    setIsDongMembersAndGroupsModalOpen(true)
                  }}
                  title="مدیریت گروه‌ها"
                >
                  <div style={{ fontSize: 10, color: 'var(--hy-text-secondary)', marginBottom: 2 }}>گروه‌های تعریف‌شده</div>
                  <div style={{ fontSize: 15, fontWeight: 900, color: '#38bdf8' }}>
                    {selectedDongEvent.groups && selectedDongEvent.groups.length > 0
                      ? `${toFaDigits(selectedDongEvent.groups.length)} گروه`
                      : 'بدون گروه (تعریف گروه +)'}
                  </div>
                </div>

                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: 12,
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                  }}
                >
                  <div style={{ fontSize: 10, color: 'var(--hy-text-secondary)', marginBottom: 2 }}>تعداد تراکنش‌های تسویه</div>
                  <div style={{ fontSize: 15, fontWeight: 900, color: 'var(--hy-income)' }}>
                    {toFaDigits(activeDongTransfers.length)} پرداخت
                  </div>
                </div>

                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: 12,
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    cursor: 'pointer',
                  }}
                  onClick={() => {
                    setMembersModalTab('madre')
                    setIsDongMembersAndGroupsModalOpen(true)
                  }}
                  title="تعیین مادرخرج"
                >
                  <div style={{ fontSize: 10, color: 'var(--hy-text-secondary)', marginBottom: 2 }}>
                    {dongSummary.potActive ? 'موجودی مادرخرج' : 'مادرخرج (اختیاری)'}
                  </div>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 900,
                      color: dongSummary.potBalance < 0 ? 'var(--hy-expense)' : dongSummary.potActive ? 'var(--hy-income)' : 'var(--hy-text-secondary)',
                    }}
                  >
                    {dongSummary.potActive ? formatMoney(dongSummary.potBalance) : 'تعیین نشده'}
                  </div>
                </div>
              </div>

              {/* Expense List with Edit & Delete */}
              <div
                style={{
                  padding: 16,
                  borderRadius: 16,
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <h3 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 10px' }}>
                  ریز مخارج رویداد ({toFaDigits(selectedDongEvent.expenses.length)} مورد)
                </h3>
                {selectedDongEvent.expenses.length === 0 ? (
                  <p className="sheet-sub" style={{ margin: 0 }}>
                    هنوز خرجی در این رویداد ثبت نشده است.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {selectedDongEvent.expenses.map((exp) => {
                      const payerName = dongPayerLabel(selectedDongEvent, exp.paidById)
                      return (
                        <div
                          key={exp.id}
                          style={{
                            padding: '10px 14px',
                            borderRadius: 12,
                            background: 'rgba(0,0,0,0.18)',
                            border: '1px solid rgba(255,255,255,0.06)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontWeight: 800, fontSize: 14 }}>{exp.title}</span>
                              <span
                                style={{
                                  fontSize: 10,
                                  padding: '1px 6px',
                                  borderRadius: 6,
                                  background: exp.splitMode === 'custom' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(15, 118, 110, 0.15)',
                                  color: exp.splitMode === 'custom' ? '#38bdf8' : 'var(--hy-teal)',
                                  fontWeight: 700,
                                }}
                              >
                                {exp.splitMode === 'custom' ? 'تقسیم دستی' : 'تقسیم مساوی'}
                              </span>
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--hy-text-secondary)', marginTop: 4 }}>
                              <span>پرداخت توسط: <b>{payerName}</b></span>
                              <span style={{ margin: '0 6px', opacity: 0.5 }}>·</span>
                              <span>
                                سهم ({toFaDigits(exp.splitAmongIds.length)} نفر):{' '}
                                {exp.splitAmongIds
                                  .map((id) => {
                                    const part = selectedDongEvent.participants.find((p) => p.id === id)
                                    if (exp.splitMode === 'custom' && exp.customShares && exp.customShares[id] !== undefined) {
                                      return `${part?.name ?? id} (${formatMoney(exp.customShares[id]!)})`
                                    }
                                    return part?.name ?? id
                                  })
                                  .join('، ')}
                              </span>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--hy-text)' }}>
                              {formatMoney(exp.amount)}
                            </span>
                            <button
                              className="cat-mini"
                              type="button"
                              onClick={() => {
                                // Load expense for editing
                                setEditingExpId(exp.id)
                                setNewExpTitle(exp.title)
                                const unitMultiplier = currencyUnit === 'IRT' ? 10 : 1
                                setNewExpAmount(formatSeparatedNumber(Math.round(exp.amount / unitMultiplier)))
                                setNewExpPayer(exp.paidById)
                                setNewExpSplits(exp.splitAmongIds)
                                setNewExpSplitMode(exp.splitMode || 'equal')
                                if (exp.customShares) {
                                  const formattedMap: Record<string, string> = {}
                                  for (const [uid, amt] of Object.entries(exp.customShares)) {
                                    formattedMap[uid] = formatSeparatedNumber(Math.round(amt / unitMultiplier))
                                  }
                                  setNewExpCustomAmounts(formattedMap)
                                  setManualEditedIds(new Set())
                                } else {
                                  setNewExpCustomAmounts({})
                                  setManualEditedIds(new Set())
                                }
                                setIsDongExpenseModalOpen(true)
                                notifyUser(`در حال ویرایش: ${exp.title}`)
                              }}
                            >
                              ویرایش
                            </button>
                            <button
                              className="cat-mini danger"
                              type="button"
                              onClick={() => {
                                if (confirm(`آیا از حذف خرج «${exp.title}» اطمینان دارید؟`)) {
                                  const updated = {
                                    ...selectedDongEvent,
                                    expenses: selectedDongEvent.expenses.filter((e) => e.id !== exp.id),
                                  }
                                  void saveDongEvent(updated)
                                  notifyUser('خرج حذف شد')
                                }
                              }}
                            >
                              حذف
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              <MadreKharjOverview
                event={selectedDongEvent}
                summary={dongSummary}
                formatMoney={formatMoney}
                onEdit={() => {
                  setMembersModalTab('madre')
                  setIsDongMembersAndGroupsModalOpen(true)
                }}
              />

              {/* Participant & Group Balances Section */}
              <div
                style={{
                  padding: 16,
                  borderRadius: 16,
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 16 }}>📊</span>
                    <h3 style={{ fontSize: 14, fontWeight: 800, margin: 0 }}>
                      تراز و سهم اعضا و گروه‌ها در این رویداد
                    </h3>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: 'var(--hy-text-secondary)' }}>
                      مجموع مخارج کل: <b>{formatMoney(dongSummary.totalCost)}</b>
                    </span>
                    <button
                      type="button"
                      className="cat-mini"
                      style={{ fontSize: 11, padding: '3px 10px' }}
                      onClick={() => {
                        setMembersModalTab('groups')
                        setIsDongMembersAndGroupsModalOpen(true)
                      }}
                    >
                      ⚙️ مدیریت گروه‌ها
                    </button>
                  </div>
                </div>

                {/* If Groups are Defined: Render Groups First with Accordion, then Ungrouped */}
                {selectedDongEvent.groups && selectedDongEvent.groups.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--hy-text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>👥 تراز تجمیعی گروه‌ها</span>
                      <span style={{ fontSize: 11, opacity: 0.8 }}>(برای مشاهده تفکیک اعضا، روی هر گروه کلیک کنید)</span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10 }}>
                      {dongSummary.groupBalances.map((gb) => {
                        const isCreditor = gb.net > 5
                        const isDebtor = gb.net < -5
                        const isExpanded = expandedGroupIds.has(gb.id)

                        return (
                          <div
                            key={gb.id}
                            style={{
                              padding: '12px 14px',
                              borderRadius: 14,
                              background: isCreditor
                                ? 'rgba(16, 185, 129, 0.1)'
                                : isDebtor
                                ? 'rgba(239, 68, 68, 0.1)'
                                : 'rgba(255, 255, 255, 0.04)',
                              border: isCreditor
                                ? '1px solid rgba(16, 185, 129, 0.3)'
                                : isDebtor
                                ? '1px solid rgba(239, 68, 68, 0.3)'
                                : '1px solid rgba(255, 255, 255, 0.1)',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                            }}
                            onClick={() => {
                              setExpandedGroupIds((prev) => {
                                const next = new Set(prev)
                                if (next.has(gb.id)) next.delete(gb.id)
                                else next.add(gb.id)
                                return next
                              })
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontWeight: 800, fontSize: 14 }}>گروه {gb.name}</span>
                                <span
                                  style={{
                                    fontSize: 10,
                                    padding: '1px 6px',
                                    borderRadius: 6,
                                    background: 'rgba(37, 99, 235, 0.2)',
                                    color: 'var(--hy-accent)',
                                    fontWeight: 700,
                                  }}
                                >
                                  {toFaDigits(gb.memberIds.length)} عضو
                                </span>
                              </div>
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  padding: '2px 8px',
                                  borderRadius: 6,
                                  background: isCreditor
                                    ? 'rgba(16, 185, 129, 0.2)'
                                    : isDebtor
                                    ? 'rgba(239, 68, 68, 0.2)'
                                    : 'rgba(255, 255, 255, 0.1)',
                                  color: isCreditor ? 'var(--hy-income)' : isDebtor ? 'var(--hy-expense)' : 'var(--hy-text-secondary)',
                                }}
                              >
                                {isCreditor ? 'طلبکار' : isDebtor ? 'بدهکار' : 'بی‌حساب'}
                              </span>
                            </div>

                            <div style={{ fontSize: 11, color: 'var(--hy-text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                              <span>مجموع پرداختی گروه:</span>
                              <b>{formatMoney(gb.paid)}</b>
                            </div>
                            <MemberPotFigures deposits={gb.deposits} deficitCovered={gb.deficitCovered} formatMoney={formatMoney} />
                            <div style={{ fontSize: 11, color: 'var(--hy-text-secondary)', display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                              <span>مجموع سهم مصرفی گروه:</span>
                              <b>{formatMoney(gb.share)}</b>
                            </div>
                            <div
                              style={{
                                fontSize: 13,
                                fontWeight: 800,
                                display: 'flex',
                                justifyContent: 'space-between',
                                marginTop: 6,
                                paddingTop: 6,
                                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                                color: isCreditor ? 'var(--hy-income)' : isDebtor ? 'var(--hy-expense)' : 'var(--hy-text-secondary)',
                              }}
                            >
                              <span>تراز نهایی کل گروه:</span>
                              <span>
                                {isCreditor ? '+' : ''}
                                {formatMoney(gb.net)}
                              </span>
                            </div>

                            {/* Accordion Toggle Prompt */}
                            <div
                              style={{
                                marginTop: 8,
                                paddingTop: 6,
                                borderTop: '1px dashed rgba(255, 255, 255, 0.08)',
                                fontSize: 10,
                                color: 'var(--hy-accent)',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                              }}
                            >
                              <span>{isExpanded ? '▲ بستن تفکیک اعضا' : '▼ کلیک برای نمایش هزینه‌ها به تفکیک اعضای گروه'}</span>
                              <span style={{ opacity: 0.7 }}>{isExpanded ? 'پنهان‌سازی' : 'نمایش'}</span>
                            </div>

                            {/* Detailed Member Breakdown Accordion Content */}
                            {isExpanded && (
                              <div
                                style={{
                                  marginTop: 8,
                                  paddingTop: 8,
                                  borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: 6,
                                }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--hy-text-secondary)', marginBottom: 2 }}>
                                  👤 هزینه‌های گروه به تفکیک اعضا:
                                </div>
                                {gb.memberBalances.map((mb) => {
                                  const mCreditor = mb.net > 5
                                  const mDebtor = mb.net < -5
                                  return (
                                    <div
                                      key={mb.id}
                                      style={{
                                        padding: '6px 10px',
                                        borderRadius: 8,
                                        background: 'rgba(0, 0, 0, 0.25)',
                                        border: '1px solid rgba(255, 255, 255, 0.05)',
                                        fontSize: 11,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 2,
                                      }}
                                    >
                                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800 }}>
                                        <span>👤 {mb.name}</span>
                                        <span
                                          style={{
                                            color: mCreditor ? 'var(--hy-income)' : mDebtor ? 'var(--hy-expense)' : 'var(--hy-text-secondary)',
                                          }}
                                        >
                                          تراز: {mCreditor ? '+' : ''}{formatMoney(mb.net)}
                                        </span>
                                      </div>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--hy-text-secondary)', fontSize: 10 }}>
                                        <span>پرداخت: {formatMoney(mb.paid)}</span>
                                        <span>سهم: {formatMoney(mb.share)}</span>
                                      </div>
                                      <MemberPotFigures deposits={mb.deposits} deficitCovered={mb.deficitCovered} formatMoney={formatMoney} />
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>

                    {/* Ungrouped Participants (سایر افراد مستقل) */}
                    {dongSummary.ungroupedBalances.length > 0 && (
                      <div style={{ marginTop: 10 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--hy-text-secondary)', marginBottom: 8 }}>
                          👤 سایر اعضای مستقل (خارج از گروه‌ها):
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
                          {dongSummary.ungroupedBalances.map((b) => {
                            const isCreditor = b.net > 5
                            const isDebtor = b.net < -5
                            return (
                              <div
                                key={b.id}
                                style={{
                                  padding: '10px 12px',
                                  borderRadius: 12,
                                  background: isCreditor
                                    ? 'rgba(16, 185, 129, 0.1)'
                                    : isDebtor
                                    ? 'rgba(239, 68, 68, 0.1)'
                                    : 'rgba(255, 255, 255, 0.04)',
                                  border: isCreditor
                                    ? '1px solid rgba(16, 185, 129, 0.25)'
                                    : isDebtor
                                    ? '1px solid rgba(239, 68, 68, 0.25)'
                                    : '1px solid rgba(255, 255, 255, 0.08)',
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                  <span style={{ fontWeight: 800, fontSize: 13 }}>{b.name}</span>
                                  <span
                                    style={{
                                      fontSize: 10,
                                      fontWeight: 700,
                                      padding: '1px 6px',
                                      borderRadius: 6,
                                      background: isCreditor
                                        ? 'rgba(16, 185, 129, 0.2)'
                                        : isDebtor
                                        ? 'rgba(239, 68, 68, 0.2)'
                                        : 'rgba(255, 255, 255, 0.1)',
                                      color: isCreditor ? 'var(--hy-income)' : isDebtor ? 'var(--hy-expense)' : 'var(--hy-text-secondary)',
                                    }}
                                  >
                                    {isCreditor ? 'طلبکار' : isDebtor ? 'بدهکار' : 'بی‌حساب'}
                                  </span>
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--hy-text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                                  <span>پرداخت کرده:</span>
                                  <b>{formatMoney(b.paid)}</b>
                                </div>
                                <MemberPotFigures deposits={b.deposits} deficitCovered={b.deficitCovered} formatMoney={formatMoney} />
                                <div style={{ fontSize: 11, color: 'var(--hy-text-secondary)', display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                                  <span>سهم مصرفی:</span>
                                  <b>{formatMoney(b.share)}</b>
                                </div>
                                <div
                                  style={{
                                    fontSize: 12,
                                    fontWeight: 800,
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    marginTop: 4,
                                    paddingTop: 4,
                                    borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                                    color: isCreditor ? 'var(--hy-income)' : isDebtor ? 'var(--hy-expense)' : 'var(--hy-text-secondary)',
                                  }}
                                >
                                  <span>تراز نهایی:</span>
                                  <span>
                                    {isCreditor ? '+' : ''}
                                    {formatMoney(b.net)}
                                  </span>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* When No Groups Defined Yet: Display Individual Balances with Option to Group */
                  <div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
                      {dongSummary.balances.map((b) => {
                        const isCreditor = b.net > 5
                        const isDebtor = b.net < -5
                        return (
                          <div
                            key={b.id}
                            style={{
                              padding: '10px 12px',
                              borderRadius: 12,
                              background: isCreditor
                                ? 'rgba(16, 185, 129, 0.1)'
                                : isDebtor
                                ? 'rgba(239, 68, 68, 0.1)'
                                : 'rgba(255, 255, 255, 0.04)',
                              border: isCreditor
                                ? '1px solid rgba(16, 185, 129, 0.25)'
                                : isDebtor
                                ? '1px solid rgba(239, 68, 68, 0.25)'
                                : '1px solid rgba(255, 255, 255, 0.08)',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                              <span style={{ fontWeight: 800, fontSize: 13 }}>{b.name}</span>
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  padding: '1px 6px',
                                  borderRadius: 6,
                                  background: isCreditor
                                    ? 'rgba(16, 185, 129, 0.2)'
                                    : isDebtor
                                    ? 'rgba(239, 68, 68, 0.2)'
                                    : 'rgba(255, 255, 255, 0.1)',
                                  color: isCreditor ? 'var(--hy-income)' : isDebtor ? 'var(--hy-expense)' : 'var(--hy-text-secondary)',
                                }}
                              >
                                {isCreditor ? 'طلبکار' : isDebtor ? 'بدهکار' : 'بی‌حساب'}
                              </span>
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--hy-text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                              <span>پرداخت کرده:</span>
                              <b>{formatMoney(b.paid)}</b>
                            </div>
                            <MemberPotFigures deposits={b.deposits} deficitCovered={b.deficitCovered} formatMoney={formatMoney} />
                            <div style={{ fontSize: 11, color: 'var(--hy-text-secondary)', display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                              <span>سهم مصرفی:</span>
                              <b>{formatMoney(b.share)}</b>
                            </div>
                            <div
                              style={{
                                fontSize: 12,
                                fontWeight: 800,
                                display: 'flex',
                                justifyContent: 'space-between',
                                marginTop: 4,
                                paddingTop: 4,
                                borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                                color: isCreditor ? 'var(--hy-income)' : isDebtor ? 'var(--hy-expense)' : 'var(--hy-text-secondary)',
                              }}
                            >
                              <span>تراز نهایی:</span>
                              <span>
                                {isCreditor ? '+' : ''}
                                {formatMoney(b.net)}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    <div
                      style={{
                        marginTop: 12,
                        padding: '10px 14px',
                        borderRadius: 12,
                        background: 'rgba(37, 99, 235, 0.1)',
                        border: '1px dashed rgba(56, 189, 248, 0.3)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: 8,
                      }}
                    >
                      <div style={{ fontSize: 11, color: 'var(--hy-text)' }}>
                        💡 <b>گروه‌بندی افراد:</b> آیا برخی از حاضرین با هم هستند (مثلاً اعضای یک خانواده یا هم‌اتاقی‌ها)؟ می‌توانید آنها را گروه‌بندی کنید تا هزینه‌هایشان تجمیع شود.
                      </div>
                      <button
                        type="button"
                        className="cat-mini"
                        style={{ fontSize: 11, padding: '3px 10px', fontWeight: 700 }}
                        onClick={() => {
                          setMembersModalTab('groups')
                          setIsDongMembersAndGroupsModalOpen(true)
                        }}
                      >
                        👥 ایجاد گروه جدید
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Settlement Calculator Box: Who pays whom? */}
              <div
                style={{
                  padding: 16,
                  borderRadius: 16,
                  background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.15) 0%, rgba(15, 118, 110, 0.2) 100%)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>⚖️</span>
                    <span>فرمول تسویه حساب نهایی (چه کسی به چه کسی بدهد؟)</span>
                  </h3>
                  {activeDongTransfers.length > 0 && activeDongTransfers.every((t) => t.settled) ? (
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--hy-income)', background: 'rgba(16, 185, 129, 0.2)', padding: '2px 8px', borderRadius: 8 }}>
                      🎉 تمام پرداخت‌ها انجام شد
                    </span>
                  ) : null}
                </div>

                {dongSummary.potActive ? (
                  <p style={{ fontSize: 12, color: 'var(--hy-text)', margin: '0 0 8px', lineHeight: 1.7 }}>
                    موجودی مادرخرج {formatMoney(dongSummary.potBalance)} است. واریز هر عضو جزو آورده اوست و سهمش از خرج‌های مادرخرج جزو مصرف، کنار خرجی که خودش پرداخته است.
                    {dongSummary.potBalance > 5 ? ' مانده صندوق در همین فهرست به طلبکارها برمی‌گردد.' : ''}
                    {dongSummary.potBalance < -5 ? ' کسری صندوق را مسئول مادرخرج از جیب داده و در طلب او حساب شده است.' : ''}
                  </p>
                ) : null}

                {/* Group vs Individual Settlement Toggle (when groups exist) */}
                {selectedDongEvent.groups && selectedDongEvent.groups.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '8px 0 12px' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--hy-text-secondary)' }}>
                      حالت تسویه:
                    </span>
                    <div className="seg" style={{ margin: 0, padding: 2 }}>
                      <button
                        type="button"
                        className={`seg-btn${settlementViewMode === 'group' ? ' active' : ''}`}
                        onClick={() => setSettlementViewMode('group')}
                        style={{ fontSize: 11, padding: '3px 10px' }}
                      >
                        👥 تسویه تجمیعی گروه‌ها ({toFaDigits(dongSummary.groupTransfers.length)})
                      </button>
                      <button
                        type="button"
                        className={`seg-btn${settlementViewMode === 'individual' ? ' active' : ''}`}
                        onClick={() => setSettlementViewMode('individual')}
                        style={{ fontSize: 11, padding: '3px 10px' }}
                      >
                        👤 تسویه فردی مستقیم ({toFaDigits(dongSummary.transfers.length)})
                      </button>
                    </div>
                  </div>
                )}

                {activeDongTransfers.length === 0 ? (
                  <p style={{ fontSize: 12, color: 'var(--hy-income)', margin: '8px 0 0' }}>
                    🎉 تمام حساب‌ها کاملاً برابر است و کسی به دیگری بدهکار نیست!
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                    {activeDongTransfers.map((tr) => (
                      <div
                        key={tr.id}
                        style={{
                          padding: '12px 14px',
                          borderRadius: 12,
                          background: tr.settled ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255, 255, 255, 0.08)',
                          border: tr.settled ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: 10,
                          opacity: tr.settled ? 0.85 : 1,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 800, color: tr.settled ? 'var(--hy-text-secondary)' : 'var(--hy-expense)', textDecoration: tr.settled ? 'line-through' : 'none' }}>
                            {tr.fromName}
                          </span>
                          <span style={{ opacity: 0.6 }}>باید بپردازد به</span>
                          <span style={{ fontWeight: 800, color: tr.settled ? 'var(--hy-text-secondary)' : 'var(--hy-income)', textDecoration: tr.settled ? 'line-through' : 'none' }}>
                            {tr.toName}
                          </span>
                          <span style={{ fontWeight: 800, color: tr.settled ? 'var(--hy-income)' : 'var(--hy-accent)', marginRight: 6 }}>
                            {formatMoney(tr.amount)}
                          </span>
                          {tr.settled ? (
                            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--hy-income)', background: 'rgba(16, 185, 129, 0.2)', padding: '1px 6px', borderRadius: 6 }}>
                              (پرداخت شده)
                            </span>
                          ) : (
                            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--hy-expense)', background: 'rgba(239, 68, 68, 0.15)', padding: '1px 6px', borderRadius: 6 }}>
                              (در انتظار پرداخت)
                            </span>
                          )}
                        </div>

                        {/* Toggle Payment Status Button */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <button
                            type="button"
                            className="cat-mini"
                            style={{
                              background: tr.settled ? 'rgba(16, 185, 129, 0.25)' : 'var(--hy-accent)',
                              color: tr.settled ? 'var(--hy-income)' : '#fff',
                              fontWeight: 700,
                              fontSize: 11,
                              padding: '5px 12px',
                              borderRadius: 8,
                              cursor: 'pointer',
                            }}
                            onClick={() => {
                              const nextSettled = new Set(selectedDongEvent.settledTransfers || [])
                              if (nextSettled.has(tr.id)) {
                                nextSettled.delete(tr.id)
                                notifyUser(`وضعیت پرداخت ${tr.fromName} به حالت تسویه نشده بازگشت`)
                              } else {
                                nextSettled.add(tr.id)
                                notifyUser(`تسویه پرداخت ${tr.fromName} به ${tr.toName} ثبت شد`)
                              }
                              void saveDongEvent({
                                ...selectedDongEvent,
                                settledTransfers: Array.from(nextSettled),
                              })
                            }}
                          >
                            {tr.settled ? '✓ تسویه شده (لغو)' : '🔘 ثبت تسویه'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ────────────────── Modal 1: Add / Edit Dong Expense Modal ────────────────── */}
              {isDongExpenseModalOpen && (
                <WindowPopup
                  title={editingExpId ? 'ویرایش خرج رویداد' : 'ثبت خرج جدید در رویداد'}
                  subtitle={selectedDongEvent.title}
                  icon="💸"
                  isOpen={true}
                  onClose={() => {
                    setIsDongExpenseModalOpen(false)
                    setEditingExpId(null)
                    setNewExpTitle('')
                    setNewExpAmount('')
                    setNewExpSplits([])
                    setNewExpCustomAmounts({})
                    setManualEditedIds(new Set())
                    setNewExpSplitMode('equal')
                  }}
                  defaultWidth={540}
                  defaultHeight={640}
                >
                  <div className="sheet-body-scroll" style={{ padding: '6px 0 20px' }}>
                    <div className="field-stack">
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 700, marginBottom: 4, display: 'block' }}>
                          عنوان خرج:
                        </label>
                        <input
                          className="field-input"
                          placeholder="مثلاً: بنزین، ناهار رستوران، خرید سوپرمارکت"
                          value={newExpTitle}
                          autoFocus
                          onChange={(e) => setNewExpTitle(e.target.value)}
                        />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 700, marginBottom: 4, display: 'block' }}>
                            مبلغ کل خرج ({unitLabel}):
                          </label>
                          <input
                            className="field-input"
                            inputMode="numeric"
                            placeholder={`مبلغ کل (${unitLabel})`}
                            value={newExpAmount}
                            onChange={(e) => handleExpenseAmountChange(e.target.value)}
                          />
                        </div>

                        <div>
                          <label style={{ fontSize: 11, fontWeight: 700, marginBottom: 4, display: 'block' }}>
                            پرداخت‌کننده:
                          </label>
                          <select
                            className="field-input"
                            value={newExpPayer || defaultDongPayerId(selectedDongEvent)}
                            onChange={(e) => setNewExpPayer(e.target.value)}
                            aria-label="پرداخت‌کننده"
                          >
                            {(isMadreKharjEnabled(selectedDongEvent) || newExpPayer === MADRE_KHARJ_PAYER_ID) && (
                              <option value={MADRE_KHARJ_PAYER_ID}>پرداخت از مادرخرج</option>
                            )}
                            {selectedDongEvent.participants.map((p) => (
                              <option key={p.id} value={p.id}>
                                پرداخت توسط: {p.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Participant Selection Checkboxes & Group Shortcuts */}
                      <div
                        style={{
                          margin: '6px 0',
                          padding: '12px 14px',
                          borderRadius: 14,
                          background: 'rgba(0, 0, 0, 0.22)',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--hy-text)' }}>
                            👥 این هزینه مربوط به چه کسانی است؟
                          </span>
                          <button
                            type="button"
                            className="cat-mini"
                            style={{ fontSize: 10, padding: '2px 8px' }}
                            onClick={() => {
                              const allIds = selectedDongEvent.participants.map((p) => p.id)
                              const current = newExpSplits.length > 0 ? newExpSplits : allIds
                              if (current.length === allIds.length) {
                                setNewExpSplits([])
                              } else {
                                setNewExpSplits(allIds)
                              }
                            }}
                          >
                            {newExpSplits.length === 0 || newExpSplits.length === selectedDongEvent.participants.length
                              ? 'لغو انتخاب همه'
                              : 'انتخاب همه'}
                          </button>
                        </div>

                        {/* Quick Group Select Shortcuts if Groups Exist */}
                        {selectedDongEvent.groups && selectedDongEvent.groups.length > 0 && (
                          <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 10, color: 'var(--hy-text-secondary)', fontWeight: 700 }}>
                              انتخاب سریع بر اساس گروه:
                            </span>
                            {selectedDongEvent.groups.map((g) => {
                              const allGroupInSplits = g.memberIds.every((mid) =>
                                (newExpSplits.length > 0 ? newExpSplits : selectedDongEvent.participants.map((x) => x.id)).includes(mid)
                              )
                              return (
                                <button
                                  key={g.id}
                                  type="button"
                                  className="cat-mini"
                                  style={{
                                    fontSize: 10,
                                    padding: '2px 8px',
                                    borderRadius: 8,
                                    background: allGroupInSplits ? 'rgba(37, 99, 235, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                                    color: allGroupInSplits ? 'var(--hy-accent)' : 'var(--hy-text-secondary)',
                                  }}
                                  onClick={() => {
                                    const effective = newExpSplits.length > 0 ? [...newExpSplits] : selectedDongEvent.participants.map((x) => x.id)
                                    if (allGroupInSplits) {
                                      // Remove group members
                                      setNewExpSplits(effective.filter((id) => !g.memberIds.includes(id)))
                                    } else {
                                      // Add group members
                                      const next = Array.from(new Set([...effective, ...g.memberIds]))
                                      setNewExpSplits(next)
                                    }
                                  }}
                                >
                                  {allGroupInSplits ? `✓ اعضای گروه ${g.name}` : `+ اعضای گروه ${g.name}`}
                                </button>
                              )
                            })}
                          </div>
                        )}

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {selectedDongEvent.participants.map((p) => {
                            const effectiveSplits =
                              newExpSplits.length > 0 ? newExpSplits : selectedDongEvent.participants.map((x) => x.id)
                            const isChecked = effectiveSplits.includes(p.id)
                            return (
                              <label
                                key={p.id}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  padding: '5px 10px',
                                  borderRadius: 10,
                                  background: isChecked ? 'rgba(15, 118, 110, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                                  border: isChecked ? '1px solid var(--hy-teal)' : '1px solid rgba(255, 255, 255, 0.1)',
                                  cursor: 'pointer',
                                  fontSize: 12,
                                  fontWeight: isChecked ? 700 : 500,
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) => {
                                    const allIds = selectedDongEvent.participants.map((x) => x.id)
                                    const current = newExpSplits.length > 0 ? [...newExpSplits] : allIds
                                    let next: string[]
                                    if (e.target.checked) {
                                      next = current.includes(p.id) ? current : [...current, p.id]
                                    } else {
                                      next = current.filter((id) => id !== p.id)
                                    }
                                    setNewExpSplits(next)
                                    if (newExpSplitMode === 'custom') {
                                      const totalUnits = Number(digitsOnly(newExpAmount)) || 0
                                      const updated = recalculateManualDistribution(totalUnits, next, manualEditedIds, newExpCustomAmounts)
                                      setNewExpCustomAmounts(updated)
                                    }
                                  }}
                                />
                                <span>{p.name}</span>
                              </label>
                            )
                          })}
                        </div>

                        {/* Split Mode Toggle: Equal vs Manual Split */}
                        <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--hy-text-secondary)' }}>
                              نحوه تقسیم سهم افراد:
                            </span>
                            <div className="seg" style={{ margin: 0, padding: 2 }}>
                              <button
                                type="button"
                                className={`seg-btn${newExpSplitMode === 'equal' ? ' active' : ''}`}
                                onClick={() => setNewExpSplitMode('equal')}
                                style={{ fontSize: 11, padding: '3px 10px' }}
                              >
                                ⚖️ تقسیم مساوی
                              </button>
                              <button
                                type="button"
                                className={`seg-btn${newExpSplitMode === 'custom' ? ' active' : ''}`}
                                onClick={() => {
                                  setNewExpSplitMode('custom')
                                  const splits =
                                    newExpSplits.length > 0 ? newExpSplits : selectedDongEvent.participants.map((p) => p.id)
                                  const totalUnits = Number(digitsOnly(newExpAmount)) || 0
                                  const updated = recalculateManualDistribution(totalUnits, splits, manualEditedIds, newExpCustomAmounts)
                                  setNewExpCustomAmounts(updated)
                                }}
                                style={{ fontSize: 11, padding: '3px 10px' }}
                              >
                                تقسیم دستی
                              </button>
                            </div>
                          </div>

                          {newExpSplitMode === 'equal' ? (
                            <div
                              style={{
                                fontSize: 11,
                                color: 'var(--hy-teal)',
                                background: 'rgba(15, 118, 110, 0.1)',
                                padding: '6px 10px',
                                borderRadius: 8,
                              }}
                            >
                              {(() => {
                                const effectiveSplits =
                                  newExpSplits.length > 0 ? newExpSplits : selectedDongEvent.participants.map((p) => p.id)
                                const totalRials = parseAmountToRials(newExpAmount)
                                if (effectiveSplits.length === 0) return 'هیچ فردی انتخاب نشده است.'
                                if (totalRials <= 0)
                                  return `هزینه به صورت برابر بین ${toFaDigits(effectiveSplits.length)} نفر تقسیم می‌شود.`
                                const perShare = Math.round(totalRials / effectiveSplits.length)
                                return `سهم مساوی هر نفر: ${formatMoney(perShare)} (${toFaDigits(effectiveSplits.length)} نفر)`
                              })()}
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: 'var(--hy-text-secondary)', marginBottom: 2 }}>
                                <span>مبالغ دستی ثابت می‌مانند و باقیمانده به طور مساوی بین بقیه تقسیم می‌شود:</span>
                                <button
                                  type="button"
                                  className="cat-mini"
                                  style={{ fontSize: 10, padding: '1px 8px' }}
                                  onClick={resetCustomAmountsToEqual}
                                  title="توزیع مجدد مبلغ کل به طور مساوی"
                                >
                                  ↺ توزیع مساوی مجدد
                                </button>
                              </div>
                              {selectedDongEvent.participants.map((p) => {
                                const effectiveSplits =
                                  newExpSplits.length > 0 ? newExpSplits : selectedDongEvent.participants.map((x) => x.id)
                                if (!effectiveSplits.includes(p.id)) return null
                                const isManuallySet = manualEditedIds.has(p.id)

                                return (
                                  <div
                                    key={p.id}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      gap: 10,
                                      padding: '5px 8px',
                                      borderRadius: 8,
                                      background: isManuallySet ? 'rgba(37, 99, 235, 0.15)' : 'rgba(0, 0, 0, 0.2)',
                                      border: isManuallySet ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid transparent',
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                      <span style={{ fontSize: 12, fontWeight: 700 }}>{p.name}:</span>
                                      {isManuallySet ? (
                                        <span style={{ fontSize: 10, color: 'var(--hy-accent)' }}>(دستی)</span>
                                      ) : (
                                        <span style={{ fontSize: 10, color: 'var(--hy-text-secondary)' }}>(توزیع خودکار)</span>
                                      )}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, maxWidth: 190 }}>
                                      <input
                                        className="field-input"
                                        inputMode="numeric"
                                        style={{ height: 32, fontSize: 12, textAlign: 'left', direction: 'rtl' }}
                                        placeholder="مبلغ"
                                        value={newExpCustomAmounts[p.id] ?? ''}
                                        onChange={(e) => handleUserCustomAmountChange(p.id, e.target.value)}
                                      />
                                      <span style={{ fontSize: 10, opacity: 0.7 }}>{unitLabel}</span>
                                    </div>
                                  </div>
                                )
                              })}

                              {/* Balance difference badge */}
                              {(() => {
                                const effectiveSplits =
                                  newExpSplits.length > 0 ? newExpSplits : selectedDongEvent.participants.map((p) => p.id)
                                const sumCustomRials = effectiveSplits.reduce((acc, id) => {
                                  return acc + parseAmountToRials(newExpCustomAmounts[id] ?? '0')
                                }, 0)
                                const totalRials = parseAmountToRials(newExpAmount)
                                const diff = totalRials - sumCustomRials
                                return (
                                  <div
                                    style={{
                                      fontSize: 11,
                                      marginTop: 4,
                                      padding: '6px 10px',
                                      borderRadius: 8,
                                      background: Math.abs(diff) < 100 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                      color: Math.abs(diff) < 100 ? 'var(--hy-income)' : 'var(--hy-expense)',
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      fontWeight: 700,
                                    }}
                                  >
                                    <span>مجموع سهم‌ها: {formatMoney(sumCustomRials)}</span>
                                    {diff !== 0 && totalRials > 0 ? (
                                      <span>
                                        {diff > 0 ? `باقی‌مانده: ${formatMoney(diff)}` : `اضافه بر کل: ${formatMoney(-diff)}`}
                                      </span>
                                    ) : (
                                      <span>✓ تراز دقیق با کل هزینه (بدون کسری/مازاد)</span>
                                    )}
                                  </div>
                                )
                              })()}
                            </div>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                        <button
                          className="cta-confirm"
                          type="button"
                          style={{ flex: 1 }}
                          onClick={() => {
                            const amount = parseAmountToRials(newExpAmount)
                            if (!newExpTitle.trim() || !amount) {
                              notifyUser('عنوان و مبلغ خرج الزامی است')
                              return
                            }
                            const payerId = newExpPayer || defaultDongPayerId(selectedDongEvent)
                            const targetSplits =
                              newExpSplits.length > 0 ? newExpSplits : selectedDongEvent.participants.map((p) => p.id)

                            if (targetSplits.length === 0) {
                              notifyUser('حداقل یک نفر را برای پرداخت دونگ انتخاب کنید')
                              return
                            }

                            let customShares: Record<string, number> | undefined
                            if (newExpSplitMode === 'custom') {
                              customShares = {}
                              let sumCustom = 0
                              for (const id of targetSplits) {
                                const val = parseAmountToRials(newExpCustomAmounts[id] ?? '0')
                                customShares[id] = val
                                sumCustom += val
                              }
                              if (sumCustom > 0 && sumCustom !== amount) {
                                const diff = amount - sumCustom
                                const firstId = targetSplits[0]
                                if (firstId) {
                                  customShares[firstId] = Math.max(0, (customShares[firstId] || 0) + diff)
                                }
                              }
                            }

                            const updatedExpenses = [...selectedDongEvent.expenses]
                            if (editingExpId) {
                              // Edit existing expense
                              const idx = updatedExpenses.findIndex((e) => e.id === editingExpId)
                              if (idx >= 0) {
                                updatedExpenses[idx] = {
                                  ...updatedExpenses[idx],
                                  title: newExpTitle.trim(),
                                  amount,
                                  paidById: payerId,
                                  splitAmongIds: targetSplits,
                                  splitMode: newExpSplitMode,
                                  customShares,
                                }
                              }
                              notifyUser('خرج ویرایش و اصلاح شد')
                            } else {
                              // Add new expense
                              const newItem: DongExpenseItem = {
                                id: createId('dexp'),
                                title: newExpTitle.trim(),
                                amount,
                                paidById: payerId,
                                splitAmongIds: targetSplits,
                                splitMode: newExpSplitMode,
                                customShares,
                                date: todayIso(),
                              }
                              updatedExpenses.push(newItem)
                              notifyUser('خرج ثبت شد و دونگ‌ها محاسبه شدند')
                            }

                            void saveDongEvent({
                              ...selectedDongEvent,
                              expenses: updatedExpenses,
                            })

                            setIsDongExpenseModalOpen(false)
                            setEditingExpId(null)
                            setNewExpTitle('')
                            setNewExpAmount('')
                            setNewExpSplits([])
                            setNewExpCustomAmounts({})
                            setManualEditedIds(new Set())
                            setNewExpSplitMode('equal')
                          }}
                        >
                          {editingExpId ? 'ذخیره تغییرات خرج' : 'ثبت خرج در رویداد'}
                        </button>
                        <button
                          type="button"
                          className="cat-mini"
                          style={{ padding: '0 16px' }}
                          onClick={() => {
                            setIsDongExpenseModalOpen(false)
                            setEditingExpId(null)
                            setNewExpTitle('')
                            setNewExpAmount('')
                          }}
                        >
                          انصراف
                        </button>
                      </div>
                    </div>
                  </div>
                </WindowPopup>
              )}

              {/* ────────────────── Modal 2: Manage Participants & Groups Modal ────────────────── */}
              {isDongMembersAndGroupsModalOpen && (
                <WindowPopup
                  title="تنظیم گروه: افراد، گروه‌ها، مادرخرج"
                  subtitle={selectedDongEvent.title}
                  icon="👥"
                  isOpen={true}
                  onClose={() => {
                    setIsDongMembersAndGroupsModalOpen(false)
                    setEditingGroupId(null)
                    setGroupNameInput('')
                    setGroupSelectedMemberIds([])
                    setEditingParticipantId(null)
                    setEventNewMemberInput('')
                  }}
                  defaultWidth={600}
                  defaultHeight={680}
                >
                  <div className="sheet-body-scroll" style={{ padding: '6px 0 20px' }}>
                    <p className="sheet-sub" style={{ margin: '0 0 8px' }}>
                      مرحله سوم اختیاری است. اگر مادرخرج را رد کنید، دونگ مثل قبل بین خود اعضا می‌ماند.
                    </p>
                    <div className="seg" style={{ marginBottom: 14 }}>
                      <button
                        type="button"
                        className={`seg-btn${membersModalTab === 'members' ? ' active' : ''}`}
                        style={{ fontSize: 12, padding: '8px 4px' }}
                        onClick={() => setMembersModalTab('members')}
                      >
                        ۱. افراد
                      </button>
                      <button
                        type="button"
                        className={`seg-btn${membersModalTab === 'groups' ? ' active' : ''}`}
                        style={{ fontSize: 12, padding: '8px 4px' }}
                        onClick={() => setMembersModalTab('groups')}
                      >
                        ۲. گروه‌ها
                      </button>
                      <button
                        type="button"
                        className={`seg-btn${membersModalTab === 'madre' ? ' active' : ''}`}
                        style={{ fontSize: 12, padding: '8px 4px' }}
                        onClick={() => setMembersModalTab('madre')}
                      >
                        ۳. مادرخرج{isMadreKharjEnabled(selectedDongEvent) ? ' ✓' : ''}
                      </button>
                    </div>

                    {/* TAB 1: MEMBERS */}
                    {membersModalTab === 'members' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {isDongGuest(selectedDongEvent) ? (
                          <p className="sheet-sub">
                            این سفر با شما به اشتراک گذاشته شده. ثبت خرج برای شما باز است. تغییر افراد، گروه‌ها و مادرخرج فقط با صاحب سفر است.
                          </p>
                        ) : null}
                        {/* Add new member form */}
                        {isDongGuest(selectedDongEvent) ? null : <div
                          style={{
                            padding: '12px 14px',
                            borderRadius: 14,
                            background: 'rgba(255, 255, 255, 0.04)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                          }}
                        >
                          <label style={{ fontSize: 11, fontWeight: 700, marginBottom: 6, display: 'block' }}>
                            افزودن فرد جدید به این رویداد:
                          </label>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <input
                              className="field-input"
                              style={{ flex: 1 }}
                              placeholder="نام فرد جدید (مثلاً: علی رضایی)"
                              value={eventNewMemberInput}
                              onChange={(e) => setEventNewMemberInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && eventNewMemberInput.trim()) {
                                  e.preventDefault()
                                  const newName = eventNewMemberInput.trim()
                                  const newId = `p_${Date.now()}`
                                  const updated = [...selectedDongEvent.participants, { id: newId, name: newName }]
                                  void saveDongEvent({ ...selectedDongEvent, participants: updated })
                                  setEventNewMemberInput('')
                                  notifyUser(`${newName} اضافه شد`)
                                }
                              }}
                            />
                            <button
                              className="cta-confirm"
                              type="button"
                              style={{ width: 'auto', padding: '0 16px', fontSize: 12 }}
                              onClick={() => {
                                if (eventNewMemberInput.trim()) {
                                  const newName = eventNewMemberInput.trim()
                                  const newId = `p_${Date.now()}`
                                  const updated = [...selectedDongEvent.participants, { id: newId, name: newName }]
                                  void saveDongEvent({ ...selectedDongEvent, participants: updated })
                                  setEventNewMemberInput('')
                                  notifyUser(`${newName} اضافه شد`)
                                }
                              }}
                            >
                              + افزودن فرد
                            </button>
                          </div>
                        </div>}

                        {/* List of current members with inline edit and delete */}
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--hy-text-secondary)', marginBottom: 8 }}>
                            لیست افراد حاضر در رویداد ({toFaDigits(selectedDongEvent.participants.length)} نفر):
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {selectedDongEvent.participants.map((p) => {
                              const userGroups = (selectedDongEvent.groups || []).filter((g) => g.memberIds.includes(p.id))
                              const lockedByPot = memberHasPotRole(selectedDongEvent, p.id)
                              const isReferencedInExpenses =
                                lockedByPot ||
                                selectedDongEvent.expenses.some(
                                  (e) => e.paidById === p.id || e.splitAmongIds.includes(p.id)
                                )

                              return (
                                <div
                                  key={p.id}
                                  style={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '8px 12px',
                                    borderRadius: 10,
                                    background: 'rgba(0, 0, 0, 0.2)',
                                    border: '1px solid rgba(255, 255, 255, 0.06)',
                                  }}
                                >
                                  {editingParticipantId === p.id ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                                      <input
                                        className="field-input"
                                        style={{ height: 30, fontSize: 12, flex: 1 }}
                                        value={editingParticipantName}
                                        autoFocus
                                        onChange={(e) => setEditingParticipantName(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter' && editingParticipantName.trim()) {
                                            e.preventDefault()
                                            const updatedParticipants = selectedDongEvent.participants.map((item) =>
                                              item.id === p.id ? { ...item, name: editingParticipantName.trim() } : item
                                            )
                                            void saveDongEvent({ ...selectedDongEvent, participants: updatedParticipants })
                                            setEditingParticipantId(null)
                                            notifyUser('نام فرد ویرایش شد')
                                          } else if (e.key === 'Escape') {
                                            setEditingParticipantId(null)
                                          }
                                        }}
                                      />
                                      <button
                                        type="button"
                                        className="cat-mini"
                                        style={{ color: 'var(--hy-income)', fontWeight: 800 }}
                                        onClick={() => {
                                          if (editingParticipantName.trim()) {
                                            const updatedParticipants = selectedDongEvent.participants.map((item) =>
                                              item.id === p.id ? { ...item, name: editingParticipantName.trim() } : item
                                            )
                                            void saveDongEvent({ ...selectedDongEvent, participants: updatedParticipants })
                                            notifyUser('نام فرد ویرایش شد')
                                          }
                                          setEditingParticipantId(null)
                                        }}
                                      >
                                        ✓ ذخیره
                                      </button>
                                      <button
                                        type="button"
                                        className="cat-mini"
                                        onClick={() => setEditingParticipantId(null)}
                                      >
                                        انصراف
                                      </button>
                                    </div>
                                  ) : (
                                    <>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ fontSize: 13, fontWeight: 700 }}>👤 {p.name}</span>
                                        {userGroups.map((g) => (
                                          <span
                                            key={g.id}
                                            style={{
                                              fontSize: 10,
                                              padding: '1px 6px',
                                              borderRadius: 6,
                                              background: 'rgba(37, 99, 235, 0.2)',
                                              color: 'var(--hy-accent)',
                                              fontWeight: 700,
                                            }}
                                          >
                                            عضو گروه {g.name}
                                          </span>
                                        ))}
                                      </div>

                                      {isDongGuest(selectedDongEvent) ? null : <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <button
                                          type="button"
                                          className="cat-mini"
                                          style={{ fontSize: 11 }}
                                          title="ویرایش نام"
                                          onClick={() => {
                                            setEditingParticipantId(p.id)
                                            setEditingParticipantName(p.name)
                                          }}
                                        >
                                          ✏️ ویرایش
                                        </button>
                                        {lockedByPot ? (
                                          <span style={{ fontSize: 10, color: 'var(--hy-text-secondary)' }}>در مادرخرج است</span>
                                        ) : null}
                                        {selectedDongEvent.participants.length > 1 && !isReferencedInExpenses ? (
                                          <button
                                            type="button"
                                            className="cat-mini danger"
                                            style={{ fontSize: 11 }}
                                            title="حذف فرد"
                                            onClick={() => {
                                              if (confirm(`آیا از حذف «${p.name}» اطمینان دارید؟`)) {
                                                const updatedParticipants = selectedDongEvent.participants.filter(
                                                  (x) => x.id !== p.id
                                                )
                                                // Also remove from any groups
                                                const updatedGroups = (selectedDongEvent.groups || []).map((g) => ({
                                                  ...g,
                                                  memberIds: g.memberIds.filter((mid) => mid !== p.id),
                                                }))
                                                const mk = selectedDongEvent.madreKharj
                                                const contributions = { ...(mk?.contributions ?? {}) }
                                                delete contributions[p.id]
                                                const removingResponsible = mk?.responsibleId === p.id
                                                void saveDongEvent({
                                                  ...selectedDongEvent,
                                                  participants: updatedParticipants,
                                                  groups: updatedGroups,
                                                  madreKharj: mk
                                                    ? {
                                                        ...mk,
                                                        responsibleId: removingResponsible ? undefined : mk.responsibleId,
                                                        enabled: removingResponsible ? false : mk.enabled,
                                                        contributions,
                                                        deposits: (mk.deposits ?? []).filter((d) => d.memberId !== p.id),
                                                      }
                                                    : undefined,
                                                })
                                                notifyUser(`${p.name} از رویداد حذف شد`)
                                              }
                                            }}
                                          >
                                            ✕ حذف
                                          </button>
                                        ) : null}
                                      </div>}
                                    </>
                                  )}
                                  <DongMemberShare event={selectedDongEvent} participant={p} />
                                </div>
                              )
                            })}
                          </div>
                        </div>

                        <div
                          style={{
                            padding: '10px 14px',
                            borderRadius: 12,
                            background: 'rgba(37, 99, 235, 0.08)',
                            fontSize: 11,
                            color: 'var(--hy-text-secondary)',
                            lineHeight: 1.6,
                          }}
                        >
                          💡 <b>راهنمایی:</b> بعد از اعضا، گروه‌ها را مشخص کنید. مرحله بعد تعیین مادرخرج است و اختیاری است؛ اگر رد شود، حساب دونگ مثل قبل بین خود اعضا می‌ماند.
                        </div>
                        <button className="cta-confirm" type="button" onClick={() => setMembersModalTab('groups')}>
                          مرحله بعد: گروه‌بندی
                        </button>
                      </div>
                    )}

                    {/* TAB 2: GROUPS */}
                    {membersModalTab === 'groups' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div
                          style={{
                            padding: '10px 14px',
                            borderRadius: 12,
                            background: 'rgba(37, 99, 235, 0.08)',
                            border: '1px solid rgba(56, 189, 248, 0.2)',
                            fontSize: 11,
                            color: 'var(--hy-text)',
                            lineHeight: 1.6,
                          }}
                        >
                          💡 <b>چرا گروه‌بندی کنیم؟</b> در سفرهای دوستانه یا خانوادگی، می‌توانید اعضای یک خانواده یا هم‌اتاقی‌ها را در یک گروه قرار دهید. در این حالت، سهم و پرداخت‌های کل گروه با هم جمع شده و تسویه حساب نهایی بر اساس کل گروه انجام می‌شود. همچنین با کلیک روی هر گروه، هزینه‌ها به تفکیک اعضا نیز نمایش داده می‌شود.
                        </div>

                        {/* Group Add / Edit Form */}
                        <div
                          style={{
                            padding: 14,
                            borderRadius: 14,
                            background: 'rgba(255, 255, 255, 0.04)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                            <h4 style={{ fontSize: 13, fontWeight: 800, margin: 0 }}>
                              {editingGroupId ? '✏️ ویرایش مشخصات گروه' : '＋ تعریف گروه جدید'}
                            </h4>
                            {editingGroupId ? (
                              <button
                                type="button"
                                className="cat-mini"
                                onClick={() => {
                                  setEditingGroupId(null)
                                  setGroupNameInput('')
                                  setGroupSelectedMemberIds([])
                                }}
                              >
                                انصراف از ویرایش
                              </button>
                            ) : null}
                          </div>

                          <div className="field-stack">
                            <div>
                              <label style={{ fontSize: 11, fontWeight: 700, marginBottom: 4, display: 'block' }}>
                                نام گروه:
                              </label>
                              <input
                                className="field-input"
                                placeholder="مثلاً: خانواده احمدی، اتاق ۱۰۲، تیم فنی"
                                value={groupNameInput}
                                onChange={(e) => setGroupNameInput(e.target.value)}
                              />
                            </div>

                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                <label style={{ fontSize: 11, fontWeight: 700 }}>
                                  اعضای این گروه را انتخاب کنید:
                                </label>
                                <button
                                  type="button"
                                  className="cat-mini"
                                  style={{ fontSize: 10, padding: '2px 8px' }}
                                  onClick={() => {
                                    if (groupSelectedMemberIds.length === selectedDongEvent.participants.length) {
                                      setGroupSelectedMemberIds([])
                                    } else {
                                      setGroupSelectedMemberIds(selectedDongEvent.participants.map((p) => p.id))
                                    }
                                  }}
                                >
                                  {groupSelectedMemberIds.length === selectedDongEvent.participants.length
                                    ? 'لغو همه'
                                    : 'انتخاب همه'}
                                </button>
                              </div>

                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {selectedDongEvent.participants.map((p) => {
                                  const isSelected = groupSelectedMemberIds.includes(p.id)
                                  return (
                                    <label
                                      key={p.id}
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 6,
                                        padding: '5px 10px',
                                        borderRadius: 10,
                                        background: isSelected ? 'rgba(37, 99, 235, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                                        border: isSelected ? '1px solid var(--hy-accent)' : '1px solid rgba(255, 255, 255, 0.1)',
                                        cursor: 'pointer',
                                        fontSize: 12,
                                        fontWeight: isSelected ? 700 : 500,
                                      }}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={(e) => {
                                          if (e.target.checked) {
                                            setGroupSelectedMemberIds([...groupSelectedMemberIds, p.id])
                                          } else {
                                            setGroupSelectedMemberIds(groupSelectedMemberIds.filter((id) => id !== p.id))
                                          }
                                        }}
                                      />
                                      <span>{p.name}</span>
                                    </label>
                                  )
                                })}
                              </div>
                            </div>

                            <button
                              type="button"
                              className="cta-confirm"
                              style={{ marginTop: 6 }}
                              onClick={() => {
                                if (!groupNameInput.trim()) {
                                  notifyUser('لطفاً نام گروه را وارد کنید')
                                  return
                                }
                                if (groupSelectedMemberIds.length === 0) {
                                  notifyUser('حداقل یک نفر را به عنوان عضو گروه انتخاب کنید')
                                  return
                                }

                                const existingGroups = [...(selectedDongEvent.groups || [])]
                                if (editingGroupId) {
                                  const idx = existingGroups.findIndex((g) => g.id === editingGroupId)
                                  if (idx >= 0) {
                                    existingGroups[idx] = {
                                      ...existingGroups[idx],
                                      name: groupNameInput.trim(),
                                      memberIds: groupSelectedMemberIds,
                                    }
                                  }
                                  notifyUser(`گروه «${groupNameInput.trim()}» با موفقیت ویرایش شد`)
                                } else {
                                  existingGroups.push({
                                    id: createId('dgrp'),
                                    name: groupNameInput.trim(),
                                    memberIds: groupSelectedMemberIds,
                                  })
                                  notifyUser(`گروه «${groupNameInput.trim()}» ایجاد شد`)
                                }

                                void saveDongEvent({
                                  ...selectedDongEvent,
                                  groups: existingGroups,
                                })

                                setEditingGroupId(null)
                                setGroupNameInput('')
                                setGroupSelectedMemberIds([])
                              }}
                            >
                              {editingGroupId ? 'ذخیره اصلاحات گروه' : '+ ایجاد گروه جدید'}
                            </button>
                          </div>
                        </div>

                        {/* List of Defined Groups */}
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--hy-text-secondary)', marginBottom: 8 }}>
                            گروه‌های تعریف‌شده در این رویداد:
                          </div>

                          {!selectedDongEvent.groups || selectedDongEvent.groups.length === 0 ? (
                            <p className="sheet-sub" style={{ margin: 0 }}>
                              هنوز هیچ گروهی تعریف نشده است. می‌توانید از فرم بالا اولین گروه را بسازید.
                            </p>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              {selectedDongEvent.groups.map((g) => {
                                const members = g.memberIds
                                  .map((mid) => selectedDongEvent.participants.find((p) => p.id === mid)?.name)
                                  .filter(Boolean)

                                return (
                                  <div
                                    key={g.id}
                                    style={{
                                      padding: '10px 14px',
                                      borderRadius: 12,
                                      background: 'rgba(0, 0, 0, 0.22)',
                                      border: '1px solid rgba(255, 255, 255, 0.08)',
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      flexWrap: 'wrap',
                                      gap: 8,
                                    }}
                                  >
                                    <div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <span style={{ fontWeight: 800, fontSize: 14 }}>👥 {g.name}</span>
                                        <span
                                          style={{
                                            fontSize: 10,
                                            padding: '1px 6px',
                                            borderRadius: 6,
                                            background: 'rgba(37, 99, 235, 0.2)',
                                            color: 'var(--hy-accent)',
                                            fontWeight: 700,
                                          }}
                                        >
                                          {toFaDigits(g.memberIds.length)} عضو
                                        </span>
                                      </div>
                                      <div style={{ fontSize: 11, color: 'var(--hy-text-secondary)', marginTop: 4 }}>
                                        اعضا: {members.join('، ') || 'بدون عضو'}
                                      </div>
                                    </div>

                                    <div style={{ display: 'flex', gap: 6 }}>
                                      <button
                                        type="button"
                                        className="cat-mini"
                                        style={{ fontSize: 11 }}
                                        onClick={() => {
                                          setEditingGroupId(g.id)
                                          setGroupNameInput(g.name)
                                          setGroupSelectedMemberIds(g.memberIds)
                                        }}
                                      >
                                        ✏️ ویرایش
                                      </button>
                                      <button
                                        type="button"
                                        className="cat-mini danger"
                                        style={{ fontSize: 11 }}
                                        onClick={() => {
                                          if (confirm(`آیا از حذف گروه «${g.name}» اطمینان دارید؟ (افراد حذف نمی‌شوند)`)) {
                                            const updatedGroups = (selectedDongEvent.groups || []).filter(
                                              (item) => item.id !== g.id
                                            )
                                            void saveDongEvent({
                                              ...selectedDongEvent,
                                              groups: updatedGroups,
                                            })
                                            if (editingGroupId === g.id) {
                                              setEditingGroupId(null)
                                              setGroupNameInput('')
                                              setGroupSelectedMemberIds([])
                                            }
                                            notifyUser(`گروه «${g.name}» حذف شد`)
                                          }
                                        }}
                                      >
                                        حذف
                                      </button>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                        <button className="cta-confirm" type="button" onClick={() => setMembersModalTab('madre')}>
                          مرحله بعد: تعیین مادرخرج (اختیاری)
                        </button>
                      </div>
                    )}

                    {membersModalTab === 'madre' && (
                      <MadreKharjSetup
                        event={selectedDongEvent}
                        currencyUnit={currencyUnit}
                        unitLabel={unitLabel}
                        formatMoney={formatMoney}
                        summary={dongSummary}
                        onSave={(next) => {
                          void saveDongEvent(next)
                        }}
                        onNotify={notifyUser}
                        onBack={() => setMembersModalTab('groups')}
                        onSkip={() => {
                          setIsDongMembersAndGroupsModalOpen(false)
                          notifyUser('مادرخرج رد شد. این گروه مثل قبل بین اعضا حساب می‌شود.')
                        }}
                      />
                    )}
                  </div>
                </WindowPopup>
              )}
            </div>
          )}
        </div>
    </div>
  )
}
