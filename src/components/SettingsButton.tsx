import { NavLink } from 'react-router-dom'

export function SettingsButton() {
  return (
    <NavLink to="/settings" className="icon-btn settings-inline" aria-label="تنظیمات">
      ⚙
    </NavLink>
  )
}
