export interface SuccessResponse {
	message: string;
}

export interface MioContext {
	taskId: string;
	modelId: string;
	currentTokens: number;
	contextLimit: number;
	usagePercentage: number;
	totalMessages: number;
	activeMessages: number;
	archivedMessages: number;
	messagesWithoutTokenCount: number;
}

export interface MioMemoryItem {
	id: string;
	taskId: string | null;
	title: string;
	content: string;
	tags: string[];
	linkedTaskId: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface MioMemoriesResult {
	memories: MioMemoryItem[];
	total: number;
}

export interface MessageDeleteMultipleResult {
	deletedIds: number[];
	failedIds: number[];
	totalDeleted: number;
	totalFailed: number;
}

export interface WorkflowStates {
	validStates: Record<string, string[]>;
	processableStates: Record<string, string[]>;
	waitingStates: Record<string, string[]>;
	stoppedStates: Record<string, string[]>;
	intermediateStates: Record<string, string[]>;
}
