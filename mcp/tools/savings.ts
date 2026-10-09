import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { hesabyarApi } from '../client/hesabyarApi'
import { currencySchema, dateSchema, formatErrorResponse, formatSuccessResponse } from '../schemas/common'

export function registerSavingsTools(server: McpServer) {
  // 1. get_savings_goals
  server.registerTool(
    'get_savings_goals',
    {
      title: 'فهرست اهداف پس‌انداز و قلک‌ها',
      description: 'مشاهده لیست تمام اهداف مالی و پس‌اندازهای کاربر، مبلغ هدف، مبلغ جمع‌آوری‌شده تاکنون و درصد پیشرفت.',
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async () => {
      try {
        const goals = await hesabyarApi.get('/savings')
        return formatSuccessResponse(goals)
      } catch (err) {
        return formatErrorResponse(err)
      }
    },
  )

  // 2. get_savings_goal
  server.registerTool(
    'get_savings_goal',
    {
      title: 'مشاهده جزئیات یک هدف پس‌انداز',
      description: 'دریافت مشخصات کامل یک هدف پس‌انداز با استفاده از شناسه یا نام هدف.',
      inputSchema: {
        id: z.string().describe('شناسه یا نام هدف پس‌انداز'),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({ id }) => {
      try {
        const goal = await hesabyarApi.get(`/savings/${encodeURIComponent(id)}`)
        return formatSuccessResponse(goal)
      } catch (err) {
        return formatErrorResponse(err)
      }
    },
  )

  // 3. create_savings_goal
  server.registerTool(
    'create_savings_goal',
    {
      title: 'تعریف هدف پس‌انداز جدید',
      description: 'تعریف یک هدف پس‌انداز جدید (مانند خرید لپ‌تاپ، سفر، صندوق اضطراری) با تعیین مبلغ هدف و تاریخ سررسید.',
      inputSchema: {
        name: z.string().describe('نام هدف پس‌انداز (مثلاً "خرید خودرو"، "سفر استانبول")'),
        target: z.number().positive().describe('مبلغ کل هدف'),
        saved: z.number().optional().default(0).describe('مبلغ اولیه پس‌انداز شده تاکنون (پیش‌فرض ۰)'),
        currency: currencySchema,
        market: z.enum(['bank', 'gold', 'stock', 'crypto', 'cash']).optional().default('bank').describe('نوع بازار نگهداری دارایی'),
        targetDate: dateSchema.describe('تاریخ مورد نظر برای دستیابی به هدف (اختیاری YYYY-MM-DD)'),
        note: z.string().optional().describe('یادداشت'),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const result = await hesabyarApi.post('/savings', params)
        return formatSuccessResponse(result, 'هدف پس‌انداز جدید با موفقیت ایجاد شد')
      } catch (err) {
        return formatErrorResponse(err)
      }
    },
  )

  // 4. update_savings_goal
  server.registerTool(
    'update_savings_goal',
    {
      title: 'به‌روزرسانی یا واریز به پس‌انداز',
      description: 'به‌روزرسانی مبلغ ذخیره‌شده یا مبلغ هدف یک قلک/پس‌انداز.',
      inputSchema: {
        id: z.string().describe('شناسه هدف پس‌انداز'),
        saved: z.number().optional().describe('مبلغ کل جدید پس‌انداز شده'),
        target: z.number().optional().describe('مبلغ هدف جدید'),
        currency: currencySchema,
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({ id, ...patch }) => {
      try {
        const result = await hesabyarApi.patch(`/savings/${encodeURIComponent(id)}`, patch)
        return formatSuccessResponse(result, 'هدف پس‌انداز با موفقیت به‌روزرسانی شد')
      } catch (err) {
        return formatErrorResponse(err)
      }
    },
  )

  // 5. delete_savings_goal
  server.registerTool(
    'delete_savings_goal',
    {
      title: 'حذف هدف پس‌انداز',
      description: 'حذف یک هدف پس‌انداز از سامانه.',
      inputSchema: {
        id: z.string().describe('شناسه هدف پس‌انداز'),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: false,
      },
    },
    async ({ id }) => {
      try {
        const result = await hesabyarApi.delete(`/savings/${encodeURIComponent(id)}`)
        return formatSuccessResponse(result, 'هدف پس‌انداز با موفقیت حذف شد')
      } catch (err) {
        return formatErrorResponse(err)
      }
    },
  )
}
