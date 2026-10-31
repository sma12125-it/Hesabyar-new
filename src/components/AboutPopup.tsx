import { WindowPopup } from './WindowPopup'
import { toFaDigits } from '../lib/money'

export function AboutContent({ onClose }: { onClose?: () => void }) {
  const version = '0.3.3'
  const updateDate = '۹ آبان ۱۴۰۵ (۳۱ اکتبر ۲۰۲۶)'

  const features = [
    {
      icon: '💳',
      title: 'مدیریت حساب‌ها، کارت‌ها و جیب‌های مالی',
      desc: 'تعریف جیب‌های مستقل برای حساب‌ها، کسر هوشمند و شفاف از موجودی کارت مادر، تفکیک نقد، بانک، اعتباری و پس‌انداز با تشخیص هوشمند بانک از شماره کارت.',
    },
    {
      icon: '📩',
      title: 'هوشمندسازی پیامک‌های بانکی و استخراج تراکنش',
      desc: 'شناسایی واریز و برداشت از پیامک‌های شتاب کشور، صف تراکنش‌های در انتظار تأیید با دکمه دسترسی سریع و خواندن هوشمند از کلیپ‌بورد.',
    },
    {
      icon: '👥',
      title: 'بخش مستقل دونگ و سفر با مدیریت دسترسی اعضا',
      desc: 'سامانه کامل دُنگ و سفرها در منوی اصلی، مدیریت تک‌نفره مدیر رویداد، ارسال تغییرات سایر اعضا جهت تأیید مدیر و تسویه حساب نفر به نفر.',
    },
    {
      icon: '📱',
      title: 'منوی ناوبری مدرن، سایدبار کشویی و تجربه روان موبایل',
      desc: 'طراحی واکنش‌گرا با منوی همبرگری سمت راست، هدرهای غیرچسبان متحرک با اسکرول صفحه، و نوار ناوبری ۵ گزینه‌ای با دکمه ثبت در مرکز.',
    },
    {
      icon: '🛡️',
      title: 'امنیت یکپارچه، بیومتریک و گاوصندوق کارت‌ها',
      desc: 'ورود با اثر انگشت یا تشخیص چهره، الگوی پترن، گاوصندوق کارت‌های محرمانه با رمز و کد بازیابی اضطراری، و پیوستن امن به کارت مشترک.',
    },
    {
      icon: '🎨',
      title: 'شخصی‌سازی تم‌ها و انتخاب واحد پول پیش‌فرض',
      desc: 'انتخاب از بین ۷ استایل گرافیکی با پیش‌نمایش زنده، و سوییچ مبالغ سراسر اپ بین تومان (رایج) و ریال (رسمی بانکی).',
    },
    {
      icon: '👤',
      title: 'پروفایل کاربری، آواتار و مدیریت وضعیت اشتراک',
      desc: 'حالت نمایش شکیل مشخصات، ویرایش فرمی اطلاعات، مدیریت پلن اشتراک نرم‌افزار و شناسه یکتای اشتراک کارت.',
    },
    {
      icon: '📅',
      title: 'مدیریت اقساط، چک و بایگانی وام‌ها',
      desc: 'رهگیری اقساط باقیمانده، سررسیدها، وام‌های تسویه‌شده و بایگانی خودکار با یادآوری.',
    },
    {
      icon: '☁️',
      title: 'پشتیبان‌گیری آفلاین، اکسل و همگام‌سازی زنده',
      desc: 'دانلود فایل JSON، خروجی استاندارد اکسل (CSV)، و اتصال اختیاری به پایگاه‌داده اختصاصی Supabase.',
    },
    {
      icon: '🤖',
      title: 'اتصال هوش مصنوعی و پروتکل MCP',
      desc: 'پیکربندی اتصال مستقیم به ChatGPT و دستیارهای هوشمند جهت استعلام و مدیریت صوت و متن مالی.',
    },
  ]

  const changes033 = [
    'سامانه مستقل دُنگ و سفر: انتقال دونگ از صفحه بودجه به بخش مستقل در منوی اصلی، چیدمان بهینه کارت‌های سفر، دکمه‌های تسویه و حذف زیر توضیحات، و اعمال سطح دسترسی مدیر رویداد.',
    'اصلاح منطق جیب‌های حساب: کسر خودکار مخارج جیب‌های فرعی از حساب اصلی در صورت عدم تخصیص بودجه و نمایش شفاف مخارج هر جیب.',
    'بازطراحی ناوبری و هدرها: منوی همبرگری سمت راست، هدرهای آزاد و شناور با اسکرول (Unpin)، حذف دکمه تنظیمات از بالای صفحات و انتقال کامل به سایدبار.',
    'یکپارچه‌سازی مرکز امنیت در تنظیمات: تجمیع الگوی ورود، اثر انگشت و چهره، گاوصندوق کارت‌ها و کارت مشترک در یک بخش منسجم با زبانه‌های دسته‌بندی‌شده.',
    'بخش شخصی‌سازی نو: امکان باز و بسته کردن منوی تم‌ها و انتخاب مستقیم واحد پول پیش‌فرض (تومان / ریال).',
    'پروفایل و اشتراک نرم‌افزار: نمایش مستقیم اطلاعات ذخیره‌شده و باز شدن فرم فقط با زدن دکمه ویرایش، به همراه مشاهده پلن‌های اشتراک.',
    'هوشمندسازی پیامک‌های بانکی: افزودن دکمه صندوق پیامک با نشانگر تعداد پیام‌های در انتظار تایید در هدر خانه، و قابلیت خواندن سریع از کلیپ‌بورد.',
    'مرکز بروزرسانی بازطراحی‌شده: نمایش نگارش ۰.۳.۳، امکان آپدیت فوری وب‌اپ و دریافت نسخه اصلاح‌شده بسته نصبی اندروید (APK) به همراه راهنمای نصب PWA.',
  ]

  const changes032 = [
    'همگام‌سازی بی‌نقص ابری و رفع مشکل حذف تراکنش‌ها: بازنویسی الگوریتم ادغام زنده اطلاعات مالی، جلوگیری از حذف یا بازنویسی تراکنش‌های تازه ثبت‌شده و ادغام دوطرفه تراکنش‌ها بین دستگاه‌ها.',
    'پایگاه جامع نمادهای رسمی بورس (۲۹۰+ نماد فعال): پوشش کلیه صنایع بورس و فرابورس (فلزات، پتروپالایش، بانک، خودرو، دارو، سیمان، زراعت، رایانه، صندوق‌های طلا و اهرمی) همراه با جستجوی سریع و دکمه بازخوانی.',
    'درج خودکار آنی قیمت روز هر واحد: با انتخاب هر نماد از فهرست رسمی، قیمت آخرین معامله فوراً در ارزش روز هر واحد درج و با داشتن تعداد، ارزش کل دارایی محاسبه می‌شود بدون هیچ خطای عدم یافت نماد.',
    'سرویس ذخیره‌سازی ابری دوگانه: اضافه شدن اندپوینت اختصاصی سرور /api/v1/sync/snapshot جهت پشتیبان‌گیری ایمن و پایداری کامل همگام‌سازی میان تمام مرورگرها و دستگاه‌ها.',
  ]

  const changes031 = [
    'سرویس بک‌اند TSETMC: تعریف تابع اختصاصی fetchTsetmcPriceByInscode که با دریافت کد نماد (inscode)، آخرین قیمت معامله (pDrCotVal) و پایانی (pClosing) را از وب‌سرویس بورس دریافت و در سیستم بروزرسانی می‌کند.',
    'فهرست رسمی نمادهای بورس: افزوده شدن پنجره هوشمند انتخاب نماد از بین تمامی نمادهای رسمی بورس و فرابورس با دسته‌بندی (صندوق‌های طلا، اهرمی، سهام شاخص، درآمد ثابت) برای رفع قطعی خطاهای تایپی.',
    'درج خودکار قیمت روز: با کلیک روی هر نماد از فهرست، آخرین قیمت روز به صورت آنی دریافت و در بهای روز هر واحد درج و با تغییر تعداد، ارزش کل دارایی خودکار محاسبه می‌شود.',
    'چیپ‌های دسترسی سریع: اضافه شدن دکمه‌های سریع برای پربیننده‌ترین نمادهای طلا، اهرمی و سهام (اهرم، عیار، طلا، کهربا، فولاد، فملی، شستا و...) در فرم دارایی.',
  ]

  const changes030 = [
    'محاسبه دونگ: تفکیک رویدادها به دو دسته «فعال» و «تسویه شده»، فرم ساخت رویداد در پنجره جداگانه با دکمه «+ رویداد جدید»، و امکان بازگشت رویداد به حالت فعال.',
    'محاسبه دونگ: امکان ویرایش کامل هزینه‌های ثبت‌شده، کوتاه شدن دکمه به «تقسیم دستی»، و تقسیم خودکار و دقیق مبالغ باقیمانده بین سایر افراد بدون کسری یا مازاد.',
    'محاسبه دونگ: بازنگری اساسی و دقیق فرمول محاسبه تسویه حساب («چه کسی به چه کسی بدهد») و امکان علامت‌گذاری و ثبت تسویه برای تک‌تک پرداخت‌های دونگ.',
    'سرمایه‌گذاری: نمایش دائمی سبد دارایی‌ها با دکمه «+ دارایی جدید»، اضافه و ویرایش دسته‌بندی‌ها، و فیلتر فقط برای دسته‌های موجود در سبد.',
    'بورس و صندوق‌ها: اتصال زنده به سایت TSETMC جهت استعلام قیمت روز هر نماد، محاسبه لحظه‌ای ارزش کل پرتفوی و به‌روزرسانی خودکار با باز شدن صفحه.',
    'بودجه‌بندی: افزوده شدن نمودارهای کاربردی و تحلیلی از هزینه‌های ماهانه به تفکیک دسته، نمایش لیست سقف‌ها با دکمه «+ سقف جدید» و فرم افزودن/ویرایش دسته.',
    'اهداف مالی: تفکیک اهداف به دو بخش «اهداف فعال» و «بایگانی شده»، دکمه «+ هدف جدید» با امکان افزودن و ویرایش دسته‌بندی‌ها.',
    'تم‌ها: هماهنگی و یکپارچگی سراسری تم‌ها از صفحه اسپلش و ورود (لاگین)، الگوی قفل، رنگ دکمه‌ها، کارت‌ها و کادرهای تمام بخش‌های اپ.',
    'همگام‌سازی ابری: رفع اساسی مشکلات عدم همگام‌سازی بدهی‌ها، رویدادهای دونگ و دارایی‌ها بین دستگاه‌های مختلف.',
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

      {/* Changelog v0.3.3 */}
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
            تغییرات و قابلیت‌های تازه در نسخه {toFaDigits('0.3.3')} (نگارش فعلی)
          </span>
        </div>
        <ul style={{ margin: 0, paddingRight: 20, fontSize: 12, color: 'var(--hy-text)', lineHeight: 1.8 }}>
          {changes033.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ul>
      </div>

      {/* Changelog v0.3.2 */}
      <div
        style={{
          padding: '14px 16px',
          borderRadius: 16,
          background: 'rgba(37, 99, 235, 0.14)',
          border: '1.5px solid rgba(37, 99, 235, 0.45)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <span style={{ fontSize: 16 }}>⚡</span>
          <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--hy-accent)' }}>
            تغییرات پیشین در نسخه {toFaDigits('0.3.2')}
          </span>
        </div>
        <ul style={{ margin: 0, paddingRight: 20, fontSize: 12, color: 'var(--hy-text)', lineHeight: 1.8 }}>
          {changes032.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ul>
      </div>

      {/* Changelog v0.3.1 */}
      <div
        style={{
          padding: '14px 16px',
          borderRadius: 16,
          background: 'rgba(255, 255, 255, 0.04)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <span style={{ fontSize: 16 }}>🔹</span>
          <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--hy-text)' }}>
            تغییرات پیشین در نسخه {toFaDigits('0.3.1')}
          </span>
        </div>
        <ul style={{ margin: 0, paddingRight: 20, fontSize: 12, color: 'var(--hy-text)', lineHeight: 1.8 }}>
          {changes031.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ul>
      </div>

      {/* Changelog v0.3.0 */}
      <div
        style={{
          padding: '14px 16px',
          borderRadius: 16,
          background: 'rgba(16, 185, 129, 0.1)',
          border: '1px solid rgba(16, 185, 129, 0.25)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <span style={{ fontSize: 16 }}>🚀</span>
          <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--hy-income)' }}>
            تغییرات پیشین در نسخه {toFaDigits('0.3.0')}
          </span>
        </div>
        <ul style={{ margin: 0, paddingRight: 20, fontSize: 12, color: 'var(--hy-text)', lineHeight: 1.8 }}>
          {changes030.map((c, i) => (
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
        <div><strong>مخزن کد:</strong> نسخه آماده استقرار و Push روی GitHub با برچسب v0.3.3</div>
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
  const version = '0.3.3'
  const updateDate = '۹ آبان ۱۴۰۵ (۳۱ اکتبر ۲۰۲۶)'

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
