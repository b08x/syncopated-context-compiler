export interface GenerationPrompt {
  system: string;
  user: string;
  schema?: any;
}

export interface GenerationResult {
  text: string;
  object?: any;
}

export interface ModelPricing {
  prompt: number; // USD per token or per million tokens
  completion: number;
  image?: number;
  request?: number;
}

export interface ModelInfo {
  id: string;
  name: string;
  description?: string;
  contextLength?: number;
  maxOutputTokens?: number;
  pricing?: ModelPricing;
  supportedParameters?: string[]; // e.g. ["temperature", "top_p", "top_k", "tools", "response_format", "seed"]
  architecture?: {
    modality?: string;
    tokenizer?: string;
    instructType?: string;
  };
  features?: string[]; // e.g. ["Function Calling", "JSON Mode", "Vision", "Reasoning", "System Prompt"]
  capabilities: {
    tools: boolean;
    reasoning: boolean;
    structured: boolean;
    vision?: boolean;
    audio?: boolean;
  };
}

export interface ModelProvider {
  id: string;
  name: string;
  supportsDirectBrowser: boolean;
  generate(prompt: GenerationPrompt, apiKey: string | undefined, modelId: string): Promise<GenerationResult>;
  stream(prompt: GenerationPrompt, apiKey: string | undefined, modelId: string): AsyncGenerator<string>;
  fetchModels(apiKey: string | undefined): Promise<ModelInfo[]>;
  speak?(text: string, apiKey: string | undefined): Promise<string>;
}

export type TaskType = 
  | 'import' 
  | 'review' 
  | 'trajectory' 
  | 'distillation_weak' 
  | 'distillation_strong' 
  | 'retrieval'
  | 'insights'
  | 'summary'
  | 'refactor'
  | 'search';

export interface TaskModelConfig {
  providerId: string;
  modelId: string;
  parameters: {
    temperature: number;
    maxTokens: number;
  };
}
