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

      return data.data.map((m: any) => {
        const desc = m.description || '';
        const descLower = desc.toLowerCase();
        
        // Extract supported parameters
        const supportedParams: string[] = Array.isArray(m.supported_parameters) 
          ? m.supported_parameters 
          : [];
        
        // Features detection
        const features: string[] = [];
        if (supportedParams.includes('tools') || descLower.includes('tool') || descLower.includes('function call')) {
          features.push('Function Calling');
        }
        if (supportedParams.includes('response_format') || supportedParams.includes('json') || descLower.includes('json')) {
          features.push('Structured JSON');
        }
        if (descLower.includes('vision') || descLower.includes('multimodal') || m.architecture?.modality?.includes('image')) {
          features.push('Vision');
        }
        if (descLower.includes('reasoning') || m.id?.includes('thought') || m.id?.includes('deepseek-r1') || m.id?.includes('o1') || m.id?.includes('o3')) {
          features.push('Deep Reasoning');
        }
        if (descLower.includes('code') || m.id?.includes('coder') || m.id?.includes('codestral')) {
          features.push('Code Optimized');
        }

        // Pricing parsing (OpenRouter returns pricing per token in USD string/number)
        let promptPrice = 0;
        let completionPrice = 0;
        if (m.pricing) {
          const p = typeof m.pricing.prompt === 'string' ? parseFloat(m.pricing.prompt) : Number(m.pricing.prompt || 0);
          const c = typeof m.pricing.completion === 'string' ? parseFloat(m.pricing.completion) : Number(m.pricing.completion || 0);
          // Convert to USD per 1 Million tokens for readable display
          promptPrice = isNaN(p) ? 0 : p * 1_000_000;
          completionPrice = isNaN(c) ? 0 : c * 1_000_000;
        }

        return {
          id: m.id || '',
          name: m.name || m.id || 'Unknown Model',
          description: m.description,
          contextLength: m.context_length || undefined,
          maxOutputTokens: m.top_provider?.max_completion_tokens || undefined,
          pricing: m.pricing ? {
            prompt: promptPrice,
            completion: completionPrice,
            image: m.pricing.image ? parseFloat(m.pricing.image) : undefined,
            request: m.pricing.request ? parseFloat(m.pricing.request) : undefined,
          } : undefined,
          supportedParameters: supportedParams.length > 0 ? supportedParams : ['temperature', 'top_p', 'max_tokens'],
          architecture: {
            modality: m.architecture?.modality,
            tokenizer: m.architecture?.tokenizer,
            instructType: m.architecture?.instruct_type,
          },
          features,
          capabilities: {
            tools: features.includes('Function Calling'),
            reasoning: features.includes('Deep Reasoning'),
            structured: true,
            vision: features.includes('Vision'),
          }
        };
      });
    } catch (e: any) {
      if (e.message?.includes('401') || e.message?.includes('403')) {
        throw e;
      }
      return [
        { 
          id: 'google/gemini-2.0-flash-001', 
          name: 'Gemini 2.0 Flash (OpenRouter)', 
          contextLength: 1048576,
          maxOutputTokens: 8192,
          pricing: { prompt: 0.10, completion: 0.40 },
          supportedParameters: ['temperature', 'top_p', 'top_k', 'tools', 'response_format', 'seed'],
          features: ['Function Calling', 'Structured JSON', 'Vision', 'Deep Reasoning'],
          capabilities: { tools: true, reasoning: true, structured: true, vision: true } 
        },
        { 
          id: 'anthropic/claude-3.5-sonnet', 
          name: 'Claude 3.5 Sonnet (OpenRouter)', 
          contextLength: 200000,
          maxOutputTokens: 8192,
          pricing: { prompt: 3.00, completion: 15.00 },
          supportedParameters: ['temperature', 'top_p', 'tools', 'response_format'],
          features: ['Function Calling', 'Structured JSON', 'Vision', 'Code Optimized'],
          capabilities: { tools: true, reasoning: true, structured: true, vision: true } 
        },
        { 
          id: 'deepseek/deepseek-chat', 
          name: 'DeepSeek V3 (OpenRouter)', 
          contextLength: 64000,
          maxOutputTokens: 8000,
          pricing: { prompt: 0.14, completion: 0.28 },
          supportedParameters: ['temperature', 'top_p', 'tools', 'response_format'],
          features: ['Function Calling', 'Structured JSON', 'Code Optimized'],
          capabilities: { tools: true, reasoning: true, structured: true } 
        },
        { 
          id: 'deepseek/deepseek-r1', 
          name: 'DeepSeek R1 (OpenRouter)', 
          contextLength: 128000,
          maxOutputTokens: 8000,
          pricing: { prompt: 0.55, completion: 2.19 },
          supportedParameters: ['temperature', 'top_p', 'response_format'],
          features: ['Deep Reasoning', 'Structured JSON', 'Code Optimized'],
          capabilities: { tools: false, reasoning: true, structured: true } 
        },
        { 
          id: 'openai/gpt-4o-mini', 
          name: 'GPT-4o Mini (OpenRouter)', 
          contextLength: 128000,
          maxOutputTokens: 16384,
          pricing: { prompt: 0.15, completion: 0.60 },
          supportedParameters: ['temperature', 'top_p', 'tools', 'response_format', 'seed'],
          features: ['Function Calling', 'Structured JSON', 'Vision'],
          capabilities: { tools: true, reasoning: true, structured: true, vision: true } 
        },
        { 
          id: 'meta-llama/llama-3.3-70b-instruct', 
          name: 'Llama 3.3 70B (OpenRouter)', 
          contextLength: 131072,
          maxOutputTokens: 8192,
          pricing: { prompt: 0.35, completion: 0.40 },
          supportedParameters: ['temperature', 'top_p', 'tools', 'response_format'],
          features: ['Function Calling', 'Structured JSON', 'Deep Reasoning'],
          capabilities: { tools: true, reasoning: true, structured: true } 
        },
      ];
    }
  }
}
