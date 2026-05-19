export interface SystemStatusSettings {
	agentModelId: string | null;
	orchestratorModelId: string | null;
	compactorModelId: string | null;
	journalModelId: string | null;
	summaryModelId: string | null;
	translateModelId: string | null;
	maxConcurrentTasksPerReplica: number | null;
	subagentsEnabled: boolean | null;
	localizationTargets: Record<string, string>[] | null;
}

export interface SystemStatus {
	isConfigured: boolean;
	missingFields: string[];
	settings: SystemStatusSettings;
	version: number;
}

export interface LLMBackendInfo {
	host: string;
	models: string[];
}

export interface MCPServerInfo {
	baseUrl: string;
	name: string;
	description: string;
	tools: string[];
}

export interface TaskHandlerReplica {
	holderId: string;
	maxConcurrentTasksPerReplica: number;
	currentlyRunningTasks: number;
	runningTaskIds: string[];
	leaseTtlSeconds: number;
	startedAt: string;
	lastHeartbeatAt: string;
}

export interface TaskHandlerCluster {
	maxConcurrentTasksPerReplica: number;
	currentlyRunningTasks: number;
	runningTaskIds: string[];
	replicasAlive: number;
	queuedTasks: number;
	activeTasks: number;
	totalTasks: number;
}

export interface TaskHandlerStatus {
	cluster: TaskHandlerCluster;
	replicas: TaskHandlerReplica[];
}

export interface TaskHandlerStatusLocal {
	running: boolean;
	maxConcurrentTasks: number;
	currentlyRunningTasks: number;
	runningTaskIds: string[];
	holderId: string;
	totalTasks: number;
	queuedTasks: number;
	activeTasks: number;
}

export interface SummaryWorkerStatus {
	running: boolean;
	uptimeSeconds: number;
	maxConcurrentSummaries: number;
	processedCount: number;
	queuedCount: number;
	pendingCount: number;
	queueSize: number;
	errorCount: number;
	modelId: string;
	translateModelId: string;
	isLeader: boolean;
}

export interface TokenWorkerStatus {
	running: boolean;
	uptimeSeconds: number;
	processedCount: number;
	queueSize: number;
	errorCount: number;
	encoding: string;
}

export interface SlotInfo {
	id: string;
	ip: string;
	status: string;
	taskId: string | null;
	lastActivity: string | null;
	idleSeconds: number | null;
}

export interface SlotsStatus {
	enabled: boolean;
	totalSlots: number;
	availableSlots: number;
	slotTools: string[];
	acquireTimeoutSeconds: number;
	slots: SlotInfo[];
}

export interface ConfigurationStatus {
	agentModel: string | null;
	orchestratorModel: string | null;
	summaryModel: string | null;
	translateModel: string | null;
	llmBackendsCount: number;
	mcpServersCount: number;
	totalTasks: number;
	queuedTasks: number;
	activeTasks: number;
	pendingApprovalTasks: number;
	subagentsEnabled: boolean;
	localizationTargets: Record<string, string>[];
}

export interface SubagentsStatus {
	subagentsEnabled: boolean;
}

export interface ReloadServicesResult {
	timestamp: string;
	llmBackends: Record<string, unknown>;
	mcpServers: Record<string, unknown>;
	slotManager: Record<string, unknown>;
	nextScheduledReload?: string;
}

export interface ReloadStatus {
	enabled: boolean;
	intervalHours: number | null;
	lastReload?: string;
	nextScheduledReload?: string;
}
