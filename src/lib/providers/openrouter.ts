import { GenerationPrompt, GenerationResult, ModelProvider, ModelInfo } from '../../types/provider';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateText } from 'ai';

export class OpenRouterAdapter implements ModelProvider {
  id = 'openrouter';
  name = 'OpenRouter';
  supportsDirectBrowser = false;

  async generate(prompt: GenerationPrompt, apiKey?: string, modelId?: string): Promise<GenerationResult> {
    const key = apiKey || (typeof process !== 'undefined' ? process.env.OPENROUTER_API_KEY : undefined);
    if (!key) throw new Error('OpenRouter API key missing');

    const openrouter = createOpenRouter({
      apiKey: key,
      headers: {
        'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'https://convo-workbench.internal',
        'X-Title': 'ConvoWorkbench',
      },
    });

    const model = modelId || 'google/gemini-pro-1.5';

    const { text } = await generateText({
      model: openrouter(model),
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
    const key = apiKey || (typeof process !== 'undefined' ? process.env.OPENROUTER_API_KEY : undefined);
    if (!key) throw new Error('OpenRouter API key missing');

    try {
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        headers: {
          'Authorization': `Bearer ${key}`,
          'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'https://convo-workbench.internal',
          'X-Title': 'ConvoWorkbench',
        }
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`OpenRouter API error (${response.status}): ${text.slice(0, 100)}`);
      }
      const data = await response.json();

      return data.data.map((m: any) => ({
        id: m.id || '',
        name: m.name || m.id || 'Unknown Model',
        description: m.description,
        capabilities: {
          tools: m.description?.toLowerCase().includes('tool') || false,
          reasoning: m.description?.toLowerCase().includes('reasoning') || m.id?.includes('thought') || false,
          structured: true,
        }
      }));
    } catch (e: any) {
      if (e.message?.includes('401')) {
        throw e;
      }
      console.warn('OpenRouter model fetch failed. Using fallback list.');
      return [
        { id: 'google/gemini-2.0-flash-001', name: 'Gemini 2.0 Flash (OpenRouter)', capabilities: { tools: true, reasoning: true, structured: true } },
        { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet (OpenRouter)', capabilities: { tools: true, reasoning: true, structured: true } },
        { id: 'deepseek/deepseek-chat', name: 'DeepSeek V3 (OpenRouter)', capabilities: { tools: true, reasoning: true, structured: true } },
        { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini (OpenRouter)', capabilities: { tools: true, reasoning: true, structured: true } },
        { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B (OpenRouter)', capabilities: { tools: true, reasoning: true, structured: true } },
      ];
    }
  }
}
