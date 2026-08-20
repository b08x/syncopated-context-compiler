export interface GenerationPrompt {
  system: string;
  user: string;
  schema?: any;
}

export interface GenerationResult {
  text: string;
  object?: any;
}

export interface ModelInfo {
  id: string;
  name: string;
  description?: string;
  capabilities: {
    tools: boolean;
    reasoning: boolean;
    structured: boolean;
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
