import { GenerationPrompt, GenerationResult, ModelProvider, ModelInfo } from '../../types/provider';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';

export class GroqAdapter implements ModelProvider {
  id = 'groq';
  name = 'Groq';
  supportsDirectBrowser = false;

  async generate(prompt: GenerationPrompt, apiKey?: string, modelId?: string): Promise<GenerationResult> {
    const key = apiKey || (typeof process !== 'undefined' ? process.env.GROQ_API_KEY : undefined);
    if (!key) throw new Error('Groq API key missing');

    const groq = createOpenAI({
      apiKey: key,
      baseURL: 'https://api.groq.com/openai/v1',
    });

    const model = modelId || 'llama-3.3-70b-versatile';

    const { text } = await generateText({
      model: groq(model),
      system: prompt.system,
      prompt: prompt.user,
    });

    return { text };
  }

  async *stream(prompt: GenerationPrompt, apiKey?: string, modelId?: string): AsyncGenerator<string> {
    const result = await this.generate(prompt, apiKey, modelId);
    yield result.text;
  }

  async fetchModels(apiKey?: string): Promise<ModelInfo[]> {
    const key = apiKey || (typeof process !== 'undefined' ? process.env.GROQ_API_KEY : undefined);
    if (!key) throw new Error('Groq API key missing');

    try {
      const response = await fetch('https://api.groq.com/openai/v1/models', {
        headers: {
          'Authorization': `Bearer ${key}`
        }
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Groq API error (${response.status}): ${text.slice(0, 100)}`);
      }
      const data = await response.json();

      return data.data.map((m: any) => ({
        id: m.id || '',
        name: m.id || 'Unknown Model',
        capabilities: {
          tools: true,
          reasoning: m.id?.includes('llama-3.1') || m.id?.includes('70b') || false,
          structured: true,
        }
      }));
    } catch (e: any) {
      if (e.message?.includes('401')) {
        throw e;
      }
      console.warn('Groq model fetch failed. Using fallback list.');
      return [
        { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile', capabilities: { tools: true, reasoning: true, structured: true } },
        { id: 'llama-3.1-70b-versatile', name: 'Llama 3.1 70B Versatile', capabilities: { tools: true, reasoning: true, structured: true } },
        { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant', capabilities: { tools: true, reasoning: false, structured: true } },
        { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', capabilities: { tools: true, reasoning: false, structured: true } },
        { id: 'gemma2-9b-it', name: 'Gemma 2 9B', capabilities: { tools: true, reasoning: false, structured: true } },
      ];
    }
  }
}
