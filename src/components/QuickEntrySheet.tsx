import { useMemo, useState } from 'react'
import { categoriesFor, getCategory, isProtectedCategory } from '../lib/categories'
import { todayIso } from '../lib/iso'
import { formatRial } from '../lib/money'
import { useScrollFocusedIntoView } from '../lib/keyboardInset'
import { notifyUser } from '../lib/sync'
import { useStore } from '../store/Store'
import { AmountField } from './AmountField'
import { DateField } from './DateField'
import { PickerSheet } from './PickerSheet'
import { WindowPopup } from './WindowPopup'
import type { Account, Category, Transaction } from '../types'

export function QuickEntrySheet({
  initialKind = 'expense',
  presetAccountId,
  totalBalance,
  transaction,
  onClose,
}: {
  initialKind?: 'expense' | 'income'
  presetAccountId?: string
  totalBalance: number
  transaction?: Transaction
  onClose: () => void
}) {
  const { activeAccounts, addQuickEntry, updateTransaction, customCategories, createCategory, renameCategory, deleteCategory } = useStore()
  const isEdit = Boolean(transaction)
  const [kind, setKind] = useState<'expense' | 'income'>(
    transaction?.kind === 'income' ? 'income' : transaction?.kind === 'expense' ? 'expense' : initialKind,
  )
  const [amount, setAmount] = useState(transaction?.amount ?? 0)
  const [accountId, setAccountId] = useState(transaction?.accountId ?? presetAccountId ?? activeAccounts[0]?.id ?? '')
  const [categoryId, setCategoryId] = useState(
    () => transaction?.categoryId ?? categoriesFor(initialKind)[0]?.id ?? 'food',
  )
  const [note, setNote] = useState(transaction?.note ?? '')
  const [date, setDate] = useState(transaction?.date ?? todayIso())
  const [receiptPhoto, setReceiptPhoto] = useState<string | undefined>(transaction?.receiptPhoto)
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags] = useState<string[]>(transaction?.tags ?? [])
  const [picker, setPicker] = useState<'category' | 'account' | 'note' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  useScrollFocusedIntoView()
  const linked = Boolean(transaction?.installmentItemId)
  const coarsePointer = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches

  const cats = useMemo(() => categoriesFor(kind, customCategories), [kind, customCategories])
  const category = getCategory(categoryId, customCategories) ?? cats[0]
  const account = activeAccounts.find((a) => a.id === accountId)
  const available =
    account && kind === 'expense'
      ? account.balance + (transaction?.kind === 'expense' && transaction.accountId === account.id ? transaction.amount : 0)
      : Infinity
  const over = kind === 'expense' && amount > 0 && amount > available
  const disabled = saving || amount <= 0 || over || !account

  function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      const base64 = event.target?.result as string
      setReceiptPhoto(base64)
      notifyUser('رسید پیوست شد')
    }
    reader.readAsDataURL(file)
  }

  function addTag() {
    const clean = tagInput.trim().replace(/^#/, '')
    if (clean && !tags.includes(clean)) {
      setTags([...tags, clean])
      setTagInput('')
    }
  }

  function removeTag(tagToRemove: string) {
    setTags(tags.filter((t) => t !== tagToRemove))
  }

  function switchKind(next: 'expense' | 'income') {
    if (linked) return
    setKind(next)
    const nextCats = categoriesFor(next, customCategories)
    if (!nextCats.some((c) => c.id === categoryId)) {
      setCategoryId(nextCats[0]?.id ?? '')
    }
  }

  async function submit() {
    setError(null)
    if (!account) {
      setError('ابتدا یک حساب بساز')
      return
    }
    setSaving(true)
    try {
      if (transaction) {
        await updateTransaction(transaction.id, {
          kind,
          amount,
          accountId: account.id,
          categoryId: category?.id ?? cats[0].id,
          note,
          date,
          receiptPhoto,
          tags,
        })
      } else {
        await addQuickEntry({
          kind,
          amount,
          accountId: account.id,
          categoryId: category?.id ?? cats[0].id,
          note,
          date,
          receiptPhoto,
          tags,
        })
      }
      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'ثبت نشد'
      setError(message)
      notifyUser(message)
    } finally {
      setSaving(false)
    }
  }

  if (picker === 'category') {
    return (
      <CategoryPicker
        kind={kind}
        cats={cats}
        onClose={() => setPicker(null)}
        onPick={(id) => {
          setCategoryId(id)
          setPicker(null)
        }}
        onCreate={async (name) => {
          const created = await createCategory(kind, name)
          setCategoryId(created.id)
          setPicker(null)
        }}
        onRename={(id, name) => renameCategory(id, name)}
        onDelete={async (id) => {
          await deleteCategory(id)
          if (categoryId === id) setCategoryId(kind === 'expense' ? 'other-exp' : 'other-inc')
        }}
      />
    )
  }

  if (picker === 'account') {
    return (
      <PickerSheet title="از حساب" onClose={() => setPicker(null)}>
        {activeAccounts.length === 0 ? (
          <p className="sheet-sub">حساب فعالی ندارید</p>
        ) : (
          activeAccounts.map((a) => (
            <AccountPickRow
              key={a.id}
              account={a}
              onPick={() => {
                setAccountId(a.id)
                setPicker(null)
              }}
            />
          ))
        )}
      </PickerSheet>
    )
  }

  return (
    <WindowPopup
      title={isEdit ? 'ویرایش تراکنش' : 'ثبت سریع تراکنش'}
      subtitle={kind === 'expense' ? 'ثبت هزینه جدید' : 'ثبت درآمد جدید'}
      icon={kind === 'expense' ? '💸' : '💰'}
      isOpen={true}
      onClose={onClose}
      defaultWidth={540}
      defaultHeight={640}
      footer={
        <div className="sheet-footer" style={{ padding: 0 }}>
          <button className={`cta-confirm${disabled ? ' disabled' : ''}`} type="button" onClick={() => void submit()} disabled={disabled}>
            {saving ? 'در حال ثبت…' : isEdit ? 'ذخیره تغییرات' : 'تأیید و ثبت'}
          </button>
        </div>
      }
    >
      <div className="sheet-body-scroll">
        <div className="seg" role="tablist" aria-label="نوع تراکنش">
          <div className={`seg-thumb${kind === 'income' ? ' income' : ''}`} aria-hidden="true" />
          <button
            className={`seg-btn${kind === 'expense' ? ' active' : ''}`}
            type="button"
            role="tab"
            aria-selected={kind === 'expense'}
            onClick={() => switchKind('expense')}
          >
            هزینه
          </button>
          <button
            className={`seg-btn${kind === 'income' ? ' active income' : ''}`}
            type="button"
            role="tab"
            aria-selected={kind === 'income'}
            onClick={() => switchKind('income')}
          >
            درآمد
          </button>
        </div>

        <AmountField
          variant="hero"
          value={amount}
          onChange={setAmount}
          autoFocus={!coarsePointer}
          caret={kind === 'income' ? 'income' : 'expense'}
          ariaLabel="مبلغ به ریال"
        />

        {error || over ? (
          <div className="banner error">
            <span className="bico">⚠</span>
            <span>{error || 'موجودی حساب کافی نیست'}</span>
          </div>
        ) : null}

        <div className="field-stack">
          <button className="field-chip" type="button" onClick={() => !linked && setPicker('category')} disabled={linked}>
            <span className="ficon">{category?.icon ?? '📂'}</span>
            <div>
              <div className="flabel">دسته‌بندی</div>
              <div className="fvalue">{category?.name ?? 'انتخاب کنید'}</div>
            </div>
            {linked ? <span className="readonly-tag">قفل</span> : <span className="fchev">‹</span>}
          </button>
          <button className="field-chip" type="button" onClick={() => setPicker('account')}>
            <span className="ficon">💳</span>
            <div>
              <div className="flabel">{kind === 'income' ? 'به حساب' : 'از حساب'}</div>
              <div className={account ? 'fvalue' : 'fvalue placeholder-val'}>
                {account?.name ?? 'حسابی انتخاب نشده'}
              </div>
            </div>
            <span className="fchev">‹</span>
          </button>
          <DateField label="تاریخ" value={date} onChange={setDate} />
          <button className="field-chip" type="button" onClick={() => setPicker(picker === 'note' ? null : 'note')}>
            <span className="ficon">📝</span>
            <div style={{ flex: 1 }}>
              <div className="flabel">یادداشت</div>
              {picker === 'note' ? (
                <input
                  className="field-input"
                  placeholder="اختیاری…"
                  value={note}
                  autoFocus
                  onChange={(e) => setNote(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <div className={note ? 'fvalue' : 'fvalue placeholder-val'}>{note || 'اختیاری…'}</div>
              )}
            </div>
            <span className="fchev">‹</span>
          </button>

          {/* Tags / Hashtags */}
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 16,
              background: 'rgba(255, 255, 255, 0.08)',
              border: '0.5px solid rgba(255, 255, 255, 0.5)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                🏷️ برچسب‌ها (تگ)
              </span>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: tags.length ? 6 : 0 }}>
              {tags.map((t) => (
                <span
                  key={t}
                  style={{
                    background: 'rgba(15, 118, 110, 0.15)',
                    border: '0.5px solid #0f766e',
                    borderRadius: 12,
                    padding: '2px 8px',
                    fontSize: 11,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  #{t}
                  <button
                    type="button"
                    onClick={() => removeTag(t)}
                    style={{ background: 'none', border: 'none', color: 'var(--hy-text-tertiary)', cursor: 'pointer', padding: 0 }}
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                className="field-input"
                style={{ flex: 1, fontSize: 12, padding: '6px 10px' }}
                placeholder="افزودن برچسب جدید (مثل سفر، تعمیرات)..."
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addTag()
                  }
                }}
              />
              <button type="button" className="cat-mini" onClick={addTag}>
                + افزودن
              </button>
            </div>
          </div>

          {/* Receipt Photo Attachment */}
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 16,
              background: 'rgba(255, 255, 255, 0.08)',
              border: '0.5px solid rgba(255, 255, 255, 0.5)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                📸 پیوست رسید یا فاکتور
              </span>
              <label
                className="cat-mini"
                style={{ cursor: 'pointer', margin: 0 }}
              >
                {receiptPhoto ? 'تغییر تصویر' : 'انتخاب تصویر'}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  style={{ display: 'none' }}
                />
              </label>
            </div>
            {receiptPhoto ? (
              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                <img
                  src={receiptPhoto}
                  alt="رسید"
                  style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 8, border: '1px solid rgba(255,255,255,0.4)' }}
                />
                <span style={{ fontSize: 12, color: 'var(--hy-text-secondary)', flex: 1 }}>تصویر رسید ذخیره شد</span>
                <button
                  type="button"
                  className="cat-mini danger"
                  onClick={() => setReceiptPhoto(undefined)}
                >
                  حذف تصویر
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </WindowPopup>
  )
}

function CategoryPicker({
  kind,
  cats,
  onClose,
  onPick,
  onCreate,
  onRename,
  onDelete,
}: {
  kind: 'expense' | 'income'
  cats: Category[]
  onClose: () => void
  onPick: (id: string) => void
  onCreate: (name: string) => Promise<void>
  onRename: (id: string, name: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [draft, setDraft] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function add() {
    setError(null)
    try {
      await onCreate(draft)
      setDraft('')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'دسته ساخته نشد'
      setError(message)
      notifyUser(message)
    }
  }

  return (
    <PickerSheet title="دسته‌بندی" onClose={onClose}>
      {error ? <p className="sheet-sub">{error}</p> : null}
      {cats.map((c) => {
        const custom = !isProtectedCategory(c.id)
        return (
          <div key={c.id} className="option-item lg-light cat-option">
            <button type="button" className="cat-pick" onClick={() => onPick(c.id)}>
              <span className="oico">{c.icon}</span>
              {editingId === c.id ? (
                <input
                  className="field-input"
                  value={editName}
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      void onRename(c.id, editName).then(() => setEditingId(null)).catch((err) => {
                        const message = err instanceof Error ? err.message : 'نام ذخیره نشد'
                        setError(message)
                        notifyUser(message)
                      })
                    }
                  }}
                />
              ) : (
                <div className="otitle">{c.name}</div>
              )}
            </button>
            {custom ? (
              <span className="cat-actions">
                <button
                  type="button"
                  className="cat-mini"
                  onClick={() => {
                    setEditingId(c.id)
                    setEditName(c.name)
                  }}
                >
                  ویرایش
                </button>
                <button
                  type="button"
                  className="cat-mini danger"
                  onClick={() => {
                    void onDelete(c.id).catch((err) => {
                      const message = err instanceof Error ? err.message : 'حذف نشد'
                      setError(message)
                      notifyUser(message)
                    })
                  }}
                >
                  حذف
                </button>
              </span>
            ) : null}
          </div>
        )
      })}
      <div className="cat-add">
        <input
          className="field-input"
          placeholder={kind === 'expense' ? 'دسته هزینه جدید' : 'دسته درآمد جدید'}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void add()
            }
          }}
        />
        <button className="cat-mini" type="button" onClick={() => void add()}>
          افزودن
        </button>
      </div>
    </PickerSheet>
  )
}

function AccountPickRow({ account, onPick }: { account: Account; onPick: () => void }) {
  return (
    <button type="button" className="option-item lg-light" onClick={onPick}>
      <span className="oico">💳</span>
      <div>
        <div className="otitle">{account.name}</div>
        <div className="osub">{formatRial(account.balance)} ریال</div>
      </div>
    </button>
  )
}
