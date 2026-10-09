import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { hesabyarApi } from '../client/hesabyarApi'
import { formatErrorResponse, formatSuccessResponse } from '../schemas/common'

export function registerSharingTools(server: McpServer) {
  // 1. get_shared_ledgers
  server.registerTool(
    'get_shared_ledgers',
    {
      title: 'فهرست دفاتر حساب اشتراکی',
      description: 'مشاهده لیست دفاتر حساب اشتراکی کاربر (دفاتر مشترک با خانواده، همکاران یا شرکا).',
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async () => {
      try {
        const ledgers = await hesabyarApi.get('/sharing')
        return formatSuccessResponse(ledgers)
      } catch (err) {
        return formatErrorResponse(err)
      }
    },
  )

  // 2. create_shared_ledger
  server.registerTool(
    'create_shared_ledger',
    {
      title: 'ایجاد دفتر حساب اشتراکی جدید',
      description: 'ایجاد یک دفتر حساب مشترک برای یک حساب مالی خاص و دریافت کد اشتراک جهت اشتراک با دیگران.',
      inputSchema: {
        accountId: z.string().describe('شناسه حسابی که می‌خواهید اشتراکی شود'),
        title: z.string().describe('عنوان دفتر اشتراکی (مثلاً "خرج خانه"، "سفر شمال")'),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const result = await hesabyarApi.post('/sharing', params)
        return formatSuccessResponse(result, 'دفتر اشتراکی با موفقیت ایجاد شد')
      } catch (err) {
        return formatErrorResponse(err)
      }
    },
  )

  // 3. join_shared_ledger
  server.registerTool(
    'join_shared_ledger',
    {
      title: 'پیوستن به یک دفتر حساب اشتراکی',
      description: 'پیوستن به یک دفتر حساب مشترک دیگران با استفاده از کد اشتراک ۸ رقمی.',
      inputSchema: {
        code: z.string().describe('کد اشتراک ۸ رقمی دفتر مشترک'),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({ code }) => {
      try {
        const result = await hesabyarApi.post('/sharing/join', { code })
        return formatSuccessResponse(result, 'با موفقیت به دفتر مشترک پیوستید')
      } catch (err) {
        return formatErrorResponse(err)
      }
    },
  )
}
