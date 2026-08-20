import { GenerationPrompt, GenerationResult, ModelProvider, ModelInfo } from '../../types/provider';

export class ProxyAdapter implements ModelProvider {
  constructor(public id: string, public name: string) {}
  
  supportsDirectBrowser = false;

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

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      if (!response.ok) {
        throw new Error(`Server Error (${response.status}): ${text.slice(0, 100)}...`);
      }
      throw new Error(`Invalid JSON response: ${text.slice(0, 100)}...`);
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

    if (!response.ok) {
      const text = await response.text();
      let message = 'Failed to stream';
      try {
        const errorData = JSON.parse(text);
        message = typeof errorData.error === 'object' 
          ? errorData.error.message || JSON.stringify(errorData.error)
          : errorData.error || 'Failed to stream';
      } catch (e) {
        message = `Server Error (${response.status}): ${text.slice(0, 100)}...`;
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
    const response = await fetch(`/api/llm/models/${this.id}`);
    const text = await response.text();
    
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      throw new Error(`Failed to parse models response correctly for ${this.id}: ${text.slice(0, 100)}...`);
    }

    if (!response.ok) {
      throw new Error(data.error || `Failed to fetch models: ${response.status}`);
    }
    
    return data;
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

    const bodyText = await response.text();
    let data;
    try {
      data = JSON.parse(bodyText);
    } catch (e) {
      throw new Error(`Invalid response from speak API: ${bodyText.slice(0, 100)}...`);
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
