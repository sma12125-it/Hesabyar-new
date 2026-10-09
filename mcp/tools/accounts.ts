import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { hesabyarApi } from '../client/hesabyarApi'
import { formatErrorResponse, formatSuccessResponse } from '../schemas/common'

export function registerAccountTools(server: McpServer) {
  // 1. get_accounts
  server.registerTool(
    'get_accounts',
    {
      title: 'فهرست حساب‌های مالی',
      description:
        'مشاهده فهرست تمام حساب‌ها و بانک‌های کاربر در حساب‌یار به همراه موجودی ریال و تومان. این ابزار برای بررسی وضعیت کلی دارایی‌ها و انتخاب حساب جهت ثبت تراکنش کاربرد دارد.',
      inputSchema: {
        includeArchived: z
          .boolean()
          .optional()
          .default(false)
          .describe('آیا حساب‌های بایگانی‌شده نیز نمایش داده شوند؟'),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({ includeArchived }) => {
      try {
        const accounts = await hesabyarApi.get<unknown[]>('/accounts', { includeArchived })
        return formatSuccessResponse(accounts, 'فهرست حساب‌ها با موفقیت دریافت شد')
      } catch (err) {
        return formatErrorResponse(err)
      }
    },
  )

  // 2. get_account
  server.registerTool(
    'get_account',
    {
      title: 'مشاهده مشخصات یک حساب',
      description:
        'دریافت اطلاعات تفصیلی یک حساب مالی مشخص با استفاده از شناسه حساب.',
      inputSchema: {
        id: z.string().describe('شناسه حساب (مثلاً "acc-1" یا شناسه منحصر‌به‌فرد حساب)'),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({ id }) => {
      try {
        const account = await hesabyarApi.get(`/accounts/${encodeURIComponent(id)}`)
        return formatSuccessResponse(account)
      } catch (err) {
        return formatErrorResponse(err)
      }
    },
  )

  // 3. get_account_balance
  server.registerTool(
    'get_account_balance',
    {
      title: 'استعلام موجودی حساب بانکی',
      description:
        'استعلام موجودی دقیق ریالی و تومانی یک حساب بانکی با استفاده از نام حساب (مثلاً "بانک ملت"، "ملی"، "صادرات"، "بلو") یا شناسه حساب. بهترین ابزار برای پاسخ به سوالات کاربر مانند "موجودی حساب بانک ملت من چقدر است؟".',
      inputSchema: {
        account: z
          .string()
          .describe('نام یا شناسه حساب بانکی (مثلاً "بانک ملت"، "سامان" یا "صندوق پس‌انداز")'),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({ account }) => {
      try {
        const result = await hesabyarApi.get(`/accounts/${encodeURIComponent(account)}/balance`)
        return formatSuccessResponse(result)
      } catch (err) {
        return formatErrorResponse(err)
      }
    },
  )

  // 4. create_account
  server.registerTool(
    'create_account',
    {
      title: 'ایجاد حساب بانکی یا نقدی جدید',
      description: 'تعریف یک حساب مالی یا کارت بانکی جدید با نام، موجودی اولیه و نوع حساب (بانک یا نقدی).',
      inputSchema: {
        name: z.string().describe('نام حساب (مثلاً "بانک پاسارگاد" یا "کیف پول نقدی")'),
        type: z.enum(['bank', 'cash']).default('bank').describe('نوع حساب: bank (بانکی) یا cash (نقدی)'),
        initialBalance: z.number().default(0).describe('موجودی اولیه به تومان یا ریال'),
        currency: z.enum(['IRT', 'IRR']).default('IRT').describe('واحد پول موجودی اولیه: IRT (تومان) یا IRR (ریال)'),
        accountNumber: z.string().optional().describe('شماره حساب بانکی (اختیاری)'),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const result = await hesabyarApi.post('/accounts', params)
        return formatSuccessResponse(result, 'حساب جدید با موفقیت ایجاد شد')
      } catch (err) {
        return formatErrorResponse(err)
      }
    },
  )

  // 5. archive_account
  server.registerTool(
    'archive_account',
    {
      title: 'بایگانی کردن یک حساب مالی',
      description: 'بایگانی کردن یک حساب مالی جهت عدم نمایش در فهرست فعال‌ها، بدون حذف تاریخچه تراکنش‌های آن.',
      inputSchema: {
        id: z.string().describe('شناسه حساب مورد نظر جهت بایگانی'),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({ id }) => {
      try {
        const result = await hesabyarApi.post(`/accounts/${encodeURIComponent(id)}/archive`)
        return formatSuccessResponse(result, 'حساب با موفقیت بایگانی شد')
      } catch (err) {
        return formatErrorResponse(err)
      }
    },
  )
}
