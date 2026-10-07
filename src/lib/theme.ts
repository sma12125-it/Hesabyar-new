export type ThemeId =
  | 'dark-obsidian'
  | 'glass'
  | 'minimal-paper'
  | 'emerald-gold'
  | 'cyber-neon'
  | 'neobrutal'
  | 'classic-navy'

export interface ThemeMeta {
  id: ThemeId
  name: string
  subtitle: string
  isDark: boolean
  preview: {
    bg: string
    card: string
    accent: string
    border: string
    text: string
  }
  badge?: string
  icon: string
}

export const THEMES: ThemeMeta[] = [
  {
    id: 'dark-obsidian',
    name: 'تاریک مات تخصصی (غیرشیشه‌ای)',
    subtitle: 'کنتراست بالا، سطوح سالید و خوانایی فوق‌العاده بدون ماتی شیشه',
    isDark: true,
    badge: 'پیشنهادی',
    icon: '🖤',
    preview: {
      bg: '#080c14',
      card: '#121826',
      accent: '#10b981',
      border: '#1f293d',
      text: '#f8fafc',
    },
  },
  {
    id: 'glass',
    name: 'شیشه‌ای و آئورا (Liquid Glass)',
    subtitle: 'افکت شکست نور شیشه مات با انعکاس‌های لطیف و طراحی شفاف',
    isDark: false,
    icon: '🪟',
    preview: {
      bg: '#fafbfc',
      card: 'rgba(255, 255, 255, 0.45)',
      accent: '#0d9488',
      border: 'rgba(255, 255, 255, 0.8)',
      text: '#0f172a',
    },
  },
  {
    id: 'minimal-paper',
    name: 'مینیمال کاغذی (Nordic Clean)',
    subtitle: 'طراحی سفید روشن، خطوط مویی دقیق، بدون شیشه و مناسب مطالعه روز',
    isDark: false,
    icon: '📄',
    preview: {
      bg: '#f1f5f9',
      card: '#ffffff',
      accent: '#0f766e',
      border: '#e2e8f0',
      text: '#0f172a',
    },
  },
  {
    id: 'emerald-gold',
    name: 'زمرد سلطنتی و طلا (Luxury Finance)',
    subtitle: 'سبز تیره جنگلی با جزئیات طلایی و حس بانکداری خصوصی لوکس',
    isDark: true,
    badge: 'لوکس',
    icon: '👑',
    preview: {
      bg: '#03140e',
      card: '#092c20',
      accent: '#f59e0b',
      border: '#d97706',
      text: '#fef3c7',
    },
  },
  {
    id: 'cyber-neon',
    name: 'سایبرپانک و نئون (Cyber Synth)',
    subtitle: 'پس‌زمینه بنفش کیهانی با درخشش فیروزه‌ای و وایب کریپتو و تکنولوژی',
    isDark: true,
    icon: '⚡',
    preview: {
      bg: '#080612',
      card: '#110d24',
      accent: '#00f0ff',
      border: '#00f0ff',
      text: '#f8fafc',
    },
  },
  {
    id: 'neobrutal',
    name: 'نئوبروتالیسم مدرن (Neo-Brutalism)',
    subtitle: 'کادرهای ضخیم مشکی ۲ پیکسلی، سایه‌های سخت هندسی و دکمه‌های پرانرژی',
    isDark: false,
    badge: 'طراحی خاص',
    icon: '🎨',
    preview: {
      bg: '#faf6f0',
      card: '#ffffff',
      accent: '#f59e0b',
      border: '#0f172a',
      text: '#0f172a',
    },
  },
  {
    id: 'classic-navy',
    name: 'سرمه‌ای رسمی (Corporate Navy)',
    subtitle: 'سرمه‌ای اداری متین با کنتراست ملایم فولادی، مناسب حسابداری شرکتی',
    isDark: true,
    icon: '🏛️',
    preview: {
      bg: '#0a1124',
      card: '#111c38',
      accent: '#38bdf8',
      border: '#1e293b',
      text: '#f8fafc',
    },
  },
]

export function getCurrentTheme(): ThemeId {
  if (typeof window === 'undefined') return 'dark-obsidian'
  const saved = localStorage.getItem('hy-theme')
  if (saved === 'dark') return 'dark-obsidian'
  if (saved === 'light') return 'glass'
  const found = THEMES.find((t) => t.id === saved)
  return found ? (found.id as ThemeId) : 'dark-obsidian'
}

export function applyTheme(themeId: ThemeId): void {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = themeId
  localStorage.setItem('hy-theme', themeId)
  window.dispatchEvent(new CustomEvent('hy-theme-change', { detail: { theme: themeId } }))
}
