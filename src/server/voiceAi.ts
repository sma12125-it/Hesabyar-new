import { GoogleGenAI } from '@google/genai'

export interface VoiceTranscribeResult {
  success: boolean
  transcript?: string
  draft?: {
    kind: 'expense' | 'income'
    amount: number
    note: string
    matchedAccountId?: string | null
    matchedAccountName?: string | null
  }
  error?: string
}

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return null
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  })
}

export async function transcribeAndParsePersianAudio(
  base64Audio: string,
  mimeType: string,
  accounts: Array<{ id: string; name: string }> = [],
): Promise<VoiceTranscribeResult> {
  const ai = getGeminiClient()
  if (!ai) {
    return {
      success: false,
      error: 'GEMINI_API_KEY_NOT_CONFIGURED',
    }
  }

  // Normalize MIME type for Gemini
  let cleanMimeType = mimeType.split(';')[0]?.trim() || 'audio/webm'
  if (cleanMimeType === 'audio/x-wav') cleanMimeType = 'audio/wav'
  if (cleanMimeType === 'audio/m4a') cleanMimeType = 'audio/mp4'

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [
        {
          inlineData: {
            mimeType: cleanMimeType,
            data: base64Audio,
          },
        },
        {
          text: `شما یک دستیار هوشمند صوتی و حسابدار خبره برای نرم‌افزار حسابداری حساب‌یار (HesabYar) هستید.
لطفاً این فایل صوتی را که به زبان فارسی توسط کاربر گفته شده با دقت تحلیل کنید:
۱. متن دقیق گفته‌شده به زبان فارسی را استخراج کنید (transcript).
۲. تراکنش مالی را استخراج کنید:
   - نوع (kind): "expense" برای هزینه/خرید/برداشت یا "income" برای واریز/درآمد/حقوق/پاداش.
   - مبلغ به ریال (amount): در زبان فارسی روزمره، مبالغ عموماً به «تومان» گفته می‌شوند (هر تومان = ۱۰ ریال). مثلاً «۵۰ هزار تومان» یا «پنجاه تومن» = ۵۰۰۰۰۰ ریال. «دو میلیون» = ۲۰۰۰۰۰۰۰ ریال. اگر کاربر صراحتاً گفت «ریال»، همان عدد ریال است. عدد را به صورت عدد صحیح ریال ثبت کنید.
   - یادداشت/بابت (note): عنوان مشخص و پاکیزه (مانند «کرایه تاکسی»، «خرید نان»، «حقوق ماهانه»)، بدون ذکر نام بانک یا مبلغ.
   - حساب بانکی (matchedAccountId و matchedAccountName): اگر کاربر نام بانکی یا حسابی مانند ملت، ملی، سامان، بلو، پاسارگاد، سپه، نقد یا ... را ذکر کرد، از بین حساب‌های لیست زیر مورد متناظر را انتخاب کنید؛ در غیر این صورت null قرار دهید.

حساب‌های بانکی کاربر:
${JSON.stringify(accounts)}

پاسخ شما باید دقیقاً یک آبجکت JSON معتبر به این فرمت باشد:
{
  "transcript": "متن دقیق گفتار کاربر",
  "kind": "expense",
  "amount": 500000,
  "note": "کرایه تاکسی",
  "matchedAccountId": "id_or_null",
  "matchedAccountName": "name_or_null"
}`,
        },
      ],
      config: {
        responseMimeType: 'application/json',
      },
    })

    const rawJson = response.text?.trim() || ''
    if (!rawJson) {
      return { success: false, error: 'NO_RESPONSE_FROM_AI' }
    }

    const parsed = JSON.parse(rawJson) as {
      transcript?: string
      kind?: 'expense' | 'income'
      amount?: number
      note?: string
      matchedAccountId?: string | null
      matchedAccountName?: string | null
    }

    return {
      success: true,
      transcript: parsed.transcript || '',
      draft: {
        kind: parsed.kind === 'income' ? 'income' : 'expense',
        amount: Math.max(0, Math.round(Number(parsed.amount) || 0)),
        note: (parsed.note || '').trim(),
        matchedAccountId: parsed.matchedAccountId || null,
        matchedAccountName: parsed.matchedAccountName || null,
      },
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return {
      success: false,
      error: msg,
    }
  }
}
