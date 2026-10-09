import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { hesabyarApi } from '../client/hesabyarApi'
import { currencySchema, dateSchema, formatErrorResponse, formatSuccessResponse } from '../schemas/common'

export function registerChequeTools(server: McpServer) {
  // 1. get_cheques
  server.registerTool(
    'get_cheques',
    {
      title: 'فهرست چک‌های صیادی',
      description:
        'مشاهده فهرست چک‌های صیادی کاربر (دریافتی و پرداختی) با امکان فیلتر بر اساس وضعیت (pending: در انتظار، cleared: پاس‌شده، bounced: برگشتی) یا جهت (payable: پرداختی، receivable: دریافتی).',
      inputSchema: {
        status: z
          .enum(['pending', 'cleared', 'bounced'])
          .optional()
          .describe('وضعیت چک: pending (در انتظار سررسید)، cleared (پاس‌شده)، bounced (برگشت‌خورده)'),
        direction: z
          .enum(['payable', 'receivable'])
          .optional()
          .describe('جهت چک: payable (چک پرداختی/صادره)، receivable (چک دریافتی)'),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const cheques = await hesabyarApi.get('/cheques', params)
        return formatSuccessResponse(cheques)
      } catch (err) {
        return formatErrorResponse(err)
      }
    },
  )

  // 2. get_cheque
  server.registerTool(
    'get_cheque',
    {
      title: 'مشاهده مشخصات یک فقره چک',
      description: 'دریافت مشخصات کامل یک چک صیادی بر اساس شناسه یا شناسه صیادی ۱۶ رقمی.',
      inputSchema: {
        id: z.string().describe('شناسه چک یا شناسه صیادی'),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({ id }) => {
      try {
        const cheque = await hesabyarApi.get(`/cheques/${encodeURIComponent(id)}`)
        return formatSuccessResponse(cheque)
      } catch (err) {
        return formatErrorResponse(err)
      }
    },
  )

  // 3. create_cheque
  server.registerTool(
    'create_cheque',
    {
      title: 'ثبت چک صیادی جدید',
      description:
        'ثبت یک فقره چک صیادی پرداختی یا دریافتی با ثبت شناسه صیاد، نام بانک، مبلغ، تاریخ سررسید و نام طرف حساب.',
      inputSchema: {
        direction: z.enum(['payable', 'receivable']).describe('نوع چک: payable (پرداختی)، receivable (دریافتی)'),
        sayadId: z.string().describe('شناسه ۱۶ رقمی صیادی چک'),
        bankName: z.string().describe('نام بانک صادرکننده چک (مثلاً بانک ملت، بانک ملی)'),
        amount: z.number().positive().describe('مبلغ چک'),
        dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'فرمت تاریخ باید YYYY-MM-DD باشد').describe('تاریخ سررسید چک (YYYY-MM-DD)'),
        party: z.string().describe('طرف حساب: در وجه چه کسی یا از چه کسی دریافت شده'),
        note: z.string().optional().describe('یادداشت یا بابت چک (اختیاری)'),
        currency: currencySchema,
        accountId: z.string().optional().describe('شناسه حساب بانکی متصل (اختیاری)'),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const cheque = await hesabyarApi.post('/cheques', params)
        return formatSuccessResponse(cheque, 'چک با موفقیت در سامانه ثبت شد')
      } catch (err) {
        return formatErrorResponse(err)
      }
    },
  )

  // 4. update_cheque_status
  server.registerTool(
    'update_cheque_status',
    {
      title: 'تغییر وضعیت چک (پاس‌شده یا برگشتی)',
      description: 'ثبت وضعیت جدید برای چک صیادی، مانند پاس‌شدن چک یا برگشت خوردن آن.',
      inputSchema: {
        id: z.string().describe('شناسه چک'),
        status: z.enum(['pending', 'cleared', 'bounced']).describe('وضعیت جدید چک'),
        clearedDate: dateSchema.describe('تاریخ پاس شدن (اختیاری، پیش‌فرض امروز)'),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({ id, status, clearedDate }) => {
      try {
        const result = await hesabyarApi.patch(`/cheques/${encodeURIComponent(id)}/status`, {
          status,
          clearedDate,
        })
        return formatSuccessResponse(result, `وضعیت چک با موفقیت به «${status}» تغییر یافت`)
      } catch (err) {
        return formatErrorResponse(err)
      }
    },
  )

  // 5. delete_cheque
  server.registerTool(
    'delete_cheque',
    {
      title: 'حذف یک فقره چک',
      description: 'حذف اطلاعات یک چک صیادی از سامانه حساب‌یار.',
      inputSchema: {
        id: z.string().describe('شناسه چک'),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: false,
      },
    },
    async ({ id }) => {
      try {
        const result = await hesabyarApi.delete(`/cheques/${encodeURIComponent(id)}`)
        return formatSuccessResponse(result, 'چک با موفقیت حذف شد')
      } catch (err) {
        return formatErrorResponse(err)
      }
    },
  )
}
