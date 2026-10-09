import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { hesabyarApi } from '../client/hesabyarApi'
import { formatErrorResponse, formatSuccessResponse } from '../schemas/common'

export function registerReportTools(server: McpServer) {
  server.registerTool(
    'get_financial_report',
    {
      title: 'گزارش مالی جامع و تفکیک هزینه‌ها',
      description:
        'دریافت گزارش مالی تحلیلی شامل کل درآمد، کل هزینه، پس‌انداز خالص، مجموع کل دارایی‌های نقد و بانک، تاریخچه ماهانه (۶ ماه اخیر) و تفکیک درصدی هزینه‌ها بر اساس دسته‌بندی برای ماه جاری.',
      inputSchema: {
        date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, 'فرمت تاریخ باید YYYY-MM-DD باشد')
          .optional()
          .describe('تاریخ انتهای بازه گزارش (YYYY-MM-DD)، پیش‌فرض تاریخ امروز است'),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({ date }) => {
      try {
        const report = await hesabyarApi.get('/reports', { date })
        return formatSuccessResponse(report)
      } catch (err) {
        return formatErrorResponse(err)
      }
    },
  )
}
