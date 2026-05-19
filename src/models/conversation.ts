export interface AttachmentMeta {
  id: string
  filename: string
  mimeType: string
  size: number
  width: number | null
  height: number | null
  tokenCount: number | null
}

export interface ToolCall {
  id: string
  type: string
  function: Record<string, unknown>
}

export interface Message {
  id: number
  role: string
  content: string
  createdAt: string
  kind: string | null
  name: string | null
  toolCalls: ToolCall[] | null
  toolCallId: string | null
  reasoning: string | null
  reasoningSummary: string | null
  toolCallSummary: string | null
  toolOutputSummary: string | null
  summarySource: string | null
  archived: boolean
  archivedReason: string | null
  attachments: AttachmentMeta[]
}

export interface ConversationResult {
  taskId: string
  conversation: Message[]
}

export interface MatrixConversationResult {
  taskId: string
  conversation: Message[]
}

export interface ArchivedContent {
  id: number
  content: string
  archived: boolean
  archivedReason: string | null
  createdAt: string
}

export interface MessageTranslation {
  locale: string
  kind: string
  translatedText: string
  isFallback: boolean
  createdAt: string | null
}

export interface MessageTranslationsResult {
  messageId: number
  translations: MessageTranslation[]
}

export interface MessageTranslationReadyEvent {
  taskId: string
  messageId: number
  locale: string
  messageIndex: number
  translatedContent: string | null
  translatedReasoning: string | null
  translatedReasoningSummary: string | null
  translatedToolCallSummary: string | null
  translationFailed: boolean
  eventType: string
}
