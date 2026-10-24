import type { SharedAssetView } from './profile'

type Listener = () => void

let assets: SharedAssetView[] = []
const listeners = new Set<Listener>()

export function sharedAssetViews(): SharedAssetView[] {
  return assets
}

export function replaceSharedAssets(next: SharedAssetView[]) {
  assets = next
  listeners.forEach((listener) => listener())
}

export function subscribeSharedAssets(listener: Listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
