import { WindowPopup } from './WindowPopup'
import { toFaDigits } from '../lib/money'

export function AboutContent({ onClose }: { onClose?: () => void }) {
  const version = '0.3.4'
  const updateDate = '۱۲ آبان ۱۴۰۵ (۲ نوامبر ۲۰۲۶)'

  const features = [
    {
      icon: '✨',
      title: 'منوی ثبت سریع چندمنظوره (+) با طراحی گرافیکی مدرن',
      desc: 'دسترسی فوری با یک لمس به ثبت تراکنش درآمد/هزینه، قسط و وام، بدهی و طلب شخصی، چک صیادی، دونگ سفر و دستیار صوتی هوشمند.',
    },
    {
      icon: '🎙️',
      title: 'دستیار صوتی هوشمند با نمایش زنده امواج صدا و گوی نورانی',
      desc: 'ثبت بدون تایپ تراکنش‌ها از طریق گفتار زنده، سازگاری کامل با میکروفن در وب‌اپلیکیشن، PWA و مرورگرهای موبایل (اندروید و سافاری iOS)، استخراج خودکار مبالغ و تشخیص هوشمند دسته‌بندی.',
    },
    {
      icon: '📱',
      title: 'ویجت‌ها و میانبرهای صفحه اصلی (Home Screen) اندروید',
      desc: 'پشتیبانی از شورت‌کات‌های لانچر و ابزارک‌های دسترسی سریع در اندروید جهت ثبت آنی تراکنش، دستیار صوتی و چک‌ها مستقیماً از هوم‌اسکرین.',
    },
    {
      icon: '💳',
      title: 'مدیریت حساب‌ها، کارت‌ها و جیب‌های مالی تفکیک‌شده',
      desc: 'تعریف جیب‌های مستقل برای حساب‌ها، کسر هوشمند و شفاف از موجودی کارت مادر، تفکیک نقد، بانک، اعتباری و پس‌انداز با تشخیص هوشمند بانک از شماره کارت.',
    },
    {
      icon: '📩',
      title: 'هوشمندسازی پیامک‌های بانکی و استخراج خودکار تراکنش',
      desc: 'شناسایی واریز و برداشت از کلیه پیامک‌های بانکی کشور، صف تراکنش‌های در انتظار تأیید با نشانگر زنده در هدر، و قابلیت خواندن سریع از کلیپ‌بورد.',
    },
    {
      icon: '👥',
      title: 'سامانه کامل دُنگ، سفر و هزینه‌های گروهی با مادرخرج',
      desc: 'بخش مستقل دونگ در منوی اصلی، تعیین مادرخرج و سهم صندوق، تسویه خودکار نفر به نفر و گروه به گروه، مدیریت دسترسی مدیر رویداد و تأیید مخارج.',
    },
    {
      icon: '📅',
      title: 'مدیریت اقساط، وام‌ها، چک‌های صیادی و بدهی/طلب',
      desc: 'ثبت و پیگیری وام‌های بانکی با جدول اقساط، بایگانی خودکار پس از تسویه، دفتر ثبت چک‌های دریافتی و صادره با یادآوری سررسید، و ثبت طلب و بدهی شخصی.',
    },
    {
      icon: '📈',
      title: 'سبد دارایی‌ها، بورس زنده TSETMC و صندوق‌های طلا',
      desc: 'استعلام لحظه‌ای و آنلاین قیمت بیش از ۲۹۰ نماد رسمی بورس، فرابورس و صندوق‌های طلا، محاسبه ارزش روز کل سبد دارایی و نرخ بازدهی.',
    },
    {
      icon: '📊',
      title: 'بودجه‌بندی ماهانه هوشمند و اهداف پس‌انداز مالی',
      desc: 'تعریف سقف هزینه برای هر دسته‌بندی با نمودارهای تحلیلی مقایسه‌ای، تعیین هدف‌های مالی کوتاه‌مدت و بلندمدت و بایگانی اهداف تکمیل‌شده.',
    },
    {
      icon: '🛡️',
      title: 'امنیت چندلایه، بیومتریک و گاوصندوق کارت‌های محرمانه',
      desc: 'قفل‌گشایی با اثر انگشت یا تشخیص چهره، الگوی پترن ۹ نقطه‌ای، گاوصندوق امن کارت‌ها با رمز مستقل و کد بازیابی اضطراری، و اشتراک کارت مشترک.',
    },
    {
      icon: '🎨',
      title: 'شخصی‌سازی تم‌ها و انتخاب واحد پول پیش‌فرض',
      desc: 'انتخاب از بین ۷ استایل گرافیکی با پیش‌نمایش زنده، و تبدیل مبالغ سراسر اپ بین تومان (رایج) و ریال (رسمی بانکی).',
    },
    {
      icon: '👤',
      title: 'پروفایل کاربری، آواتار و مدیریت وضعیت اشتراک',
      desc: 'نمایش شکیل مشخصات، ویرایش فرمی اطلاعات، مدیریت پلن اشتراک نرم‌افزار و شناسه اختصاصی اشتراک کارت.',
    },
    {
      icon: '☁️',
      title: 'پشتیبان‌گیری آفلاین، خروجی اکسل و سینک چنددستگاهی',
      desc: 'دانلود فایل پشتیبان استاندارد JSON، خروجی اکسل (CSV)، و همگام‌سازی امن بدون قطعی بین چند تلفن همراه و کامپیوتر.',
    },
  ]

  const changes034 = [
    'منوی سریع و گرافیکی «+» در ناوبری: با کلیک روی دکمه + پاپ‌آپ شیک و گرافیکی باز می‌شود و ۶ دسترسی مستقیم به تراکنش جدید، قسط و وام، بدهی/طلب، چک صیادی، دونگ جدید و ورود صوتی را فراهم می‌کند.',
    'بازطراحی اساسی دستیار صوتی هوشمند (Voice Assistant): با گوی درخشان نئونی، امواج زنده فرکانس صوتی میکروفن، پشتیبانی کامل از میکروفن در وب‌اپ موبایل (اندروید و سافاری iOS)، تشخیص خودکار دسته‌بندی و مبالغ ریال/تومان و تایید سریع.',
    'ویجت‌ها و میانبرهای هوم‌اسکرین اندروید: افزوده شدن ابزارک و شورت‌کات‌های اختصاصی PWA برای دسترسی مستقیم از صفحه اصلی اندروید به ثبت تراکنش، دستیار صوتی، چک، دونگ و اقساط.',
    'بروزرسانی معرفی کامل امکانات و بخش درباره حساب‌یار به همراه نسخه ۰.۳.۴ و جزئیات دقیق تغییرات.',
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
          دستیار هوشمند و جامع مدیریت مالی شخصی، پس‌انداز و سرمایه‌گذاری
        </p>

        <div
          style={{
            display: 'inline-flex',
            gap: 12,
            marginTop: 10,
            padding: '6px 14px',
            borderRadius: 20,
            background: 'rgba(0,0,0,0.2)',
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          <span>نسخه {toFaDigits(version)}</span>
          <span style={{ opacity: 0.4 }}>·</span>
          <span>{toFaDigits(updateDate)}</span>
        </div>
      </div>

      {/* Changelog v0.3.4 */}
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
            تغییرات و قابلیت‌های تازه در نسخه {toFaDigits('0.3.4')} (نگارش فعلی)
          </span>
        </div>
        <ul style={{ margin: 0, paddingRight: 20, fontSize: 12, color: 'var(--hy-text)', lineHeight: 1.8 }}>
          {changes034.map((c, i) => (
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
        <div><strong>مخزن کد:</strong> نسخه آماده استقرار و Push روی GitHub با برچسب v0.3.4</div>
        <div style={{ marginTop: 8, fontSize: 11, opacity: 0.7 }}>
          کلیه حقوق این نرم‌افزار متعلق به توسعه‌دهنده می‌باشد. داده‌های شما به‌صورت کاملاً خصوصی ذخیره می‌شوند.
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
  const version = '0.3.4'
  const updateDate = '۱۲ آبان ۱۴۰۵ (۲ نوامبر ۲۰۲۶)'

  return (
    <WindowPopup
      title="درباره حساب‌یار"
      subtitle={`نسخه ${toFaDigits(version)} · تاریخ آخرین به‌روزرسانی: ${toFaDigits(updateDate)}`}
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
