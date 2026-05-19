export interface AuthConfig {
  keycloakEnabled: boolean
  keycloakUrl: string | null
  keycloakRealm: string | null
  keycloakClientId: string | null
}

export interface WebSocketClientInfo {
  clientId: string
  subscription: Record<string, unknown>
  connected: boolean
}

export interface WebSocketStatus {
  connectedClients: number
  clients: WebSocketClientInfo[]
}
