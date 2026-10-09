import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { hesabyarApi } from '../client/hesabyarApi'
import { currencySchema, dateSchema, formatErrorResponse, formatSuccessResponse } from '../schemas/common'

export function registerInvestmentTools(server: McpServer) {
  // 1. get_investments
  server.registerTool(
    'get_investments',
    {
      title: 'فهرست دارایی‌ها و سبد سرمایه‌گذاری',
      description: 'مشاهده لیست دارایی‌های سرمایه‌گذاری کاربر شامل طلا، سکه، ارز، بورس، صندوق، مسکن و سود/زیان هر کدام.',
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async () => {
      try {
        const investments = await hesabyarApi.get('/investments')
        return formatSuccessResponse(investments)
      } catch (err) {
        return formatErrorResponse(err)
      }
    },
  )

  // 2. get_investment
  server.registerTool(
    'get_investment',
    {
      title: 'مشاهده جزئیات یک دارایی سرمایه‌گذاری',
      description: 'دریافت مشخصات کامل یک دارایی سرمایه‌گذاری بر اساس شناسه آن.',
      inputSchema: {
        id: z.string().describe('شناسه دارایی'),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({ id }) => {
      try {
        const asset = await hesabyarApi.get(`/investments/${encodeURIComponent(id)}`)
        return formatSuccessResponse(asset)
      } catch (err) {
        return formatErrorResponse(err)
      }
    },
  )

  // 3. create_investment
  server.registerTool(
    'create_investment',
    {
      title: 'ثبت دارایی سرمایه‌گذاری جدید',
      description: 'ثبت یک دارایی جدید مانند سکه طلا، دلار، سهام یا صندوق به همراه مبلغ خرید و ارزش روز.',
      inputSchema: {
        name: z.string().describe('نام دارایی (مثلاً "سکه تمام بهار"، "دلار آمریکا"، "صندوق درآمد ثابت")'),
        market: z.enum(['gold', 'stock', 'fund', 'crypto', 'bank', 'property', 'other']).describe('دسته‌بندی بازار سرمایه'),
        purchaseAmount: z.number().positive().describe('مبلغ کل خریداری‌شده (بهای تمام‌شده)'),
        currentValue: z.number().positive().describe('ارزش فعلی کل دارایی به قیمت روز'),
        currency: currencySchema,
        quantity: z.number().optional().describe('تعداد یا مقدار دارایی (مثلاً ۵ عدد یا ۲۰ گرم)'),
        unitPrice: z.number().optional().describe('قیمت واحد هنگام خرید'),
        currentUnitPrice: z.number().optional().describe('قیمت واحد روز'),
        purchaseDate: dateSchema.describe('تاریخ خرید (اختیاری YYYY-MM-DD)'),
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
        const result = await hesabyarApi.post('/investments', params)
        return formatSuccessResponse(result, 'دارایی با موفقیت در سبد سرمایه‌گذاری ثبت شد')
      } catch (err) {
        return formatErrorResponse(err)
      }
    },
  )

  // 4. update_investment
  server.registerTool(
    'update_investment',
    {
      title: 'به‌روزرسانی ارزش روز دارایی',
      description: 'به‌روزرسانی ارزش روز یک دارایی سرمایه‌گذاری بر اساس آخرین قیمت‌های بازار.',
      inputSchema: {
        id: z.string().describe('شناسه دارایی'),
        currentValue: z.number().positive().describe('ارزش روز جدید دارایی'),
        currentUnitPrice: z.number().optional().describe('قیمت واحد روز جدید (اختیاری)'),
        currency: currencySchema,
        note: z.string().optional().describe('یادداشت'),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({ id, ...patch }) => {
      try {
        const result = await hesabyarApi.patch(`/investments/${encodeURIComponent(id)}`, patch)
        return formatSuccessResponse(result, 'ارزش دارایی با موفقیت به‌روزرسانی شد')
      } catch (err) {
        return formatErrorResponse(err)
      }
    },
  )

  // 5. delete_investment
  server.registerTool(
    'delete_investment',
    {
      title: 'حذف دارایی از سبد سرمایه‌گذاری',
      description: 'حذف یک دارایی سرمایه‌گذاری از سامانه.',
      inputSchema: {
        id: z.string().describe('شناسه دارایی'),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: false,
      },
    },
    async ({ id }) => {
      try {
        const result = await hesabyarApi.delete(`/investments/${encodeURIComponent(id)}`)
        return formatSuccessResponse(result, 'دارایی با موفقیت حذف شد')
      } catch (err) {
        return formatErrorResponse(err)
      }
    },
  )
}
