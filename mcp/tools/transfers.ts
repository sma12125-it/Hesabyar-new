import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { hesabyarApi } from '../client/hesabyarApi'
import { currencySchema, dateSchema, dryRunSchema, formatErrorResponse, formatSuccessResponse } from '../schemas/common'

export function registerTransferTools(server: McpServer) {
  server.registerTool(
    'create_transfer',
    {
      title: 'انتقال وجه بین حساب‌ها (کارت به کارت/حساب به حساب)',
      description:
        'انتقال مبلغ بین دو حساب مالی کاربر با اعتبارسنجی خودکار موجودی حساب مبدأ. این عملیات به صورت دوطرفه و همزمان (Atomic) دو پایه خروجی و ورودی ایجاد می‌کند. با ارسال dryRun: true می‌توان بدون اعمال تغییرات، پیش‌نمایش تراز هر دو حساب را به کاربر نشان داد و تأییدیه گرفت.',
      inputSchema: {
        fromAccount: z.string().describe('نام یا شناسه حساب مبدأ (کسر وجه)'),
        toAccount: z.string().describe('نام یا شناسه حساب مقصد (واریز وجه)'),
        amount: z.number().positive().describe('مبلغ انتقال (عدد مثبت)'),
        currency: currencySchema,
        description: z.string().optional().describe('توضیحات و بابت انتقال'),
        date: dateSchema,
        dryRun: dryRunSchema,
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const result = await hesabyarApi.post('/transfers', params)
        const isDry = Boolean(params.dryRun)
        const message = isDry
          ? 'پیش‌نمایش انتقال با موفقیت ایجاد شد (تأیید کاربر لازم است)'
          : 'انتقال وجه با موفقیت انجام شد'
        return formatSuccessResponse(result, message)
      } catch (err) {
        return formatErrorResponse(err)
      }
    },
  )
}
