import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { hesabyarApi } from '../client/hesabyarApi'
import { dateSchema, formatErrorResponse, formatSuccessResponse } from '../schemas/common'

export function registerInstallmentTools(server: McpServer) {
  // 1. get_installment_plans
  server.registerTool(
    'get_installment_plans',
    {
      title: 'فهرست برنامه‌های اقساط و وام‌ها',
      description: 'مشاهده لیست تمام برنامه‌های اقساط، وام‌ها، مبلغ هر قسط، وضعیت و تعداد اقساط کاربر.',
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async () => {
      try {
        const plans = await hesabyarApi.get('/installments/plans')
        return formatSuccessResponse(plans)
      } catch (err) {
        return formatErrorResponse(err)
      }
    },
  )

  // 2. get_installment_plan
  server.registerTool(
    'get_installment_plan',
    {
      title: 'مشاهده برنامه اقساط و وضعیت قسط‌ها',
      description:
        'دریافت اطلاعات دقیق یک برنامه اقساط به همراه فهرست تمام قسط‌ها، سررسیدها، مبالغ و وضعیت پرداخت‌شده/معوق/در انتظار، بر اساس نام یا شناسه برنامه.',
      inputSchema: {
        idOrName: z.string().describe('شناسه یا نام برنامه اقساط (مثلاً "وام ازدواج" یا "خرید اقساطی لپ‌تاپ")'),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({ idOrName }) => {
      try {
        const result = await hesabyarApi.get(`/installments/plans/${encodeURIComponent(idOrName)}`)
        return formatSuccessResponse(result)
      } catch (err) {
        return formatErrorResponse(err)
      }
    },
  )

  // 3. get_installment_items
  server.registerTool(
    'get_installment_items',
    {
      title: 'فهرست قسط‌های سررسیدشده یا آتی',
      description: 'دریافت فهرست قسط‌ها با امکان فیلتر بر اساس یک برنامه مشخص.',
      inputSchema: {
        planId: z.string().optional().describe('شناسه برنامه اقساط جهت فیلتر'),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({ planId }) => {
      try {
        const items = await hesabyarApi.get('/installments/items', { planId })
        return formatSuccessResponse(items)
      } catch (err) {
        return formatErrorResponse(err)
      }
    },
  )

  // 4. create_installment_plan
  server.registerTool(
    'create_installment_plan',
    {
      title: 'تعریف برنامه اقساط یا وام جدید',
      description: 'ایجاد یک برنامه اقساطی جدید با تعیین نام، مبلغ هر قسط، تعداد اقساط، تاریخ شروع و حساب پیش‌فرض پرداخت.',
      inputSchema: {
        name: z.string().describe('عنوان برنامه اقساط (مثلاً "خرید تلویزیون اقساطی")'),
        installmentAmount: z.number().positive().describe('مبلغ هر قسط (به ریال)'),
        totalCount: z.number().int().positive().describe('تعداد کل اقساط'),
        startDate: dateSchema.describe('تاریخ اولین قسط (YYYY-MM-DD)'),
        defaultAccountId: z.string().describe('شناسه یا نام حساب پیش‌فرض پرداخت'),
        kind: z.enum(['fixed', 'loan']).optional().default('fixed').describe('نوع: fixed (مبلغ ثابت) یا loan (وام کاهشی)'),
        principal: z.number().optional().describe('اصل مبلغ وام در صورت انتخاب نوع loan'),
        annualRatePercent: z.number().optional().describe('درصد سود سالانه وام'),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const result = await hesabyarApi.post('/installments/plans', params)
        return formatSuccessResponse(result, 'برنامه اقساط با موفقیت ایجاد شد')
      } catch (err) {
        return formatErrorResponse(err)
      }
    },
  )

  // 5. update_installment_plan
  server.registerTool(
    'update_installment_plan',
    {
      title: 'ویرایش مشخصات برنامه اقساط',
      description: 'ویرایش عنوان یا حساب پیش‌فرض یک برنامه اقساط موجود.',
      inputSchema: {
        id: z.string().describe('شناسه برنامه اقساط'),
        name: z.string().optional().describe('عنوان جدید'),
        defaultAccountId: z.string().optional().describe('حساب پیش‌فرض جدید'),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({ id, ...patch }) => {
      try {
        const result = await hesabyarApi.patch(`/installments/plans/${encodeURIComponent(id)}`, patch)
        return formatSuccessResponse(result, 'برنامه اقساط با موفقیت ویرایش شد')
      } catch (err) {
        return formatErrorResponse(err)
      }
    },
  )

  // 6. pay_installment
  server.registerTool(
    'pay_installment',
    {
      title: 'پرداخت قسط',
      description:
        'ثبت پرداخت یک قسط مشخص با کسر مبلغ از حساب مالی کاربر و ثبت خودکار تراکنش هزینه دسته اقساط.',
      inputSchema: {
        itemId: z.string().describe('شناسه قسط'),
        accountId: z.string().describe('نام یا شناسه حساب مالی جهت پرداخت قسط'),
        note: z.string().optional().describe('یادداشت دلخواه برای پرداخت قسط'),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({ itemId, accountId, note }) => {
      try {
        const result = await hesabyarApi.post(`/installments/items/${encodeURIComponent(itemId)}/pay`, {
          accountId,
          note,
        })
        return formatSuccessResponse(result, 'قسط با موفقیت پرداخت شد')
      } catch (err) {
        return formatErrorResponse(err)
      }
    },
  )

  // 7. unpay_installment
  server.registerTool(
    'unpay_installment',
    {
      title: 'لغو پرداخت قسط',
      description: 'لغو وضعیت پرداخت یک قسط پرداخت‌شده و حذف خودکار تراکنش هزینه مربوطه با برگشت موجودی حساب.',
      inputSchema: {
        itemId: z.string().describe('شناسه قسط'),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({ itemId }) => {
      try {
        const result = await hesabyarApi.post(`/installments/items/${encodeURIComponent(itemId)}/unpay`)
        return formatSuccessResponse(result, 'وضعیت پرداخت قسط با موفقیت لغو شد')
      } catch (err) {
        return formatErrorResponse(err)
      }
    },
  )

  // 8. archive_installment_plan
  server.registerTool(
    'archive_installment_plan',
    {
      title: 'بایگانی برنامه اقساط',
      description: 'بایگانی کردن یک برنامه اقساط (مثلاً برنامه‌های تکمیل‌شده یا متوقف‌شده).',
      inputSchema: {
        id: z.string().describe('شناسه برنامه اقساط'),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({ id }) => {
      try {
        const result = await hesabyarApi.post(`/installments/plans/${encodeURIComponent(id)}/archive`)
        return formatSuccessResponse(result, 'برنامه اقساط بایگانی شد')
      } catch (err) {
        return formatErrorResponse(err)
      }
    },
  )

  // 9. restore_installment_plan
  server.registerTool(
    'restore_installment_plan',
    {
      title: 'بازگردانی برنامه اقساط از بایگانی',
      description: 'خارج کردن یک برنامه اقساط از حالت بایگانی به حالت فعال.',
      inputSchema: {
        id: z.string().describe('شناسه برنامه اقساط'),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({ id }) => {
      try {
        const result = await hesabyarApi.post(`/installments/plans/${encodeURIComponent(id)}/restore`)
        return formatSuccessResponse(result, 'برنامه اقساط با موفقیت فعال شد')
      } catch (err) {
        return formatErrorResponse(err)
      }
    },
  )

  // 10. delete_installment_plan
  server.registerTool(
    'delete_installment_plan',
    {
      title: 'حذف کامل برنامه اقساط',
      description:
        'حذف قطعی یک برنامه اقساط به همراه تمام قسط‌های آن و تراکنش‌های پرداختی متصل. توجه: این یک عملیات مخرب (Destructive) است.',
      inputSchema: {
        id: z.string().describe('شناسه برنامه اقساط'),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: false,
      },
    },
    async ({ id }) => {
      try {
        const result = await hesabyarApi.delete(`/installments/plans/${encodeURIComponent(id)}`)
        return formatSuccessResponse(result, 'برنامه اقساط با موفقیت حذف شد')
      } catch (err) {
        return formatErrorResponse(err)
      }
    },
  )

  // 11. delete_installment_item
  server.registerTool(
    'delete_installment_item',
    {
      title: 'حذف یک قسط تکی',
      description: 'حذف یک قسط مشخص از جدول اقساط یک برنامه.',
      inputSchema: {
        id: z.string().describe('شناسه قسط'),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: false,
      },
    },
    async ({ id }) => {
      try {
        const result = await hesabyarApi.delete(`/installments/items/${encodeURIComponent(id)}`)
        return formatSuccessResponse(result, 'قسط با موفقیت حذف شد')
      } catch (err) {
        return formatErrorResponse(err)
      }
    },
  )
}
