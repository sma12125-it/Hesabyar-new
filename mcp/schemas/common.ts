import { z } from 'zod'

export const currencySchema = z
  .enum(['IRT', 'IRR'])
  .default('IRT')
  .describe('واحد پول: IRT (تومان) یا IRR (ریال). پیش‌فرض تومان است.')

export const dryRunSchema = z
  .boolean()
  .optional()
  .default(false)
  .describe('اگر true باشد، فقط اعتبارسنجی و پیش‌نمایش تراز جدید انجام می‌شود و تغییری در پایگاه داده ثبت نخواهد شد.')

export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'فرمت تاریخ باید YYYY-MM-DD باشد')
  .optional()
  .describe('تاریخ میلادی تراکنش (YYYY-MM-DD). در صورت عدم ارسال، تاریخ روز در نظر گرفته می‌شود.')

/**
 * Standard MCP response format for tool content
 */
export function formatSuccessResponse(data: unknown, message?: string) {
  const payload = {
    success: true,
    ...(message ? { message } : {}),
    data,
  }
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(payload, null, 2),
      },
    ],
  }
}

/**
 * Standard MCP error response format
 */
export function formatErrorResponse(error: unknown) {
  let message = 'خطای ناشناخته در انجام عملیات'
  let code = 'INTERNAL_ERROR'

  if (error instanceof Error) {
    message = error.message
    if (message.includes('401') || message.includes('Unauthorized') || message.includes('توکن')) {
      code = 'AUTHENTICATION_REQUIRED'
      message = 'احراز هویت الزامی است: لطفاً توکن دسترسی حسابیار (Bearer Token) را در تنظیمات اتصال وارد کنید.'
    } else if (message.includes('403') || message.includes('Forbidden')) {
      code = 'PERMISSION_DENIED'
    } else if (message.includes('404') || message.includes('پیدا نشد') || message.includes('یافت نشد')) {
      code = 'NOT_FOUND'
    } else if (message.includes('400') || message.includes('نامعتبر') || message.includes('کافی نیست')) {
      code = 'INVALID_INPUT'
    }
  }

  const payload = {
    success: false,
    code,
    error: message,
  }

  return {
    isError: true,
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(payload, null, 2),
      },
    ],
  }
}
