import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { hesabyarApi } from '../client/hesabyarApi'
import { formatErrorResponse, formatSuccessResponse } from '../schemas/common'

export function registerReminderTools(server: McpServer) {
  // 1. get_upcoming_reminders
  server.registerTool(
    'get_upcoming_reminders',
    {
      title: 'سررسیدهای پیش‌رو و یادآورها',
      description:
        'مشاهده کلیه تعهدات مالی و سررسیدهای آتی و معوقه شامل قسط‌های وام، چک‌های صیادی و موعد بازپرداخت بدهی‌ها در روزهای آینده. بهترین ابزار برای پاسخ به کاربر در مورد "چه چک‌ها یا قسط‌هایی در این هفته سررسید می‌شوند؟".',
      inputSchema: {
        leadDays: z
          .number()
          .int()
          .positive()
          .optional()
          .default(7)
          .describe('تعداد روزهای آینده برای بررسی سررسیدها (پیش‌فرض ۷ روز)'),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({ leadDays }) => {
      try {
        const reminders = await hesabyarApi.get('/reminders/upcoming', { leadDays })
        return formatSuccessResponse(reminders)
      } catch (err) {
        return formatErrorResponse(err)
      }
    },
  )

  // 2. get_reminders_settings
  server.registerTool(
    'get_reminders_settings',
    {
      title: 'تنظیمات یادآورهای مالی',
      description: 'مشاهده وضعیت فعال بودن اعلان‌های یادآور و تعداد روزهای هشدار قبل از سررسید (leadDays).',
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async () => {
      try {
        const settings = await hesabyarApi.get('/reminders')
        return formatSuccessResponse(settings)
      } catch (err) {
        return formatErrorResponse(err)
      }
    },
  )

  // 3. update_reminders_settings
  server.registerTool(
    'update_reminders_settings',
    {
      title: 'به‌روزرسانی تنظیمات یادآورها',
      description: 'فعال یا غیرفعال کردن یادآورها و تعیین فاصله زمانی هشدار قبل از سررسید (مثلاً ۲ یا ۳ روز قبل).',
      inputSchema: {
        enabled: z.boolean().describe('فعال یا غیرفعال بودن اعلان یادآورها'),
        leadDays: z.number().int().min(1).max(30).describe('تعداد روزهای هشدار قبل از موعد سررسید'),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const result = await hesabyarApi.put('/reminders', params)
        return formatSuccessResponse(result, 'تنظیمات یادآور با موفقیت ذخیره شد')
      } catch (err) {
        return formatErrorResponse(err)
      }
    },
  )
}
