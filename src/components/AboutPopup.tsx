import { WindowPopup } from './WindowPopup'
import { toFaDigits } from '../lib/money'

export const APP_VERSION = '0.4.0'
export const APP_UPDATE_DATE = '۲۷ آبان ۱۴۰۵ (۱۸ نوامبر ۲۰۲۶)'

export function AboutContent({ onClose }: { onClose?: () => void }) {
  const version = APP_VERSION
  const updateDate = APP_UPDATE_DATE

  const features = [
    {
      icon: '⚡',
      title: 'کیف کارت و حساب سریع با فهرست کرکره‌ای و کپی انتخابی',
      desc: 'دسترسی تک‌لمسی از صفحه خانه، منوی ثبت سریع (+)، نوار کناری دسکتاپ و کلید Alt+C؛ نمایش فهرست کارت‌ها به‌صورت کرکره‌ای همراه با تصویر کارت بانکی، منوی یکپارچه کپی انتخابی (کارت، شبا، حساب، CVV یا مشخصات کامل) و اشتراک‌گذاری فوری اطلاعات کارت.',
    },
    {
      icon: '🛡️',
      title: 'امنیت یکپارچه با رمز ورود، بیومتریک و بازگشایی خودکار گاوصندوق',
      desc: 'یکپارچه‌سازی کامل رمز گاوصندوق کارت‌ها با رمز ورود حساب‌یار جهت حذف رمزهای موازی؛ بازگشایی خودکار کارت‌ها پس از ورود با رمز، اثر انگشت، تشخیص چهره (WebAuthn) یا الگو، همراه با مهاجرت خودکار گاوصندوق‌های قبلی بدون اختلال.',
    },
    {
      icon: '🤝',
      title: 'اشتراک‌گذاری حساب و کارت تا ۱۰ کاربر با پروفایل واقعی',
      desc: 'جستجو و شناسایی کاربران با شناسه کاربری (User ID) یا شناسه اختصاصی پروفایل، نمایش عکس و نام واقعی پیش از تأیید، ارسال دعوت‌نامه در پنل کاربر مقصد و مدیریت یا قطع دسترسی هر کاربر در هر لحظه.',
    },
    {
      icon: '✨',
      title: 'منوی ثبت سریع چندمنظوره (+) با دسترسی سراسری',
      desc: 'دسترسی فوری از تمام صفحات به کیف کارت سریع، ثبت تراکنش درآمد و هزینه، قسط و وام، بدهی و طلب شخصی، چک صیادی، دونگ سفر و دستیار صوتی هوشمند.',
    },
    {
      icon: '🎙️',
      title: 'دستیار صوتی هوشمند با نمایش زنده امواج صدا',
      desc: 'ثبت بدون تایپ تراکنش‌ها از طریق گفتار زنده، سازگاری کامل با میکروفن در وب‌اپ، PWA و مرورگرهای موبایل، استخراج خودکار مبالغ و تشخیص هوشمند دسته‌بندی.',
    },
    {
      icon: '💳',
      title: 'مدیریت حساب‌ها، کارت‌ها و جیب‌های مالی تفکیک‌شده',
      desc: 'تفکیک حساب‌های نقدی و جاری، اعتباری و پس‌انداز/سرمایه‌گذاری، تعریف جیب‌های مستقل برای حساب‌ها و تشخیص هوشمند نام و رنگ بانک از شماره کارت.',
    },
    {
      icon: '📩',
      title: 'هوشمندسازی پیامک‌های بانکی و صف تأیید تراکنش‌ها',
      desc: 'شناسایی واریز و برداشت از پیامک‌های بانکی کشور، صف تراکنش‌های در انتظار تأیید با نشانگر زنده در هدر، و خواندن سریع از کلیپ‌بورد.',
    },
    {
      icon: '👥',
      title: 'سامانه کامل دُنگ، سفر و هزینه‌های گروهی با مادرخرج',
      desc: 'تعیین مادرخرج و سهم صندوق، تسویه خودکار نفر به نفر و گروه به گروه، مدیریت دسترسی مدیر رویداد و همگام‌سازی لحظه‌ای بین اعضا.',
    },
    {
      icon: '📅',
      title: 'مدیریت اقساط، وام‌ها، چک‌های صیادی و بدهی/طلب',
      desc: 'پیگیری وام‌های بانکی با جدول اقساط و بایگانی خودکار پس از تسویه، دفتر ثبت چک‌های دریافتی و صادره با یادآوری سررسید، و ثبت طلب و بدهی شخصی.',
    },
    {
      icon: '📈',
      title: 'سبد دارایی‌ها، بورس زنده TSETMC و صندوق‌های طلا',
      desc: 'استعلام آنلاین قیمت نمادهای رسمی بورس، فرابورس و صندوق‌های طلا، محاسبه ارزش روز سبد دارایی و نرخ بازدهی.',
    },
    {
      icon: '📊',
      title: 'بودجه‌بندی ماهانه هوشمند و اهداف پس‌انداز مالی',
      desc: 'تعریف سقف هزینه برای هر دسته‌بندی با نمودارهای تحلیلی مقایسه‌ای، تعیین هدف‌های مالی کوتاه‌مدت و بلندمدت و پیگیری پیشرفت.',
    },
    {
      icon: '☁️',
      title: 'پشتیبان‌گیری آفلاین، خروجی اکسل و همگام‌سازی چنددستگاهی',
      desc: 'دانلود فایل پشتیبان استاندارد JSON، خروجی اکسل (CSV)، شخصی‌سازی تم و واحد پول (تومان/ریال) و سینک امن بین گوشی و دسکتاپ.',
    },
  ]

  const changes040 = [
    'یکپارچه‌سازی رمز گاوصندوق کارت‌ها با رمز ورود به حساب‌یار: پس از ورود به برنامه (با رمز، اثر انگشت، چهره یا الگو)، کارت‌ها به‌صورت خودکار قابل مشاهده هستند و دیگر نیازی به تعیین یا وارد کردن رمز جداگانه نیست. رمز گاوصندوق‌های قبلی نیز به‌صورت خودکار به رمز ورود شما منتقل می‌شود.',
    'پنجره دسترسی سریع «کیف کارت و حساب سریع»: دسترسی فوری با یک لمس از صفحه خانه، منوی «+»، نوار کناری دسکتاپ و کلید میانبر Alt+C؛ نمایش فهرست کرکره‌ای کارت‌ها با باز شدن تصویر کارت، دکمه یکپارچه «کپی اطلاعات» با فهرست انتخابی (شماره کارت، شبا، شماره حساب، CVV و تاریخ انقضا، نام صاحب کارت یا متن کامل) و منوی اشتراک‌گذاری اطلاعات کارت.',
    'احراز هویت بیومتریک یکپارچه (اثر انگشت / تشخیص چهره): پشتیبانی کامل از WebAuthn برای ورود به حساب‌یار و بازگشایی سریع کارت‌ها در حالت قفل موقت.',
    'ارتقای سامانه اشتراک‌گذاری حساب و کارت (تا ۱۰ کاربر): شناسایی دقیق کاربران با User ID یا شناسه کاربری، نمایش عکس و مشخصات واقعی پروفایل از سرور، دعوت‌نامه تأیید در پنل کاربر مقصد و امکان مشاهده لیست افراد مشترک و قطع دسترسی در هر لحظه.',
    'بهینه‌سازی مالکیت حساب‌ها و کارت‌های شخصی در برابر موارد مشترک و بروزرسانی کامل اطلاعات نسخه ۰.۴.۰.',
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, padding: '4px 2px 16px' }}>
      {/* Brand Hero */}
      <div
        style={{
          padding: '20px 16px',
          borderRadius: 18,
          background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.18) 0%, rgba(15, 118, 110, 0.22) 100%)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 44, marginBottom: 6 }}>💎</div>
        <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: 'var(--hy-text)' }}>
          حساب‌یار (HesabYar)
        </h2>
        <p style={{ fontSize: 13, color: 'var(--hy-text-secondary)', marginTop: 4 }}>
          دستیار هوشمند و جامع مدیریت مالی شخصی، کارت‌ها، پس‌انداز و سرمایه‌گذاری
        </p>

        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            marginTop: 10,
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--hy-text)',
          }}
        >
          <span>نسخه {toFaDigits(version)}</span>
          <span aria-hidden="true" style={{ opacity: 0.4 }}>·</span>
          <span>آخرین بروزرسانی: {toFaDigits(updateDate)}</span>
        </div>
      </div>

      {/* Changelog v0.4.0 */}
      <div
        style={{
          padding: '14px 16px',
          borderRadius: 16,
          background: 'rgba(16, 185, 129, 0.14)',
          border: '1.5px solid rgba(16, 185, 129, 0.45)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <span style={{ fontSize: 16 }}>🌟</span>
          <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--hy-income)' }}>
            تغییرات و قابلیت‌های تازه در نسخه {toFaDigits(version)} (نگارش فعلی)
          </span>
        </div>
        <ul style={{ margin: 0, paddingRight: 20, fontSize: 12, color: 'var(--hy-text)', lineHeight: 1.8 }}>
          {changes040.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ul>
      </div>

      {/* All Features Grid */}
      <div>
        <h3 style={{ fontSize: 14, fontWeight: 800, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>⭐</span>
          <span>امکانات و قابلیت‌های اصلی حساب‌یار</span>
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
          {features.map((f, i) => (
            <div
              key={i}
              style={{
                padding: '12px 14px',
                borderRadius: 14,
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                gap: 12,
                alignItems: 'flex-start',
              }}
            >
              <span style={{ fontSize: 22, marginTop: 2 }}>{f.icon}</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--hy-text)' }}>{f.title}</div>
                <div style={{ fontSize: 11, color: 'var(--hy-text-secondary)', marginTop: 3, lineHeight: 1.6 }}>
                  {f.desc}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Developer & Project info */}
      <div
        style={{
          padding: '14px 16px',
          borderRadius: 16,
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          fontSize: 12,
          lineHeight: 1.8,
          color: 'var(--hy-text-secondary)',
        }}
      >
        <div><strong>سازنده:</strong> محمد احمدی</div>
        <div><strong>محیط توسعه:</strong> React 19 + TypeScript + Vite + PWA Offline First</div>
        <div><strong>نگارش و تاریخ انتشار:</strong> نسخه {toFaDigits(version)} · {toFaDigits(updateDate)}</div>
        <div style={{ marginTop: 8, fontSize: 11, opacity: 0.7 }}>
          کلیه حقوق این نرم‌افزار متعلق به توسعه‌دهنده می‌باشد. داده‌های شما با رمزنگاری استاندارد و به‌صورت کاملاً خصوصی ذخیره می‌شوند.
        </div>
      </div>

      {onClose ? (
        <button
          className="cta-confirm"
          type="button"
          onClick={onClose}
          style={{ marginTop: 4, height: 44, fontWeight: 700 }}
        >
          بستن پنجره
        </button>
      ) : null}
    </div>
  )
}

export function AboutPopup({ onClose }: { onClose: () => void }) {
  return (
    <WindowPopup
      title="درباره حساب‌یار"
      subtitle={`نسخه ${toFaDigits(APP_VERSION)} · تاریخ آخرین به‌روزرسانی: ${toFaDigits(APP_UPDATE_DATE)}`}
      icon="ℹ️"
      isOpen={true}
      onClose={onClose}
      defaultWidth={620}
      defaultHeight={640}
    >
      <AboutContent onClose={onClose} />
    </WindowPopup>
  )
}
