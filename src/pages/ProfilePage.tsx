import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import * as db from '../db/db'
import { checkHandleAvailable, saveMyProfile } from '../lib/profileApi'
import {
  displayNameOf,
  emptyProfile,
  handleError,
  normalizeHandle,
  normalizePhone,
  validateProfile,
  type UserProfile,
} from '../lib/profile'
import { loadSession, notifyUser } from '../lib/sync'

const PROFILE_DIRTY = 'hy-profile-dirty'

export function ProfilePage({ onScroll }: { onScroll: (compact: boolean) => void }) {
  const [profile, setProfile] = useState<UserProfile>(emptyProfile())
  const [hint, setHint] = useState('')
  const [handleHint, setHandleHint] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancel = false
    const load = () => {
      void db.getKv<UserProfile>('userProfile').then((saved) => {
        if (!cancel && saved) setProfile({ ...emptyProfile(), ...saved })
      })
    }
    load()
    window.addEventListener('hy-profile-updated', load)
    return () => {
      cancel = true
      window.removeEventListener('hy-profile-updated', load)
    }
  }, [])

  useEffect(() => {
    const handle = normalizeHandle(profile.handle)
    if (!handle) {
      setHandleHint('')
      return
    }
    const problem = handleError(handle)
    if (problem) {
      setHandleHint(problem)
      return
    }
    if (!loadSession()) {
      setHandleHint('شکل شناسه درست است. برای بررسی یکتا بودن، از تنظیمات وارد حساب ابری شوید.')
      return
    }
    setHandleHint('در حال بررسی یکتا بودن…')
    const timer = window.setTimeout(() => {
      void checkHandleAvailable(handle)
        .then((free) => setHandleHint(free ? 'این شناسه آزاد است' : 'این شناسه قبلاً گرفته شده'))
        .catch((err: unknown) => setHandleHint(err instanceof Error ? err.message : 'بررسی شناسه انجام نشد'))
    }, 450)
    return () => window.clearTimeout(timer)
  }, [profile.handle])

  function patch(partial: Partial<UserProfile>) {
    setProfile((current) => ({ ...current, ...partial }))
  }

  async function onAvatar(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      notifyUser('فایل تصویر انتخاب کنید')
      return
    }
    try {
      const avatarUrl = await resizeAvatar(file)
      patch({ avatarUrl })
    } catch (err) {
      notifyUser(err instanceof Error ? err.message : 'تصویر ذخیره نشد')
    }
  }

  async function save() {
    const problem = validateProfile(profile)
    if (problem) {
      notifyUser(problem)
      return
    }
    if (handleHint.includes('گرفته شده') || handleHint.includes('قابل انتخاب نیست') || handleHint.includes('حرف انگلیسی')) {
      notifyUser(handleHint)
      return
    }
    const next: UserProfile = {
      ...profile,
      firstName: profile.firstName.trim(),
      lastName: profile.lastName.trim(),
      email: profile.email.trim(),
      phone: normalizePhone(profile.phone),
      handle: normalizeHandle(profile.handle),
      displayName: profile.displayName.trim(),
      about: profile.about.trim(),
      updatedAt: Date.now(),
    }
    setBusy(true)
    try {
      await db.setKv('userProfile', next)
      localStorage.setItem(PROFILE_DIRTY, '1')
      setProfile(next)
      if (!loadSession()) {
        setHint('روی این دستگاه ذخیره شد. با ورود به حساب ابری در دستگاه‌های دیگر هم می‌آید.')
        notifyUser('پروفایل روی این دستگاه ذخیره شد')
        return
      }
      await saveMyProfile(next)
      localStorage.removeItem(PROFILE_DIRTY)
      setHint('در حساب ابری ذخیره شد. فقط خودتان این مشخصات را می‌بینید؛ دیگران فقط شناسه و نام نمایشی را می‌بینند.')
      notifyUser('پروفایل ذخیره شد')
    } catch (err) {
      setHint('روی این دستگاه ماند. با وصل شدن ابر دوباره فرستاده می‌شود.')
      notifyUser(err instanceof Error ? err.message : 'ذخیره ابری انجام نشد')
    } finally {
      setBusy(false)
    }
  }

  const shown = displayNameOf(profile)

  return (
    <div className="app-scroll settings-page" onScroll={(e) => onScroll(e.currentTarget.scrollTop > 28)}>
      <div className="settings-sub-screen">
        <div className="settings-sub-header">
          <Link className="settings-back-btn" to="/settings">
            <span className="back-arrow" aria-hidden="true">›</span>
            <span>بازگشت به تنظیمات</span>
          </Link>
          <div className="settings-sub-title-row">
            <span className="settings-sub-icon" aria-hidden="true">👤</span>
            <div>
              <h1>پروفایل من</h1>
              <p>نام، تماس، تصویر و شناسه اختصاصی حسابیار</p>
            </div>
          </div>
        </div>

        <section className="lg settings-block profile-card">
          <div className="profile-head">
            <label className="profile-avatar">
              {profile.avatarUrl ? <img src={profile.avatarUrl} alt="" /> : <span>{shown.slice(0, 1)}</span>}
              <input
                type="file"
                accept="image/*"
                aria-label="تصویر پروفایل"
                onChange={(e) => void onAvatar(e.target.files?.[0])}
              />
            </label>
            <div>
              <strong>{shown}</strong>
              <p className="sheet-sub">{profile.handle ? `@${profile.handle}` : 'هنوز شناسه انتخاب نشده'}</p>
            </div>
          </div>

          <div className="profile-grid">
            <label>
              نام
              <input className="field-input" value={profile.firstName} onChange={(e) => patch({ firstName: e.target.value })} />
            </label>
            <label>
              نام خانوادگی
              <input className="field-input" value={profile.lastName} onChange={(e) => patch({ lastName: e.target.value })} />
            </label>
            <label>
              نام نمایشی
              <input
                className="field-input"
                value={profile.displayName}
                placeholder="اگر خالی بماند، نام و نام خانوادگی نشان داده می‌شود"
                onChange={(e) => patch({ displayName: e.target.value })}
              />
            </label>
            <label>
              شناسه اختصاصی
              <input
                className="field-input"
                dir="ltr"
                value={profile.handle}
                placeholder="مثلاً ali_reza"
                onChange={(e) => patch({ handle: e.target.value })}
              />
              {handleHint ? <span className={handleClass(handleHint)}>{handleHint}</span> : null}
            </label>
            <label>
              ایمیل تماس
              <input
                className="field-input"
                dir="ltr"
                inputMode="email"
                value={profile.email}
                placeholder="متمایز از ایمیل ورود"
                onChange={(e) => patch({ email: e.target.value })}
              />
            </label>
            <label>
              موبایل
              <input
                className="field-input"
                dir="ltr"
                inputMode="tel"
                value={profile.phone}
                placeholder="0912xxxxxxx"
                onChange={(e) => patch({ phone: e.target.value })}
              />
            </label>
          </div>
          <label className="profile-about">
            درباره
            <textarea className="field-input" rows={3} value={profile.about} onChange={(e) => patch({ about: e.target.value })} />
          </label>
          {hint ? <p className="sheet-sub">{hint}</p> : null}
          <button className="cta-confirm" type="button" disabled={busy} onClick={() => void save()}>
            {busy ? 'در حال ذخیره…' : 'ذخیره پروفایل'}
          </button>
        </section>
      </div>
    </div>
  )
}

function handleClass(hint: string) {
  if (hint.includes('آزاد') || hint.includes('درست است')) return 'handle-ok'
  if (hint.includes('بررسی')) return 'handle-wait'
  return 'handle-bad'
}

function resizeAvatar(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('خواندن تصویر ناموفق بود'))
    reader.onload = () => {
      const image = new Image()
      image.onload = () => {
        const size = 256
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('تصویر ساخته نشد'))
          return
        }
        const scale = Math.max(size / image.width, size / image.height)
        const width = image.width * scale
        const height = image.height * scale
        ctx.drawImage(image, (size - width) / 2, (size - height) / 2, width, height)
        let url = canvas.toDataURL('image/jpeg', 0.82)
        if (url.length > 180_000) url = canvas.toDataURL('image/jpeg', 0.6)
        if (url.length > 180_000) {
          reject(new Error('تصویر بزرگ است. یک عکس کوچک‌تر انتخاب کنید'))
          return
        }
        resolve(url)
      }
      image.onerror = () => reject(new Error('این تصویر باز نشد'))
      image.src = String(reader.result || '')
    }
    reader.readAsDataURL(file)
  })
}
