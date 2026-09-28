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
      return data.models.map((m: any) => {
        const nameLower = (m.name || '').toLowerCase();
        let contextLength = 8192;
        if (nameLower.includes('llama3.1') || nameLower.includes('llama3.2') || nameLower.includes('llama3.3')) {
          contextLength = 131072;
        } else if (nameLower.includes('mistral') || nameLower.includes('qwen')) {
          contextLength = 32768;
        }

        const features: string[] = ['Local / Private', 'Zero Cost'];
        if (nameLower.includes('llama3') || nameLower.includes('qwen') || nameLower.includes('deepseek')) {
          features.push('Deep Reasoning');
        }
        if (nameLower.includes('vision') || nameLower.includes('llava')) {
          features.push('Vision');
        }

        return {
          id: m.name || '',
          name: m.name || 'Unknown Model',
          description: `Locally hosted Ollama model (${m.details?.parameter_size || 'local weights'}, ${m.details?.quantization_level || 'quantized'}).`,
          contextLength,
          pricing: { prompt: 0, completion: 0 },
          supportedParameters: ['temperature', 'top_p', 'top_k', 'repeat_penalty', 'seed', 'format'],
          features,
          capabilities: {
            tools: false,
            reasoning: nameLower.includes('llama3') || nameLower.includes('mistral') || nameLower.includes('deepseek'),
            structured: true,
            vision: nameLower.includes('llava') || nameLower.includes('vision'),
          }
        };
      });
    } catch (e) {
      const isNetworkError = e instanceof TypeError && e.message === 'Failed to fetch';
      if (isNetworkError) {
        console.warn('Ollama connection failed (Network Error). This usually means Ollama is not running or OLLAMA_ORIGINS="*" is not set for CORS support.');
        return [
          { 
            id: 'llama3', 
            name: 'Llama 3 (Fallback)', 
            contextLength: 8192,
            pricing: { prompt: 0, completion: 0 },
            supportedParameters: ['temperature', 'top_p', 'seed'],
            features: ['Local / Private', 'Zero Cost', 'Deep Reasoning'],
            capabilities: { tools: false, reasoning: true, structured: true } 
          },
          { 
            id: 'mistral', 
            name: 'Mistral (Fallback)', 
            contextLength: 32768,
            pricing: { prompt: 0, completion: 0 },
            supportedParameters: ['temperature', 'top_p', 'seed'],
            features: ['Local / Private', 'Zero Cost'],
            capabilities: { tools: false, reasoning: true, structured: true } 
          },
        ];
      } else {
        console.error('Ollama connection failed:', e);
      }
      return [];
    }
  }
}
