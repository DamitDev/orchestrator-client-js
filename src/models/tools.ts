export interface ToolInfo {
  name: string
  description: string
  server: string
}

export interface ToolsListResult {
  tools: ToolInfo[]
  totalTools: number
  servers: string[]
}
