import { useEffect, useState } from 'react'
import {
  addSharedUser,
  getSharedUsers,
  lookupUserByIdOrHandle,
  removeSharedUser,
  HUMAN_AVATARS,
  type SharedUserProfile,
} from '../lib/userShare'
import { notifyUser } from '../lib/sync'
import { toFaDigits } from '../lib/money'

export interface ShareTargetItem {
  id: string
  name: string
  bankName?: string
  pan?: string
  accountNumber?: string
  balance?: number
}

export function UnifiedShareSheet({
  kind,
  item,
  onClose,
}: {
  kind: 'card' | 'account'
  item: ShareTargetItem
  onClose: () => void
}) {
  const [sharedUsers, setSharedUsers] = useState<SharedUserProfile[]>([])
  const [loading, setLoading] = useState(true)

  // Add User Flow States
  const [isAdding, setIsAdding] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [lookingUp, setLookingUp] = useState(false)
  const [previewUser, setPreviewUser] = useState<SharedUserProfile | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [isEditingName, setIsEditingName] = useState(false)
  const [editedDisplayName, setEditedDisplayName] = useState('')

  const title = item.bankName || item.name || (kind === 'card' ? 'کارت بانکی' : 'حساب مالی')

  const refreshList = async () => {
    try {
      const list = await getSharedUsers(kind, item.id)
      setSharedUsers(list)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refreshList()

    const onUpdate = (e: Event) => {
      const detail = (e as CustomEvent<{ kind: string; id: string }>).detail
      if (detail && detail.kind === kind && detail.id === item.id) {
        void refreshList()
      }
    }
    window.addEventListener('hy-share-assets-updated', onUpdate)
    return () => window.removeEventListener('hy-share-assets-updated', onUpdate)
  }, [kind, item.id])

  async function handleLookup(overrideInput?: string) {
    const textToSearch = overrideInput ?? searchInput
    if (!textToSearch.trim()) return
    setErrorMsg(null)
    setPreviewUser(null)
    setIsEditingName(false)
    setLookingUp(true)

    try {
      const found = await lookupUserByIdOrHandle(textToSearch)
      if (!found) {
        setErrorMsg('کاربری با این مشخصات در سرور یافت نشد. لطفاً User ID یا شناسه کاربری را بررسی نمایید.')
        return
      }

      // Check if already shared
      if (sharedUsers.some((u) => u.userId === found.userId || u.handle === found.handle)) {
        setErrorMsg('این کاربر قبلاً به لیست اعضای مجاز این حساب/کارت اضافه شده است.')
        return
      }

      setPreviewUser(found)
      setEditedDisplayName(found.displayName)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'خطا در استعلام مشخصات کاربر')
    } finally {
      setLookingUp(false)
    }
  }

  async function handleConfirmShare() {
    if (!previewUser) return
    setSubmitting(true)
    setErrorMsg(null)

    const userToSave: SharedUserProfile = {
      ...previewUser,
      displayName: editedDisplayName.trim() || previewUser.displayName,
    }

    try {
      await addSharedUser(kind, item.id, userToSave, {
        name: item.name,
        bankName: item.bankName,
        pan: item.pan,
        accountNumber: item.accountNumber,
        balance: item.balance,
      })
      notifyUser(`دسترسی با موفقیت برای ${userToSave.displayName} فعال شد ✨`)
      setIsAdding(false)
      setSearchInput('')
      setPreviewUser(null)
      setIsEditingName(false)
      await refreshList()
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'ثبت اشتراک با خطا مواجه شد')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRevoke(user: SharedUserProfile) {
    if (confirm(`آیا از حذف دسترسی ${user.displayName} به این ${kind === 'card' ? 'کارت' : 'حساب'} اطمینان دارید؟`)) {
      try {
        await removeSharedUser(kind, item.id, user.userId)
        notifyUser(`دسترسی ${user.displayName} لغو شد`)
        await refreshList()
      } catch (err) {
        notifyUser(err instanceof Error ? err.message : 'خطا در لغو دسترسی')
      }
    }
  }

  return (
    <>
      <div className="sheet-scrim" onClick={onClose} />
      <div
        className="glass-sheet sheet-sticky-cta"
        role="dialog"
        aria-label={`اشتراک ${title}`}
        style={{ maxWidth: 520, margin: '0 auto' }}
      >
        <div className="sheet-handle" />

        {/* Header */}
        <div className="sheet-header" style={{ paddingBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 24 }}>{kind === 'card' ? '💳' : '🏦'}</span>
            <div>
              <h1 style={{ fontSize: 16, margin: 0, fontWeight: 800 }}>اشتراک {title}</h1>
              <div style={{ fontSize: 11, color: 'var(--hy-text-secondary)', marginTop: 2 }}>
                امکان اشتراک‌گذاری با حداکثر ۱۰ کاربر مجاز
              </div>
            </div>
          </div>
          <button className="sheet-close" type="button" onClick={onClose} aria-label="بستن">
            ✕
          </button>
        </div>

        <div className="sheet-body-scroll" style={{ paddingBottom: 24 }}>
          {/* Capacity and Status Card */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 14px',
              borderRadius: 16,
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              margin: '6px 0 14px',
            }}
          >
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--hy-text)' }}>
                اعضای متصل به این {kind === 'card' ? 'کارت' : 'حساب'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--hy-text-secondary)', marginTop: 2 }}>
                ظرفیت: <strong>{toFaDigits(sharedUsers.length)}</strong> از ۱۰ کاربر
              </div>
            </div>

            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                padding: '4px 10px',
                borderRadius: 999,
                background:
                  sharedUsers.length >= 10
                    ? 'rgba(239, 68, 68, 0.16)'
                    : sharedUsers.length > 0
                    ? 'rgba(16, 185, 129, 0.16)'
                    : 'rgba(255, 255, 255, 0.08)',
                color:
                  sharedUsers.length >= 10
                    ? '#f87171'
                    : sharedUsers.length > 0
                    ? 'var(--hy-income, #10b981)'
                    : 'var(--hy-text-secondary)',
                border: `1px solid ${
                  sharedUsers.length >= 10
                    ? 'rgba(239, 68, 68, 0.3)'
                    : sharedUsers.length > 0
                    ? 'rgba(16, 185, 129, 0.3)'
                    : 'rgba(255, 255, 255, 0.1)'
                }`,
              }}
            >
              {sharedUsers.length >= 10
                ? 'سقف تکمیل شده'
                : `${toFaDigits(sharedUsers.length)} / ۱۰ کاربر`}
            </span>
          </div>

          {/* Add User Section / Modal */}
          {isAdding ? (
            <div
              style={{
                background: 'rgba(15, 118, 110, 0.08)',
                border: '1.5px solid rgba(15, 118, 110, 0.3)',
                borderRadius: 18,
                padding: '16px',
                margin: '10px 0 16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800, fontSize: 13, color: 'var(--hy-teal)' }}>
                  <span>➕</span>
                  <span>افزودن کاربر با User ID یا شناسه کاربری (Handle)</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsAdding(false)
                    setPreviewUser(null)
                    setErrorMsg(null)
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--hy-text-secondary)',
                    cursor: 'pointer',
                    fontSize: 14,
                    padding: '2px 6px',
                  }}
                >
                  ✕
                </button>
              </div>

              <p style={{ fontSize: 11, color: 'var(--hy-text-secondary)', margin: '0 0 10px', lineHeight: 1.6 }}>
                می‌توانید <strong>User ID</strong> کاربر (مشخص شده در تنظیمات) یا <strong>شناسه کاربری دستی</strong> (@handle تعریف شده در پروفایل) را در کادر زیر وارد کنید:
              </p>

              <div className="field-stack">
                <input
                  className="field-input"
                  dir="ltr"
                  placeholder="مثال: ali_reza یا usr_9a2f1c84"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  disabled={lookingUp || submitting}
                  style={{
                    fontFamily: 'monospace',
                    fontSize: 13,
                    fontWeight: 700,
                    textAlign: 'center',
                    letterSpacing: 1,
                    marginBottom: 8,
                  }}
                />

                <button
                  className="cta-confirm"
                  type="button"
                  disabled={lookingUp || !searchInput.trim()}
                  onClick={() => void handleLookup()}
                  style={{ height: 42, fontSize: 13, fontWeight: 800 }}
                >
                  {lookingUp ? 'در حال استعلام مشخصات از سرور…' : '🔍 استعلام و بررسی مشخصات کاربر'}
                </button>
              </div>

              {errorMsg ? (
                <div className="banner error" style={{ marginTop: 12, fontSize: 12 }}>
                  <span>{errorMsg}</span>
                </div>
              ) : null}

              {/* Profile Preview Card */}
              {previewUser && (
                <div
                  style={{
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1.5px solid var(--hy-teal, #0ea5e9)',
                    borderRadius: 18,
                    padding: '16px',
                    marginTop: 14,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--hy-teal)' }}>
                      ✨ مشخصات کامل پروفایل کاربر:
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        padding: '2px 8px',
                        borderRadius: 6,
                        background: 'rgba(16, 185, 129, 0.16)',
                        color: 'var(--hy-income, #10b981)',
                        fontWeight: 800,
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                      }}
                    >
                      ✓ هویت تأیید شد
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    {/* Real Human Portrait Avatar with quick cycler */}
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <div
                        style={{
                          width: 60,
                          height: 60,
                          borderRadius: 20,
                          overflow: 'hidden',
                          background: '#1e293b',
                          border: '2px solid rgba(255, 255, 255, 0.25)',
                          boxShadow: '0 4px 14px rgba(0, 0, 0, 0.3)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {previewUser.avatarUrl ? (
                          <img
                            src={previewUser.avatarUrl}
                            alt={previewUser.displayName}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            onError={(e) => {
                              ;(e.target as HTMLElement).style.display = 'none'
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: '100%',
                              height: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 900,
                              fontSize: 22,
                              color: '#fff',
                              background: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
                            }}
                          >
                            {previewUser.displayName.charAt(0) || '👤'}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        title="تغییر عکس پرتره"
                        onClick={() => {
                          const curIdx = HUMAN_AVATARS.indexOf(previewUser.avatarUrl || '')
                          const nextIdx = (curIdx + 1) % HUMAN_AVATARS.length
                          setPreviewUser({ ...previewUser, avatarUrl: HUMAN_AVATARS[nextIdx] })
                        }}
                        style={{
                          position: 'absolute',
                          bottom: -4,
                          right: -4,
                          width: 22,
                          height: 22,
                          borderRadius: '50%',
                          background: 'var(--hy-teal, #0ea5e9)',
                          color: '#fff',
                          border: '1.5px solid #fff',
                          fontSize: 10,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                        }}
                      >
                        🔄
                      </button>
                    </div>

                    {/* User Details & Name Editor */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {isEditingName ? (
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 4 }}>
                          <input
                            className="field-input"
                            value={editedDisplayName}
                            onChange={(e) => setEditedDisplayName(e.target.value)}
                            placeholder="نام و نام خانوادگی کاربر"
                            style={{ height: 32, fontSize: 12, fontWeight: 700, padding: '2px 8px' }}
                          />
                          <button
                            type="button"
                            className="cat-mini"
                            style={{ height: 32, padding: '0 8px' }}
                            onClick={() => {
                              if (editedDisplayName.trim()) {
                                setPreviewUser({ ...previewUser, displayName: editedDisplayName.trim() })
                              }
                              setIsEditingName(false)
                            }}
                          >
                            ✓
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ fontSize: 15, fontWeight: 900, color: 'var(--hy-text)' }}>
                            {editedDisplayName || previewUser.displayName}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setEditedDisplayName(previewUser.displayName)
                              setIsEditingName(true)
                            }}
                            title="ویرایش نام نمایشی"
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--hy-teal)',
                              cursor: 'pointer',
                              fontSize: 11,
                              padding: 0,
                            }}
                          >
                            ✏️
                          </button>
                        </div>
                      )}

                      <div
                        style={{
                          fontSize: 12,
                          color: 'var(--hy-accent, #818cf8)',
                          fontFamily: 'monospace',
                          fontWeight: 700,
                          marginTop: 2,
                        }}
                      >
                        @{previewUser.handle}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--hy-text-tertiary)', marginTop: 2, fontFamily: 'monospace' }}>
                        شناسه کاربر (ID): {previewUser.userId}
                      </div>
                    </div>
                  </div>

                  <p style={{ fontSize: 11, color: 'var(--hy-text-secondary)', margin: 0, lineHeight: 1.6 }}>
                    با تأیید، این {kind === 'card' ? 'کارت' : 'حساب'} به همراه مشخصات آن برای کاربر فوق به اشتراک گذاشته می‌شود.
                  </p>

                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <button
                      className="cta-confirm"
                      type="button"
                      disabled={submitting}
                      onClick={() => void handleConfirmShare()}
                      style={{ flex: 1.5, height: 42, fontSize: 13, fontWeight: 800 }}
                    >
                      {submitting ? 'در حال ثبت…' : '✅ تأیید و افزودن به اعضای مجاز'}
                    </button>
                    <button
                      className="home-pill ghost"
                      type="button"
                      disabled={submitting}
                      onClick={() => setPreviewUser(null)}
                      style={{ flex: 1, height: 42, justifyContent: 'center' }}
                    >
                      انصراف
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Button to trigger Add User Modal */
            <div style={{ margin: '10px 0 16px' }}>
              <button
                type="button"
                className="cta-confirm"
                disabled={sharedUsers.length >= 10}
                onClick={() => {
                  setIsAdding(true)
                  setSearchInput('')
                  setPreviewUser(null)
                  setErrorMsg(null)
                }}
                style={{
                  width: '100%',
                  height: 44,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  fontWeight: 800,
                  fontSize: 13,
                  opacity: sharedUsers.length >= 10 ? 0.6 : 1,
                }}
              >
                <span>➕ اضافه کردن کاربر جدید</span>
                <span style={{ fontSize: 11, opacity: 0.8 }}>(تا سقف ۱۰ کاربر)</span>
              </button>
            </div>
          )}

          {/* List of Shared Users */}
          <div style={{ marginTop: 14 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 8,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--hy-text)' }}>
                لیست کاربران دارای دسترسی ({toFaDigits(sharedUsers.length)} نفر):
              </div>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: 20, color: 'var(--hy-text-secondary)', fontSize: 12 }}>
                در حال بارگذاری اعضا…
              </div>
            ) : sharedUsers.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '28px 16px',
                  borderRadius: 16,
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px dashed rgba(255, 255, 255, 0.1)',
                }}
              >
                <div style={{ fontSize: 32, marginBottom: 6 }}>👥</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--hy-text)' }}>
                  هنوز کاربری اضافه نشده است
                </div>
                <div style={{ fontSize: 11, color: 'var(--hy-text-secondary)', marginTop: 4 }}>
                  برای اشتراک‌گذاری با دوستان یا همکاران، دکمه «اضافه کردن کاربر جدید» را بزنید.
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {sharedUsers.map((user) => (
                  <div
                    key={user.userId || user.handle}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderRadius: 14,
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      gap: 10,
                    }}
                  >
                    {/* User Avatar */}
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 14,
                        overflow: 'hidden',
                        background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 900,
                        fontSize: 18,
                        color: '#fff',
                        flexShrink: 0,
                      }}
                    >
                      {user.avatarUrl ? (
                        <img
                          src={user.avatarUrl}
                          alt={user.displayName}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={(e) => {
                            ;(e.target as HTMLElement).style.display = 'none'
                          }}
                        />
                      ) : (
                        user.displayName.charAt(0) || '👤'
                      )}
                    </div>

                    {/* Summary Profile Details: Photo, Full Name, ID / Handle */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 800,
                          color: 'var(--hy-text)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {user.displayName}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: 'var(--hy-accent, #818cf8)',
                          fontFamily: 'monospace',
                          fontWeight: 600,
                          marginTop: 1,
                        }}
                      >
                        @{user.handle}
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          color: 'var(--hy-text-tertiary)',
                          fontFamily: 'monospace',
                          marginTop: 1,
                        }}
                      >
                        ID: {user.userId}
                      </div>
                    </div>

                    {/* Revoke Button */}
                    <button
                      type="button"
                      onClick={() => void handleRevoke(user)}
                      style={{
                        background: 'rgba(239, 68, 68, 0.12)',
                        border: '1px solid rgba(239, 68, 68, 0.25)',
                        borderRadius: 8,
                        padding: '5px 10px',
                        fontSize: 11,
                        fontWeight: 700,
                        color: '#f87171',
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                      title="حذف دسترسی کاربر"
                    >
                      ✕ حذف دسترسی
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="sheet-footer" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <button
            className="home-pill ghost"
            type="button"
            onClick={onClose}
            style={{ width: '100%', height: 42, justifyContent: 'center', fontWeight: 700 }}
          >
            بستن
          </button>
        </div>
      </div>
    </>
  )
}
