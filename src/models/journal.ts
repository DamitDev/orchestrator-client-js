export interface CompactionEvent {
	id: number;
	taskId: string;
	triggeredAt: string;
	triggerReason: string;
	preTokenCount: number;
	postTokenCount: number;
	clearedToolCount: number;
	messagesArchived: number;
	boundaryMessageId: number | null;
	consecutiveFailuresAtStart: number;
	durationMs: number;
	workflowId: string;
	compactorModelId: string;
}

export interface TaskJournal {
	taskId: string;
	exists: boolean;
	content: string | null;
	updatedAt: string | null;
	version: number | null;
	sectionsOverBudget: Record<string, number> | null;
}

export interface AttachmentUploadResponse {
	id: string;
	filename: string;
	mimeType: string;
	size: number;
	width: number | null;
	height: number | null;
	tokenCount: number | null;
}
