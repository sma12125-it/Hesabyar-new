import express, { Router, type Request, type Response } from 'express'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { extractTokenFromHeaders, runWithAuthContext } from './auth/context'
import { hesabyarApi } from './client/hesabyarApi'
import { registerAccountTools } from './tools/accounts'
import { registerTransactionTools } from './tools/transactions'
import { registerTransferTools } from './tools/transfers'
import { registerCategoryTools } from './tools/categories'
import { registerInstallmentTools } from './tools/installments'
import { registerReportTools } from './tools/reports'
import { registerChequeTools } from './tools/cheques'
import { registerDebtTools } from './tools/debts'
import { registerCardTools } from './tools/cards'
import { registerSharingTools } from './tools/sharing'
import { registerSavingsTools } from './tools/savings'
import { registerInvestmentTools } from './tools/investments'
import { registerReminderTools } from './tools/reminders'

export function createHesabyarMcpServer(): McpServer {
  const server = new McpServer({
    name: 'hesabyar-mcp-server',
    version: '1.0.0',
  })

  // Register all modular tools across all 13 financial domains
  registerAccountTools(server)
  registerTransactionTools(server)
  registerTransferTools(server)
  registerCategoryTools(server)
  registerInstallmentTools(server)
  registerReportTools(server)
  registerChequeTools(server)
  registerDebtTools(server)
  registerCardTools(server)
  registerSharingTools(server)
  registerSavingsTools(server)
  registerInvestmentTools(server)
  registerReminderTools(server)

  return server
}

/**
 * Creates an Express Router for MCP endpoints (/mcp and /mcp/health)
 */
export function createMcpRouter(server?: McpServer): Router {
  const router = Router()
  const mcpServer = server || createHesabyarMcpServer()
  const transport = new StreamableHTTPServerTransport()

  // Connect transport to McpServer
  void mcpServer.connect(transport)

  // Health check endpoint for MCP
  router.get('/health', async (_req: Request, res: Response) => {
    const apiHealth = await hesabyarApi.checkHealth()
    // Count registered tools safely
    const toolsCount = Object.keys((mcpServer as any)._registeredTools || {}).length

    res.json({
      status: 'ok',
      mcp: 'HesabYar MCP Server',
      version: '1.0.0',
      transport: 'Streamable HTTP / SSE',
      apiConnection: apiHealth.status,
      toolsCount,
      timestamp: new Date().toISOString(),
    })
  })

  // Main MCP endpoint supporting Streamable HTTP / SSE transport
  router.all('/', async (req: Request, res: Response) => {
    const token = extractTokenFromHeaders(req.headers)

    // Execute the request within the AsyncLocalStorage auth context
    await runWithAuthContext({ token }, async () => {
      await transport.handleRequest(req, res)
    })
  })

  return router
}

// Standalone execution support
if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.MCP_PORT) || 3001
  const app = express()
  app.use(express.json())
  app.use('/mcp', createMcpRouter())

  app.listen(port, '0.0.0.0', () => {
    console.log(`[HesabYar MCP] Standalone server running at http://0.0.0.0:${port}/mcp`)
  })
}
