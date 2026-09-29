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
        })
      } else {
        await addQuickEntry({
          kind,
          amount,
          accountId: account.id,
          categoryId: category?.id ?? cats[0].id,
          note,
          date,
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
    <>
      <div className="peek-home">
        <div className="ph-title">خانه</div>
        <div className="ph-amt">{formatRial(totalBalance)} ریال</div>
      </div>
      <div className="sheet-scrim" onClick={onClose} />
      <div
        className="glass-sheet sheet-sticky-cta"
        role="dialog"
        aria-label="ثبت سریع"
      >
        <div className="sheet-handle" />
        <div className="sheet-header">
          <h1>{isEdit ? 'ویرایش تراکنش' : 'ثبت سریع'}</h1>
          <button className="sheet-close" type="button" onClick={onClose} aria-label="بستن">
            ✕
          </button>
        </div>

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
        </div>
        </div>

        <div className="sheet-footer">
          <button className={`cta-confirm${disabled ? ' disabled' : ''}`} type="button" onClick={() => void submit()} disabled={disabled}>
            {saving ? 'در حال ثبت…' : isEdit ? 'ذخیره تغییرات' : 'تأیید و ثبت'}
          </button>
        </div>
      </div>
    </>
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
