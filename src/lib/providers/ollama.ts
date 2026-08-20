import { GenerationPrompt, GenerationResult, ModelProvider, ModelInfo } from '../../types/provider';

export class OllamaAdapter implements ModelProvider {
  id = 'ollama';
  name = 'Ollama (Local)';
  supportsDirectBrowser = true;

  private getBaseUrl(apiKey?: string) {
    // For Ollama, the "apiKey" field can be used for the URL if the user wants to override localhost
    if (apiKey) return apiKey;
    if (typeof process !== 'undefined' && process.env.OLLAMA_BASE_URL) return process.env.OLLAMA_BASE_URL;
    return 'http://localhost:11434';
  }

  async generate(prompt: GenerationPrompt, apiKey?: string, modelId?: string): Promise<GenerationResult> {
    const baseUrl = this.getBaseUrl(apiKey);
    const model = modelId || 'llama3';
    try {
      const response = await fetch(`${baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: model,
          prompt: prompt.user,
          system: prompt.system,
          stream: false,
          format: prompt.schema ? 'json' : undefined,
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama error (${response.status}): ${errorText}`);
      }
      
      const data = await response.json();

      return { 
        text: data.response,
        object: prompt.schema ? JSON.parse(data.response) : undefined
      };
    } catch (e) {
      console.error('Ollama connection failed:', e);
      const isNetworkError = e instanceof TypeError && e.message === 'Failed to fetch';
      const errorMessage = isNetworkError 
        ? 'Ollama connection failed (Network Error). This usually means Ollama is not running or OLLAMA_ORIGINS="*" is not set for CORS support. Check your terminal and environment variables.'
        : `Ollama connection failed: ${e instanceof Error ? e.message : String(e)}`;
      
      throw new Error(errorMessage);
    }
  }

  async *stream(prompt: GenerationPrompt, apiKey?: string, modelId?: string): AsyncGenerator<string> {
    const baseUrl = this.getBaseUrl(apiKey);
    const model = modelId || 'llama3';
    try {
      const response = await fetch(`${baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: model,
          prompt: prompt.user,
          system: prompt.system,
          stream: true,
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama stream error (${response.status}): ${errorText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (!line) continue;
          const data = JSON.parse(line);
          yield data.response || '';
        }
      }
    } catch (e) {
      console.error('Ollama streaming failed:', e);
      const isNetworkError = e instanceof TypeError && e.message === 'Failed to fetch';
      const errorMessage = isNetworkError 
        ? 'Ollama connection failed (Network Error). This usually means Ollama is not running or OLLAMA_ORIGINS="*" is not set for CORS support. Check your terminal and environment variables.'
        : `Ollama connection failed: ${e instanceof Error ? e.message : String(e)}`;
      
      throw new Error(errorMessage);
    }
  }

  async fetchModels(apiKey?: string): Promise<ModelInfo[]> {
    const baseUrl = this.getBaseUrl(apiKey);
    try {
      const response = await fetch(`${baseUrl}/api/tags`);
      if (!response.ok) {
        console.warn(`Ollama returned status ${response.status} for /api/tags`);
        return [];
      }
      const data = await response.json();
      return data.models.map((m: any) => ({
        id: m.name || '',
        name: m.name || 'Unknown Model',
        capabilities: {
          tools: false,
          reasoning: m.name?.includes('llama3') || m.name?.includes('mistral') || false,
          structured: true,
        }
      }));
    } catch (e) {
      const isNetworkError = e instanceof TypeError && e.message === 'Failed to fetch';
      if (isNetworkError) {
        console.warn('Ollama connection failed (Network Error). This usually means Ollama is not running or OLLAMA_ORIGINS="*" is not set for CORS support.');
        // Return a few common fallbacks so the user can at least see the option
        return [
          { id: 'llama3', name: 'Llama 3 (Fallback)', capabilities: { tools: false, reasoning: true, structured: true } },
          { id: 'mistral', name: 'Mistral (Fallback)', capabilities: { tools: false, reasoning: true, structured: true } },
        ];
      } else {
        console.error('Ollama connection failed:', e);
      }
      return [];
    }
  }
}
