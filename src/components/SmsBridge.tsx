import { useEffect } from 'react'
import { attachNativeSmsHost } from '../lib/sms/reader'

/** Attaches a native SMS host when one already exists. It does not read the inbox itself. */
export function SmsBridge() {
  useEffect(() => attachNativeSmsHost(), [])
  return null
}
