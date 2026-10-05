import { loadConfig } from '../src/api.js'
import { createOmniaMcpFetchHandler } from '../src/server.js'

// Vercel project root: apps/mcp-server; public rewrite: /mcp.
const fetch=createOmniaMcpFetchHandler(loadConfig())
export default {fetch}
