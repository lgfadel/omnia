import { createOmniaMcpHandler } from './server.js'
import { loadConfig } from './api.js'

const host=process.env.HOST ?? '127.0.0.1'
const port=Number(process.env.PORT ?? '3001')
if(!Number.isInteger(port)||port<1||port>65535) throw new Error('PORT must be a TCP port')
createOmniaMcpHandler(loadConfig()).listen(port,host,()=>{
  process.stdout.write(`Omnia MCP listening on ${host}:${port}\n`)
})
