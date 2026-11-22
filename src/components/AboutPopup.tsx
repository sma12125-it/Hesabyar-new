import { WindowPopup } from './WindowPopup'
import { toFaDigits } from '../lib/money'

export const APP_VERSION = '0.4.0'
export const APP_UPDATE_DATE = '۲۷ آبان ۱۴۰۵ (۱۸ نوامبر ۲۰۲۶)'

export function AboutContent({ onClose }: { onClose?: () => void }) {
  const version = APP_VERSION
  const updateDate = APP_UPDATE_DATE

  const features = [
    {
      icon: '💳',
      title: 'کیف کارت و حساب سریع با فهرست کرکره‌ای و کپی انتخابی',
      desc: 'دسترسی تک‌لمسی از صفحه خانه، منوی ثبت سریع (+)، نوار کناری دسکتاپ و کلید Alt+C؛ نمایش فهرست کارت‌ها به‌صورت کرکره‌ای همراه با تصویر کارت بانکی، منوی یکپارچه کپی انتخابی (کارت، شبا، حساب، CVV یا مشخصات کامل) و اشتراک‌گذاری فوری اطلاعات کارت.',
    },
    {
      icon: '🔐',
      title: 'امنیت یکپارچه، اثر انگشت / چهره واقعی، پین سریع و دسترسی خودکار به کارت‌ها',
      desc: 'حذف کامل بخش و رمز جداگانه گاوصندوق؛ به محض ورود به حساب‌یار با رمز عبور، حسگر واقعی اثر انگشت/تشخیص چهره (محلی روی دستگاه بدون نیاز به Passkey ابری)، پین عددی یا الگو، کارت‌های شما به‌طور خودکار در دسترس هستند.',
    },
    {
      icon: '🤝',
      title: 'اشتراک‌گذاری حساب و کارت تا ۱۰ کاربر با پروفایل واقعی',
      desc: 'جستجو و شناسایی کاربران با شناسه کاربری (User ID) یا شناسه اختصاصی پروفایل، نمایش عکس و نام واقعی پیش از تأیید، ارسال دعوت‌نامه در پنل کاربر مقصد و مدیریت یا قطع دسترسی هر کاربر در هر لحظه.',
    },
    {
      icon: '✨',
      title: 'منوی ثبت سریع چندمنظوره (+) با دسترسی سراسری',
      desc: 'دسترسی فوری از تمام صفحات به کیف کارت سریع، ثبت تراکنش درآمد و هزینه، قسط و وام، بدهی و طلب شخصی، چک صیادی، دونگ سفر و ثبت صوتی.',
    },
    {
      icon: '🎙️',
      title: 'ثبت صوتی تراکنش با نمایش زنده امواج صدا',
      desc: 'ثبت بدون تایپ تراکنش‌ها از طریق گفتار زنده، سازگاری کامل با میکروفن در وب‌اپ، PWA و مرورگرهای موبایل، استخراج خودکار مبالغ و تشخیص دسته‌بندی.',
    },
    {
      icon: '🏦',
      title: 'مدیریت حساب‌ها، کارت‌ها و جیب‌های مالی تفکیک‌شده',
      desc: 'تفکیک حساب‌های نقدی و جاری، اعتباری و پس‌انداز/سرمایه‌گذاری، تعریف جیب‌های مستقل برای حساب‌ها و تشخیص نام و رنگ بانک از شماره کارت.',
    },
    {
      icon: '📩',
      title: 'پردازش پیامک‌های بانکی و صف تأیید تراکنش‌ها',
      desc: 'شناسایی واریز و برداشت از پیامک‌های بانکی کشور، صف تراکنش‌های در انتظار تأیید با نشانگر زنده در هدر، و خواندن سریع از کلیپ‌بورد.',
    },
    {
      icon: '👥',
      title: 'سامانه کامل دُنگ، سفر و هزینه‌های گروهی با مادرخرج',
      desc: 'تعیین مادرخرج و سهم صندوق، تسویه خودکار نفر به نفر و گروه به گروه، مدیریت دسترسی مدیر رویداد و همگام‌سازی لحظه‌ای بین اعضا.',
    },
    {
      icon: '🗓️',
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
      title: 'بودجه‌بندی ماهانه و اهداف پس‌انداز مالی',
      desc: 'تعریف سقف هزینه برای هر دسته‌بندی با نمودارهای تحلیلی مقایسه‌ای، تعیین هدف‌های مالی کوتاه‌مدت و بلندمدت و پیگیری پیشرفت.',
    },
    {
      icon: '☁️',
      title: 'پشتیبان‌گیری آفلاین، خروجی اکسل و همگام‌سازی چنددستگاهی',
      desc: 'دانلود فایل پشتیبان استاندارد JSON، خروجی اکسل (CSV)، شخصی‌سازی تم و واحد پول (تومان/ریال) و سینک امن بین گوشی و دسکتاپ.',
    },
  ]

  const changes040 = [
    'دسترسی خودکار و یکپارچه به کارت‌ها بدون رمز مجزا: بخش گاوصندوق و درخواست رمز دوم از صفحات کارت‌ها، کیف کارت سریع و تنظیمات حذف شد. با ورود به حساب‌یار، رمزنگاری کارت‌ها به‌صورت خودکار با رمز ورود اصلی همگام و باز می‌شود و از نسخه‌های پشتیبان نیز محافظت می‌گردد.',
    'احراز هویت واقعی اثر انگشت / تشخیص چهره (محلی بدون Passkey ابری) و پین عددی سریع: ورود بیومتریک با فراخوانی واقعی حسگر سخت‌افزاری دستگاه و افزودن پین ۴ تا ۶ رقمی برای تمام دستگاه‌ها.',
    'پنجره دسترسی سریع «کیف کارت و حساب سریع»: دسترسی فوری با یک لمس از صفحه خانه، منوی «+»، نوار کناری دسکتاپ و کلید میانبر Alt+C؛ نمایش فهرست کرکره‌ای کارت‌ها با باز شدن تصویر کارت، دکمه یکپارچه «کپی اطلاعات» با فهرست انتخابی و منوی اشتراک‌گذاری اطلاعات کارت.',
    'ارتقای سامانه اشتراک‌گذاری حساب و کارت (تا ۱۰ کاربر): شناسایی دقیق کاربران با User ID یا شناسه کاربری، نمایش عکس و مشخصات واقعی پروفایل از سرور، دعوت‌نامه تأیید در پنل کاربر مقصد و امکان مشاهده لیست افراد مشترک و قطع دسترسی در هر لحظه.',
    'بهینه‌سازی مالکیت حساب‌ها و کارت‌های شخصی در برابر موارد مشترک و بروزرسانی کامل اطلاعات نسخه ۰.۴.۰.',
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '4px 2px 16px' }}>
      <div
        style={{
          padding: '20px 16px',
          borderRadius: 20,
          background: 'linear-gradient(135deg, rgba(13, 148, 136, 0.18), rgba(56, 189, 248, 0.12))',
          border: '1px solid rgba(13, 148, 136, 0.35)',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 42, lineHeight: 1, marginBottom: 8 }}>💰</div>
        <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: 'var(--hy-text)' }}>
          حساب‌یار (HesabYar)
        </h2>
        <p style={{ fontSize: 13, color: 'var(--hy-text-secondary)', marginTop: 4 }}>
          دستیار جامع و یکپارچه مدیریت مالی شخصی، حساب‌ها، کارت‌ها، اقساط و سرمایه‌گذاری
        </p>

        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            marginTop: 8,
            padding: '4px 12px',
            borderRadius: 99,
            background: 'rgba(13, 148, 136, 0.2)',
            border: '1px solid rgba(13, 148, 136, 0.35)',
            fontSize: 11.5,
            fontWeight: 700,
            color: 'var(--hy-teal)',
          }}
        >
          <span>نسخه {toFaDigits(version)}</span>
          <span aria-hidden="true">•</span>
          <span>آخرین بروزرسانی: {toFaDigits(updateDate)}</span>
        </div>
      </div>

      <div
        style={{
          padding: '14px 16px',
          borderRadius: 16,
          background: 'rgba(16, 185, 129, 0.1)',
          border: '1px solid rgba(16, 185, 129, 0.28)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <span style={{ fontSize: 16 }}>✨</span>
          <span style={{ fontWeight: 800, fontSize: 13.5, color: 'var(--hy-income)' }}>
            تغییرات و قابلیت‌های تازه در نسخه {toFaDigits(version)} (نگارش فعلی)
          </span>
        </div>
        <ul style={{ margin: 0, paddingRight: 20, fontSize: 12, color: 'var(--hy-text)', lineHeight: 1.8 }}>
          {changes040.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ul>
      </div>

      <div>
        <h3 style={{ fontSize: 14, fontWeight: 800, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>🚀</span>
          <span>امکانات و قابلیت‌های اصلی حساب‌یار</span>
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {features.map((f, i) => (
            <div
              key={i}
              style={{
                padding: '12px 14px',
                borderRadius: 14,
                background: 'var(--hy-input-bg)',
                border: '1px solid var(--hy-border-color)',
                display: 'flex',
                gap: 12,
                alignItems: 'flex-start',
              }}
            >
              <span style={{ fontSize: 22, lineHeight: 1.2, flexShrink: 0 }}>{f.icon}</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--hy-text)' }}>{f.title}</div>
                <div style={{ fontSize: 11.5, color: 'var(--hy-text-secondary)', marginTop: 3, lineHeight: 1.6 }}>
                  {f.desc}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          padding: '14px 16px',
          borderRadius: 14,
          background: 'var(--hy-input-bg)',
          border: '1px solid var(--hy-border-color)',
          fontSize: 12,
          lineHeight: 1.8,
          color: 'var(--hy-text-secondary)',
        }}
      >
        <div><strong>سازنده:</strong> محمد احمدی</div>
        <div><strong>محیط توسعه:</strong> React 19 + TypeScript + Vite + PWA Offline First</div>
        <div><strong>نگارش و تاریخ انتشار:</strong> نسخه {toFaDigits(version)} · {toFaDigits(updateDate)}</div>
        <div style={{ marginTop: 8, fontSize: 11, opacity: 0.75 }}>
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
