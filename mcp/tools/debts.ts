import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { hesabyarApi } from '../client/hesabyarApi'
import { currencySchema, dateSchema, formatErrorResponse, formatSuccessResponse } from '../schemas/common'

export function registerDebtTools(server: McpServer) {
  // 1. get_debts
  server.registerTool(
    'get_debts',
    {
      title: 'فهرست بدهی‌ها و مطالبات',
      description:
        'مشاهده فهرست بدهی‌ها (مبالغی که قرض گرفته‌اید) و مطالبات (مبالغی که به دیگران قرض داده‌اید) با وضعیت جاری یا تسویه‌شده.',
      inputSchema: {
        direction: z
          .enum(['borrowed', 'lent'])
          .optional()
          .describe('جهت: borrowed (بدهی/قرض گرفته‌شده)، lent (طلب/قرض داده‌شده)'),
        status: z
          .enum(['active', 'settled'])
          .optional()
          .describe('وضعیت: active (جاری/تسویه‌نشده)، settled (تسویه‌شده)'),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const debts = await hesabyarApi.get('/debts', params)
        return formatSuccessResponse(debts)
      } catch (err) {
        return formatErrorResponse(err)
      }
    },
  )

  // 2. get_debt
  server.registerTool(
    'get_debt',
    {
      title: 'مشاهده مشخصات یک بدهی یا طلب',
      description: 'دریافت مشخصات کامل یک رکورد بدهی یا طلب با استفاده از شناسه آن.',
      inputSchema: {
        id: z.string().describe('شناسه رکورد بدهی یا طلب'),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({ id }) => {
      try {
        const debt = await hesabyarApi.get(`/debts/${encodeURIComponent(id)}`)
        return formatSuccessResponse(debt)
      } catch (err) {
        return formatErrorResponse(err)
      }
    },
  )

  // 3. create_debt
  server.registerTool(
    'create_debt',
    {
      title: 'ثبت بدهی یا طلب جدید',
      description:
        'ثبت یک مورد بدهی جدید (قرض از دیگری) یا طلب جدید (قرض به دیگری) به همراه نام طرف حساب، مبلغ و موعد بازپرداخت.',
      inputSchema: {
        direction: z
          .enum(['borrowed', 'lent'])
          .describe('نوع: borrowed (بدهی/قرض گرفته‌ام)، lent (طلب/قرض داده‌ام)'),
        party: z.string().describe('نام طرف حساب (شخص یا شرکت)'),
        amount: z.number().positive().describe('مبلغ بدهی یا طلب'),
        currency: currencySchema,
        dueDate: dateSchema.describe('تاریخ موعد بازپرداخت (اختیاری YYYY-MM-DD)'),
        note: z.string().optional().describe('یادداشت و توضیحات'),
        accountId: z.string().optional().describe('حساب مرتبط (اختیاری)'),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const result = await hesabyarApi.post('/debts', params)
        return formatSuccessResponse(result, 'مورد بدهی/طلب با موفقیت ثبت شد')
      } catch (err) {
        return formatErrorResponse(err)
      }
    },
  )

  // 4. settle_debt
  server.registerTool(
    'settle_debt',
    {
      title: 'تسویه بدهی یا دریافت طلب',
      description: 'علامت‌گذاری یک مورد بدهی یا طلب به عنوان تسویه‌شده و پرداخت نهایی.',
      inputSchema: {
        id: z.string().describe('شناسه رکورد بدهی یا طلب'),
        accountId: z.string().optional().describe('شناسه حسابی که پرداخت یا واریز از طریق آن انجام شد'),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({ id, accountId }) => {
      try {
        const result = await hesabyarApi.post(`/debts/${encodeURIComponent(id)}/settle`, { accountId })
        return formatSuccessResponse(result, 'بدهی/طلب با موفقیت تسویه شد')
      } catch (err) {
        return formatErrorResponse(err)
      }
    },
  )

  // 5. delete_debt
  server.registerTool(
    'delete_debt',
    {
      title: 'حذف بدهی یا طلب',
      description: 'حذف یک مورد بدهی یا طلب از سامانه.',
      inputSchema: {
        id: z.string().describe('شناسه رکورد بدهی یا طلب'),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: false,
      },
    },
    async ({ id }) => {
      try {
        const result = await hesabyarApi.delete(`/debts/${encodeURIComponent(id)}`)
        return formatSuccessResponse(result, 'با موفقیت حذف شد')
      } catch (err) {
        return formatErrorResponse(err)
      }
    },
  )
}
