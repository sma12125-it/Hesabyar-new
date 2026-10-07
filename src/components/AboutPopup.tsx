import { WindowPopup } from './WindowPopup'
import { toFaDigits } from '../lib/money'

export function AboutPopup({ onClose }: { onClose: () => void }) {
  const version = '0.2.0'
  const updateDate = '۱۶ مهر ۱۴۰۴ (اکتبر ۲۰۲۶)'

  const features = [
    {
      icon: '💳',
      title: 'مدیریت حساب‌ها و کارت‌های بانکی',
      desc: 'تفکیک دسته‌بندی نقد، بانک، اعتباری و پس‌انداز، کپی شماره شبا و کارت، همراه با تشخیص هوشمند بانک از روی شماره کارت.',
    },
    {
      icon: '⇄',
      title: 'انتقال دقیق بین حساب‌ها',
      desc: 'ثبت صحیح تراکنش در مبدأ («انتقال به...») و در مقصد («واریز از...») بدون تکرار و با محاسبه دقیق کارمزد.',
    },
    {
      icon: '📊',
      title: 'سیستم بودجه‌بندی ماهانه',
      desc: 'تعیین سقف هزینه‌ها برای هر دسته‌بندی با نوارهای هوشمند پیشرفت و هشدارهای نزدیک شدن یا عبور از سقف.',
    },
    {
      icon: '🎯',
      title: 'اهداف پس‌انداز هوشمند',
      desc: 'هدف‌گذاری برای خرید طلا، مسکن، خودرو یا وسایل، با محاسبه درصد تحقق و دکمه‌های واریز سریع.',
    },
    {
      icon: '📈',
      title: 'سبد سرمایه‌گذاری و دارایی‌ها',
      desc: 'محاسبه ارزش روز دارایی‌های طلا و سکه، بورس، صندوق‌های سرمایه‌گذاری، رمزارز و مسکن به همراه سود و زیان و نرخ بازدهی (ROI).',
    },
    {
      icon: '👥',
      title: 'ماشین‌حساب و سیستم دونگ گروهی',
      desc: 'ثبت ریز مخارج در سفرها و مهمانی‌ها با الگوریتم بهینه‌سازی بدهی‌ها برای تسویه حساب ساده بین افراد.',
    },
    {
      icon: '📅',
      title: 'مدیریت چک و اقساط',
      desc: 'رهگیری چک‌های صیادی و سررسید، وام‌های بانکی، قسط‌بندی و تبدیل هوشمند به بدهی/طلب.',
    },
    {
      icon: '📩',
      title: 'هوشمندسازی پیامک‌های بانکی',
      desc: 'استخراج خودکار تراکنش از متن پیامک بانک‌های شتاب بدون نیاز به اینترنت و با امنیت کامل.',
    },
    {
      icon: '🛡️',
      title: 'امنیت چندلایه و بیومتریک',
      desc: 'ورود با اثر انگشت یا چهره، الگوی قفل برنامه و گاوصندوق رمزگذاری‌شده کارت‌ها.',
    },
    {
      icon: '💾',
      title: 'پشتیبان‌گیری و همگام‌سازی ابری',
      desc: 'خروجی فایل اکسل (CSV)، فایل پشتیبان JSON و همگام‌سازی بلادرنگ چنددستگاهی.',
    },
  ]

  const changes020 = [
    'تفکیک دقیق و رفع هم‌پوشانی تراکنش‌های انتقال در حساب مبدأ («انتقال به...») و مقصد («واریز از...»).',
    'بازطراحی کامل صفحه بودجه به ۴ بخش کاربردی: بودجه‌بندی، اهداف پس‌انداز، سبد سرمایه‌گذاری و ماشین‌حساب دونگ.',
    'افزوده شدن بخش رسمی «درباره ما» همراه با مشخصات کامل نگارش و امکانات برنامه.',
    'بهینه‌سازی تم شیشه‌ای پاپ‌آپ‌ها، دکمه‌های تایید و فرم‌های ثبت سریع.',
    'ارتقای پکیج به نسخه 0.2.0 و آماده‌سازی برای انتشار و Push روی گیت‌هاب.',
  ]

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

        {/* Changelog v0.2.0 */}
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
              تغییرات و قابلیت‌های تازه در نسخه {toFaDigits('0.2.0')}
            </span>
          </div>
          <ul style={{ margin: 0, paddingRight: 20, fontSize: 12, color: 'var(--hy-text)', lineHeight: 1.8 }}>
            {changes020.map((c, i) => (
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
          <div><strong>مخزن کد:</strong> نسخه آماده استقرار و Push روی GitHub با برچسب v0.2.0</div>
          <div style={{ marginTop: 8, fontSize: 11, opacity: 0.7 }}>
            کلیه حقوق این نرم‌افزار متعلق به توسعه‌دهنده می‌باشد. داده‌های شما به‌صورت کاملاً خصوصی ذخیره می‌شوند.
          </div>
        </div>

        <button
          className="cta-confirm"
          type="button"
          onClick={onClose}
          style={{ marginTop: 4, height: 44, fontWeight: 700 }}
        >
          بستن پنجره
        </button>
      </div>
    </WindowPopup>
  )
}
