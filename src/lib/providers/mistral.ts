import { GenerationPrompt, GenerationResult, ModelProvider, ModelInfo } from '../../types/provider';
import { createMistral } from '@ai-sdk/mistral';
import { generateText } from 'ai';

export class MistralAdapter implements ModelProvider {
  id = 'mistral';
  name = 'Mistral';
  supportsDirectBrowser = false;

  async generate(prompt: GenerationPrompt, apiKey?: string, modelId?: string): Promise<GenerationResult> {
    const key = apiKey || (typeof process !== 'undefined' ? process.env.MISTRAL_API_KEY : undefined);
    if (!key) throw new Error('Mistral API key missing');

    const mistral = createMistral({ apiKey: key });
    const model = modelId || 'mistral-large-latest';

    const { text } = await generateText({
      model: mistral(model),
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
    const key = apiKey || (typeof process !== 'undefined' ? process.env.MISTRAL_API_KEY : undefined);
    if (!key) throw new Error('Mistral API key missing');

    try {
      const response = await fetch('https://api.mistral.ai/v1/models', {
        headers: {
          'Authorization': `Bearer ${key}`
        }
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Mistral API error (${response.status}): ${text.slice(0, 100)}`);
      }
      const data = await response.json();

      return data.data.map((m: any) => ({
        id: m.id || '',
        name: m.id || 'Unknown Model',
        capabilities: {
          tools: true,
          reasoning: m.id?.includes('large') || m.id?.includes('pixtral') || false,
          structured: true,
        }
      }));
    } catch (e: any) {
      if (e.message?.includes('401')) {
        throw e;
      }
      console.warn('Mistral model fetch failed. Using fallback list.');
      return [
        { id: 'mistral-large-latest', name: 'Mistral Large (Latest)', capabilities: { tools: true, reasoning: true, structured: true } },
        { id: 'mistral-small-latest', name: 'Mistral Small (Latest)', capabilities: { tools: true, reasoning: false, structured: true } },
        { id: 'open-mistral-nemo', name: 'Mistral Nemo', capabilities: { tools: true, reasoning: false, structured: true } },
        { id: 'codestral-latest', name: 'Codestral', capabilities: { tools: true, reasoning: true, structured: true } },
      ];
    }
  }
}
