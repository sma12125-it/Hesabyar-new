import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { hesabyarApi } from '../client/hesabyarApi'
import { formatErrorResponse, formatSuccessResponse } from '../schemas/common'

export function registerCategoryTools(server: McpServer) {
  server.registerTool(
    'get_categories',
    {
      title: 'فهرست دسته‌بندی‌های هزینه و درآمد',
      description:
        'مشاهده تمام دسته‌بندی‌های موجود در سیستم (مانند خوراک، خرید، حمل‌ونقل، حقوق، اقساط، قبوض و دسته‌های سفارشی) به همراه شناسه، آیکون و نوع آن‌ها.',
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async () => {
      try {
        const categories = await hesabyarApi.get('/categories')
        return formatSuccessResponse(categories)
      } catch (err) {
        return formatErrorResponse(err)
      }
    },
  )
}
