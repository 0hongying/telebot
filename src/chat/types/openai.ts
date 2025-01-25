export interface OpenAIInputMessage {
  role: 'system' | 'assistant' | 'user';
  content: string;
}
