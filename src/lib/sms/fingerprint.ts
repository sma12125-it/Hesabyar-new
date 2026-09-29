/** Stable fingerprint so the same SMS cannot enter the review queue twice. */
export function smsFingerprint(parts: {
  sender: string
  normalizedMessage: string
  amountKey: string
  reference: string
  maskedCard: string
}): string {
  const payload = [parts.sender, parts.amountKey, parts.reference, parts.maskedCard, parts.normalizedMessage]
    .map((part) => part.trim().toLowerCase())
    .join('|')
  return fnv1a(payload)
}

function fnv1a(text: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}
