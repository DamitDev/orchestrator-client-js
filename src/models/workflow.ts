export interface SuccessResponse {
	message: string;
}

export interface MioContext {
	taskId: string;
	currentTokens: number;
	contextLimit: number;
	usagePercentage: number;
	archivedCount: number;
	activeCount: number;
}

export interface WorkflowStates {
	validStates: Record<string, string[]>;
	processableStates: Record<string, string[]>;
	waitingStates: Record<string, string[]>;
	stoppedStates: Record<string, string[]>;
	intermediateStates: Record<string, string[]>;
}
