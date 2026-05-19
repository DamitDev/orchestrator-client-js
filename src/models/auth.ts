export interface AuthConfig {
	keycloakEnabled: boolean;
	keycloakUrl: string | null;
	keycloakRealm: string | null;
	keycloakClientId: string | null;
}

export interface WebSocketClientInfo {
	clientId: string;
	connectedAt: string;
}

export interface WebSocketStatus {
	connectedClients: number;
	clients: WebSocketClientInfo[];
	eventListenerHealthy: boolean;
	lastEventTime?: string;
}
