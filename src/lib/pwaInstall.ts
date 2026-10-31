/**
 * Native PWA Installation Hook and Helper.
 * Captures beforeinstallprompt to provide 1-tap installation on Android & Desktop,
 * bypassing invalid manual APK packaging problems entirely.
 */

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed'
    platform: string
  }>
  prompt(): Promise<void>
}

let globalPrompt: BeforeInstallPromptEvent | null = null

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    globalPrompt = e as BeforeInstallPromptEvent
    window.dispatchEvent(new CustomEvent('hy:pwa-prompt-ready'))
  })

  window.addEventListener('appinstalled', () => {
    globalPrompt = null
  })
}

export function canPromptInstall(): boolean {
  return globalPrompt !== null
}

export async function promptPwaInstall(): Promise<'accepted' | 'dismissed' | 'unsupported'> {
  if (!globalPrompt) {
    return 'unsupported'
  }
  try {
    await globalPrompt.prompt()
    const { outcome } = await globalPrompt.userChoice
    if (outcome === 'accepted') {
      globalPrompt = null
    }
    return outcome
  } catch {
    return 'unsupported'
  }
}
