export function PlaceholderPage({
  title,
  icon,
  message,
}: {
  title: string
  icon: string
  message: string
}) {
  return (
    <div className="app-scroll">
      <div className="top-row">
        <h1>{title}</h1>
        <span style={{ width: 40 }} />
      </div>
      <div className="empty-state lg">
        <div className="empty-ico">{icon}</div>
        <h2>به‌زودی</h2>
        <p>{message}</p>
      </div>
    </div>
  )
}
