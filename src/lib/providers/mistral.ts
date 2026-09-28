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

      return data.data.map((m: any) => {
        const idLower = (m.id || '').toLowerCase();
        let contextLength = 32768;
        if (idLower.includes('128k') || idLower.includes('large') || idLower.includes('nemo') || idLower.includes('pixtral')) {
          contextLength = 128000;
        }

        const isLarge = idLower.includes('large');
        const isPixtral = idLower.includes('pixtral');
        const isCodestral = idLower.includes('codestral');
        const features: string[] = ['Structured JSON', 'Function Calling'];
        if (isLarge) features.push('Deep Reasoning');
        if (isPixtral) features.push('Vision');
        if (isCodestral) features.push('Code Optimized');

        return {
          id: m.id || '',
          name: m.id || 'Unknown Model',
          description: m.description || `Mistral AI foundation model with ${contextLength.toLocaleString()} tokens context.`,
          contextLength,
          maxOutputTokens: 8192,
          pricing: {
            prompt: isLarge ? 2.00 : 0.20,
            completion: isLarge ? 6.00 : 0.60
          },
          supportedParameters: ['temperature', 'top_p', 'max_tokens', 'tools', 'response_format', 'safe_prompt'],
          features,
          capabilities: {
            tools: true,
            reasoning: isLarge || isCodestral,
            structured: true,
            vision: isPixtral
          }
        };
      });
    } catch (e: any) {
      if (e.message?.includes('401') || e.message?.includes('403')) {
        throw e;
      }
      return [
        { 
          id: 'mistral-large-latest', 
          name: 'Mistral Large (Latest)', 
          description: 'Top-tier reasoning model for complex multilingual reasoning and coding.',
          contextLength: 128000,
          maxOutputTokens: 8192,
          pricing: { prompt: 2.00, completion: 6.00 },
          supportedParameters: ['temperature', 'top_p', 'tools', 'response_format', 'safe_prompt'],
          features: ['Deep Reasoning', 'Function Calling', 'Structured JSON', 'Multilingual'],
          capabilities: { tools: true, reasoning: true, structured: true } 
        },
        { 
          id: 'mistral-small-latest', 
          name: 'Mistral Small (Latest)', 
          description: 'Cost-efficient and fast model for general instruction following.',
          contextLength: 32768,
          maxOutputTokens: 8192,
          pricing: { prompt: 0.20, completion: 0.60 },
          supportedParameters: ['temperature', 'top_p', 'tools', 'response_format'],
          features: ['Function Calling', 'Structured JSON', 'Fast Latency'],
          capabilities: { tools: true, reasoning: false, structured: true } 
        },
        { 
          id: 'open-mistral-nemo', 
          name: 'Mistral Nemo', 
          description: 'State of the art 12B model with 128k context developed with NVIDIA.',
          contextLength: 128000,
          maxOutputTokens: 8192,
          pricing: { prompt: 0.15, completion: 0.15 },
          supportedParameters: ['temperature', 'top_p', 'response_format'],
          features: ['Structured JSON', 'Large Context'],
          capabilities: { tools: true, reasoning: false, structured: true } 
        },
        { 
          id: 'codestral-latest', 
          name: 'Codestral', 
          description: 'Mistral generative model purpose-built for code generation and refactoring.',
          contextLength: 32768,
          maxOutputTokens: 8192,
          pricing: { prompt: 0.30, completion: 0.90 },
          supportedParameters: ['temperature', 'top_p', 'tools', 'response_format'],
          features: ['Code Optimized', 'Function Calling', 'Fill-in-the-Middle'],
          capabilities: { tools: true, reasoning: true, structured: true } 
        },
      ];
    }
  }
}
