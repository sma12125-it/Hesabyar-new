import { WindowPopup } from './WindowPopup'
import { ThemeGallery } from './ThemeGallery'

export function ThemeModal({ onClose }: { onClose: () => void }) {
  return (
    <WindowPopup
      title="انتخاب تم ظاهری"
      subtitle="انتخاب از بین ۷ استایل طراحی متفاوت با پالت رنگی و چیدمان اختصاصی"
      icon="🎨"
      isOpen={true}
      onClose={onClose}
      defaultWidth={560}
      defaultHeight={600}
    >
      <div style={{ padding: '4px 2px 14px' }}>
        <ThemeGallery />
      </div>
    </WindowPopup>
  )
}
