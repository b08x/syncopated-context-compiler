import { GenerationPrompt, GenerationResult, ModelProvider, ModelInfo } from '../../types/provider';

const FALLBACK_MODELS: Record<string, ModelInfo[]> = {
  google: [
    { id: 'gemini-flash-latest', name: 'Gemini Flash Latest', capabilities: { tools: true, reasoning: true, structured: true } },
    { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash', capabilities: { tools: true, reasoning: true, structured: true } },
    { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro (Preview)', capabilities: { tools: true, reasoning: true, structured: true } },
  ],
  mistral: [
    { id: 'mistral-large-latest', name: 'Mistral Large (Latest)', capabilities: { tools: true, reasoning: true, structured: true } },
    { id: 'mistral-small-latest', name: 'Mistral Small (Latest)', capabilities: { tools: true, reasoning: false, structured: true } },
    { id: 'open-mistral-nemo', name: 'Mistral Nemo', capabilities: { tools: true, reasoning: false, structured: true } },
    { id: 'codestral-latest', name: 'Codestral', capabilities: { tools: true, reasoning: true, structured: true } },
  ],
  groq: [
    { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile', capabilities: { tools: true, reasoning: true, structured: true } },
    { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant', capabilities: { tools: true, reasoning: false, structured: true } },
    { id: 'gemma2-9b-it', name: 'Gemma 2 9B', capabilities: { tools: true, reasoning: false, structured: true } },
  ],
  openrouter: [
    { id: 'google/gemini-2.0-flash-001', name: 'Gemini 2.0 Flash (OpenRouter)', capabilities: { tools: true, reasoning: true, structured: true } },
    { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet (OpenRouter)', capabilities: { tools: true, reasoning: true, structured: true } },
    { id: 'deepseek/deepseek-chat', name: 'DeepSeek V3 (OpenRouter)', capabilities: { tools: true, reasoning: true, structured: true } },
  ],
};

export class ProxyAdapter implements ModelProvider {
  constructor(public id: string, public name: string) {}
  
  supportsDirectBrowser = false;

  private getDefaultFallbackModels(): ModelInfo[] {
    return FALLBACK_MODELS[this.id] || [
      { id: 'default', name: `${this.name} Default Model`, capabilities: { tools: true, reasoning: true, structured: true } }
    ];
  }

  async generate(prompt: GenerationPrompt, apiKey: string | undefined, modelId: string): Promise<GenerationResult> {
    const response = await fetch('/api/llm/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        providerId: this.id,
        modelId,
        prompt,
        apiKey
      })
    });

    const contentType = response.headers.get('content-type') || '';
    const text = await response.text();
    let data;
    try {
      if (text.trim().startsWith('<') || contentType.includes('text/html')) {
        throw new Error('Service is warming up or temporarily unavailable. Please try again.');
      }
      data = JSON.parse(text);
    } catch (e: any) {
      if (e.message?.includes('temporarily unavailable')) {
        throw e;
      }
      if (!response.ok) {
        throw new Error(`Server Error (${response.status}): ${text.slice(0, 100)}`);
      }
      throw new Error(`Invalid response format from server: ${text.slice(0, 100)}`);
    }

    if (!response.ok) {
      const message = typeof data.error === 'object' 
        ? data.error.message || JSON.stringify(data.error)
        : data.error || 'Failed to generate';
      throw new Error(message);
    }

    return data;
  }

  async *stream(prompt: GenerationPrompt, apiKey: string | undefined, modelId: string): AsyncGenerator<string> {
    const response = await fetch('/api/llm/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        providerId: this.id,
        modelId,
        prompt,
        apiKey
      })
    });

    const contentType = response.headers.get('content-type') || '';
    if (!response.ok || contentType.includes('text/html')) {
      const text = await response.text();
      let message = 'Failed to stream';
      try {
        if (text.trim().startsWith('<') || contentType.includes('text/html')) {
          message = 'Service is warming up or temporarily unavailable. Please try again.';
        } else {
          const errorData = JSON.parse(text);
          message = typeof errorData.error === 'object' 
            ? errorData.error.message || JSON.stringify(errorData.error)
            : errorData.error || 'Failed to stream';
        }
      } catch {
        message = `Server Error (${response.status}): ${text.slice(0, 100)}`;
      }
      throw new Error(message);
    }

    const reader = response.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') return;
          try {
            const { chunk, error } = JSON.parse(data);
            if (error) throw new Error(error);
            yield chunk;
          } catch (e) {
            console.error('Failed to parse SSE data:', e);
          }
        }
      }
    }
  }

  async fetchModels(_apiKey: string | undefined): Promise<ModelInfo[]> {
    try {
      const response = await fetch(`/api/llm/models/${this.id}`);
      const contentType = response.headers.get('content-type') || '';
      const text = await response.text();
      
      if (text.trim().startsWith('<') || contentType.includes('text/html')) {
        return this.getDefaultFallbackModels();
      }

      const data = JSON.parse(text);
      if (!response.ok || !Array.isArray(data)) {
        return this.getDefaultFallbackModels();
      }
      
      return data;
    } catch {
      return this.getDefaultFallbackModels();
    }
  }

  async speak(text: string, apiKey: string | undefined): Promise<string> {
    const response = await fetch('/api/llm/speak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        providerId: this.id,
        text,
        apiKey
      })
    });

    const contentType = response.headers.get('content-type') || '';
    const bodyText = await response.text();
    let data;
    try {
      if (bodyText.trim().startsWith('<') || contentType.includes('text/html')) {
        throw new Error('Speech service is temporarily unavailable. Please try again.');
      }
      data = JSON.parse(bodyText);
    } catch (e: any) {
      if (e.message?.includes('temporarily unavailable')) throw e;
      throw new Error(`Invalid response from speak API: ${bodyText.slice(0, 100)}`);
    }

    if (!response.ok) {
      const message = typeof data.error === 'object' 
        ? data.error.message || JSON.stringify(data.error)
        : data.error || 'Failed to generate speech';
      throw new Error(message);
    }

    return data.audio;
  }
}
