export interface ToolInfo {
	name: string;
	description: string;
	server: string;
}

export interface ToolsListResult {
	tools: ToolInfo[];
	totalTools: number;
	servers: string[];
}

export interface ToolCatalogEntry {
	name: string;
	description: string;
	provenanceKind: string;
	provenanceServer?: string;
	category: string;
	tags: string[];
	workflowIds?: string[];
	dangerous: boolean;
	hasFragment: boolean;
}

export interface ToolCatalogResult {
	tools: ToolCatalogEntry[];
	totalTools: number;
	providers: string[];
}

export interface MCPRefreshResult {
	results: Record<string, unknown>;
	totalRefreshed: number;
}

export interface CatalogValidationIssue {
	toolName: string;
	issueType: string;
	detail: string;
}

export interface CatalogValidationResult {
	issues: CatalogValidationIssue[];
	totalIssues: number;
}
