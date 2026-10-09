import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { hesabyarApi } from '../client/hesabyarApi'
import { formatErrorResponse, formatSuccessResponse } from '../schemas/common'

export function registerCardTools(server: McpServer) {
  // 1. get_cards
  server.registerTool(
    'get_cards',
    {
      title: 'فهرست کارت‌های بانکی',
      description: 'مشاهده لیست کارت‌های بانکی ثبت‌شده، نام دارنده، شماره کارت (PAN)، شماره شبا و نام بانک.',
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async () => {
      try {
        const cards = await hesabyarApi.get('/cards')
        return formatSuccessResponse(cards)
      } catch (err) {
        return formatErrorResponse(err)
      }
    },
  )

  // 2. get_card
  server.registerTool(
    'get_card',
    {
      title: 'مشاهده مشخصات یک کارت بانکی',
      description: 'دریافت مشخصات کامل کارت بانکی شامل شماره کارت، شبا، تاریخ انقضا و حساب متصل بر اساس شناسه کارت.',
      inputSchema: {
        id: z.string().describe('شناسه کارت بانکی'),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({ id }) => {
      try {
        const card = await hesabyarApi.get(`/cards/${encodeURIComponent(id)}`)
        return formatSuccessResponse(card)
      } catch (err) {
        return formatErrorResponse(err)
      }
    },
  )

  // 3. create_card
  server.registerTool(
    'create_card',
    {
      title: 'ثبت کارت بانکی جدید',
      description: 'افزودن کارت بانکی جدید با شماره کارت ۱۶ رقمی، نام بانک، صاحب حساب و شماره شبا.',
      inputSchema: {
        bankName: z.string().describe('نام بانک (مثلاً بانک ملت، بانک سامان)'),
        holder: z.string().describe('نام و نام‌خانوادگی صاحب کارت'),
        pan: z.string().describe('شماره ۱۶ رقمی کارت بانکی'),
        expiry: z.string().optional().describe('تاریخ انقضا مثلاً "04/08" (اختیاری)'),
        cvv: z.string().optional().describe('کد CVV2 (اختیاری)'),
        sheba: z.string().optional().describe('شماره شبا با یا بدون پیشوند IR (اختیاری)'),
        note: z.string().optional().describe('یادداشت (اختیاری)'),
        accountId: z.string().optional().describe('شناسه حساب متصل در صورت وجود (اختیاری)'),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const result = await hesabyarApi.post('/cards', params)
        return formatSuccessResponse(result, 'کارت بانکی با موفقیت ثبت شد')
      } catch (err) {
        return formatErrorResponse(err)
      }
    },
  )

  // 4. link_card_to_account
  server.registerTool(
    'link_card_to_account',
    {
      title: 'اتصال کارت بانکی به حساب مالی',
      description: 'پیوند زدن یک کارت بانکی به یک حساب بانکی جهت هماهنگی موجودی و تراکنش‌ها.',
      inputSchema: {
        cardId: z.string().describe('شناسه کارت بانکی'),
        accountId: z.string().describe('شناسه حساب مالی مقصد'),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({ cardId, accountId }) => {
      try {
        const result = await hesabyarApi.post(`/cards/${encodeURIComponent(cardId)}/link`, { accountId })
        return formatSuccessResponse(result, 'کارت بانکی با موفقیت به حساب متصل شد')
      } catch (err) {
        return formatErrorResponse(err)
      }
    },
  )

  // 5. delete_card
  server.registerTool(
    'delete_card',
    {
      title: 'حذف کارت بانکی',
      description: 'حذف یک کارت بانکی ثبت‌شده از سامانه.',
      inputSchema: {
        id: z.string().describe('شناسه کارت بانکی'),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: false,
      },
    },
    async ({ id }) => {
      try {
        const result = await hesabyarApi.delete(`/cards/${encodeURIComponent(id)}`)
        return formatSuccessResponse(result, 'کارت با موفقیت حذف شد')
      } catch (err) {
        return formatErrorResponse(err)
      }
    },
  )
}
