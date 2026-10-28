import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import * as db from '../db/db'
import { PROFILE_DIRTY_KEY, profileCloudError, syncProfile } from '../lib/profileCloud'
import { checkHandleAvailable } from '../lib/profileApi'
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
import { useExtras } from '../store/Extras'

export function ProfilePage({ onScroll }: { onScroll: (compact: boolean) => void }) {
  const { activePlanId, setActivePlanId } = useExtras()
  const [profile, setProfile] = useState<UserProfile>(emptyProfile())
  const [hint, setHint] = useState('')
  const [cloudError, setCloudError] = useState(profileCloudError)
  const [handleHint, setHandleHint] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancel = false
    const load = () => {
      void db.getKv<UserProfile>('userProfile').then((saved) => {
        if (!cancel && saved) setProfile({ ...emptyProfile(), ...saved })
      })
    }
    const onCloudError = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: string; cloud?: string }>).detail
      const message = detail?.message ?? ''
      setCloudError(message)
      if (message) return
      if (detail?.cloud === 'pulled') setHint('مشخصات از حساب ابری بار شد.')
      else if (detail?.cloud === 'pushed') {
        setHint('در حساب ابری ذخیره شد. فقط خودتان این مشخصات را می‌بینید؛ دیگران فقط شناسه و نام نمایشی را می‌بینند.')
      }
    }
    load()
    window.addEventListener('hy-profile-updated', load)
    window.addEventListener('hy-profile-cloud-error', onCloudError)
    return () => {
      cancel = true
      window.removeEventListener('hy-profile-updated', load)
      window.removeEventListener('hy-profile-cloud-error', onCloudError)
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
      localStorage.setItem(PROFILE_DIRTY_KEY, '1')
      setProfile(next)
      const result = await syncProfile({ force: 'push', forceNotify: true, profile: next })
      if (result.profile) setProfile({ ...emptyProfile(), ...result.profile })
      if (result.cloud === 'pushed') {
        setCloudError('')
        setHint('در حساب ابری ذخیره شد. فقط خودتان این مشخصات را می‌بینید؛ دیگران فقط شناسه و نام نمایشی را می‌بینند.')
        notifyUser('پروفایل ذخیره شد')
        return
      }
      if (result.cloud === 'pulled') {
        setCloudError('')
        setHint('مشخصات از حساب ابری بار شد.')
        notifyUser('نسخه ابری جایگزین شد')
        return
      }
      if (result.cloud === 'local') {
        setCloudError('')
        setHint(result.error)
        notifyUser('پروفایل روی این دستگاه ذخیره شد')
        return
      }
      setHint('روی این دستگاه ماند.')
      setCloudError(result.error)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'ذخیره ابری انجام نشد'
      setHint('روی این دستگاه ماند.')
      setCloudError(message)
      notifyUser(message)
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
          {cloudError ? (
            <div className="banner error" role="alert">
              <span>{cloudError}</span>
            </div>
          ) : null}
          {hint ? <p className="sheet-sub">{hint}</p> : null}
          <button className="cta-confirm" type="button" disabled={busy} onClick={() => void save()}>
            {busy ? 'در حال ذخیره…' : 'ذخیره پروفایل'}
          </button>
        </section>

        {/* Subscription & Plans Management Section (Item 12) */}
        <section className="profile-form" style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 24 }}>🌟</span>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>وضعیت اشتراک و پلن‌های حسابیار</h2>
                <p style={{ fontSize: 11, color: 'var(--hy-text-secondary)', margin: '2px 0 0' }}>
                  انتخاب پلن مناسب برای مدیریت مالی شخصی، گروهی و خانوادگی
                </p>
              </div>
            </div>
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                padding: '3px 10px',
                borderRadius: 8,
                background:
                  activePlanId === 'vip'
                    ? 'rgba(234, 179, 8, 0.2)'
                    : activePlanId === 'bronze'
                    ? 'rgba(56, 189, 248, 0.2)'
                    : 'rgba(16, 185, 129, 0.2)',
                color:
                  activePlanId === 'vip'
                    ? '#facc15'
                    : activePlanId === 'bronze'
                    ? '#38bdf8'
                    : 'var(--hy-income)',
              }}
            >
              {activePlanId === 'vip' ? '🌟 پلن VIP فعال' : activePlanId === 'bronze' ? '🥉 پلن برنزی فعال' : '🟢 نسخه رایگان فعال'}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Free Plan Card */}
            <div
              style={{
                padding: '14px 16px',
                borderRadius: 14,
                background: activePlanId === 'free' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255, 255, 255, 0.03)',
                border: activePlanId === 'free' ? '1px solid var(--hy-income)' : '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 10,
              }}
            >
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 16 }}>🟢</span>
                  <strong style={{ fontSize: 14 }}>نسخه پایه و رایگان</strong>
                  <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 6, background: 'rgba(255,255,255,0.1)' }}>
                    دائمی و آفلاین
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--hy-text-secondary)', marginTop: 4, lineHeight: 1.6 }}>
                  ✓ حساب‌ها و کارت‌های نامحدود · تراکنش‌های نامحدود · محاسبه دونگ و سفر · ذخیره محلی در مرورگر
                </div>
              </div>
              <button
                type="button"
                className="cat-mini"
                disabled={activePlanId === 'free'}
                style={{
                  fontWeight: 800,
                  background: activePlanId === 'free' ? 'rgba(16, 185, 129, 0.25)' : undefined,
                  color: activePlanId === 'free' ? 'var(--hy-income)' : undefined,
                }}
                onClick={async () => {
                  await setActivePlanId('free')
                  notifyUser('پلن به نسخه رایگان پایه تغییر یافت')
                }}
              >
                {activePlanId === 'free' ? '✓ پلن فعلی شما' : 'انتخاب نسخه رایگان'}
              </button>
            </div>

            {/* Bronze Plan Card */}
            <div
              style={{
                padding: '14px 16px',
                borderRadius: 14,
                background: activePlanId === 'bronze' ? 'rgba(56, 189, 248, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                border: activePlanId === 'bronze' ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 10,
              }}
            >
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 16 }}>🥉</span>
                  <strong style={{ fontSize: 14 }}>پلن برنزی (پیشرفته)</strong>
                  <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 6, background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
                    محبوب کاربران
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--hy-text-secondary)', marginTop: 4, lineHeight: 1.6 }}>
                  ✓ همگام‌سازی ابری چنددستگاهی · استخراج هوشمند پیامک بانکی · کارت و دونگ اشتراکی
                </div>
              </div>
              <button
                type="button"
                className="cat-mini"
                disabled={activePlanId === 'bronze'}
                style={{
                  fontWeight: 800,
                  background: activePlanId === 'bronze' ? 'rgba(56, 189, 248, 0.25)' : undefined,
                  color: activePlanId === 'bronze' ? '#38bdf8' : undefined,
                }}
                onClick={async () => {
                  await setActivePlanId('bronze')
                  notifyUser('پلن برنزی با موفقیت فعال شد')
                }}
              >
                {activePlanId === 'bronze' ? '✓ پلن فعال شما' : 'فعال‌سازی پلن برنزی'}
              </button>
            </div>

            {/* Gold VIP Plan Card */}
            <div
              style={{
                padding: '14px 16px',
                borderRadius: 14,
                background: activePlanId === 'vip' ? 'rgba(234, 179, 8, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                border: activePlanId === 'vip' ? '1px solid #facc15' : '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 10,
              }}
            >
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 16 }}>🌟</span>
                  <strong style={{ fontSize: 14 }}>پلن طلایی VIP (نامحدود)</strong>
                  <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 6, background: 'rgba(234, 179, 8, 0.2)', color: '#facc15', fontWeight: 700 }}>
                    ویژه حرفه‌ای‌ها
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--hy-text-secondary)', marginTop: 4, lineHeight: 1.6 }}>
                  ✓ تمام امکانات برنزی · هوش مصنوعی تحلیل مالی · امنیت بیومتریک پیشرفته · پشتیبانی VIP
                </div>
              </div>
              <button
                type="button"
                className="cat-mini"
                disabled={activePlanId === 'vip'}
                style={{
                  fontWeight: 800,
                  background: activePlanId === 'vip' ? 'rgba(234, 179, 8, 0.25)' : undefined,
                  color: activePlanId === 'vip' ? '#facc15' : undefined,
                }}
                onClick={async () => {
                  await setActivePlanId('vip')
                  notifyUser('پلن طلایی VIP با موفقیت فعال شد')
                }}
              >
                {activePlanId === 'vip' ? '✓ پلن فعال شما' : 'ارتقا به پلن طلایی VIP'}
              </button>
            </div>
          </div>
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
