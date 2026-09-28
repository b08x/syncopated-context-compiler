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

      return data.data.map((m: any) => {
        const idLower = (m.id || '').toLowerCase();
        let contextLength = 8192;
        if (idLower.includes('128k') || idLower.includes('llama-3.3') || idLower.includes('llama-3.1')) {
          contextLength = 131072;
        } else if (idLower.includes('32768') || idLower.includes('mixtral')) {
          contextLength = 32768;
        }

        const is70b = idLower.includes('70b');
        const isLlama = idLower.includes('llama');
        const features: string[] = ['Ultra-low Latency', 'Structured JSON'];
        if (is70b) features.push('Deep Reasoning');
        if (isLlama) features.push('Function Calling');

        return {
          id: m.id || '',
          name: m.id || 'Unknown Model',
          description: `Fast Groq inference engine with LPU acceleration (${contextLength.toLocaleString()} context).`,
          contextLength,
          maxOutputTokens: 8192,
          pricing: {
            prompt: is70b ? 0.59 : 0.05,
            completion: is70b ? 0.79 : 0.08
          },
          supportedParameters: ['temperature', 'top_p', 'max_tokens', 'tools', 'response_format', 'seed'],
          features,
          capabilities: {
            tools: true,
            reasoning: is70b,
            structured: true,
          }
        };
      });
    } catch (e: any) {
      if (e.message?.includes('401') || e.message?.includes('403')) {
        throw e;
      }
      return [
        { 
          id: 'llama-3.3-70b-versatile', 
          name: 'Llama 3.3 70B Versatile', 
          description: 'State of the art open weights model running at blazing speeds on Groq LPUs.',
          contextLength: 131072,
          maxOutputTokens: 8192,
          pricing: { prompt: 0.59, completion: 0.79 },
          supportedParameters: ['temperature', 'top_p', 'tools', 'response_format', 'seed'],
          features: ['Ultra-low Latency', 'Function Calling', 'Structured JSON', 'Deep Reasoning'],
          capabilities: { tools: true, reasoning: true, structured: true } 
        },
        { 
          id: 'llama-3.1-70b-versatile', 
          name: 'Llama 3.1 70B Versatile', 
          description: 'High capability reasoning model on Groq hardware.',
          contextLength: 131072,
          maxOutputTokens: 8192,
          pricing: { prompt: 0.59, completion: 0.79 },
          supportedParameters: ['temperature', 'top_p', 'tools', 'response_format'],
          features: ['Ultra-low Latency', 'Function Calling', 'Structured JSON'],
          capabilities: { tools: true, reasoning: true, structured: true } 
        },
        { 
          id: 'llama-3.1-8b-instant', 
          name: 'Llama 3.1 8B Instant', 
          description: 'Sub-second lightweight execution model.',
          contextLength: 131072,
          maxOutputTokens: 8192,
          pricing: { prompt: 0.05, completion: 0.08 },
          supportedParameters: ['temperature', 'top_p', 'tools', 'response_format'],
          features: ['Ultra-low Latency', 'Instant Response', 'Structured JSON'],
          capabilities: { tools: true, reasoning: false, structured: true } 
        },
        { 
          id: 'mixtral-8x7b-32768', 
          name: 'Mixtral 8x7B', 
          description: 'Sparse mixture of experts model.',
          contextLength: 32768,
          maxOutputTokens: 4096,
          pricing: { prompt: 0.24, completion: 0.24 },
          supportedParameters: ['temperature', 'top_p', 'response_format'],
          features: ['Ultra-low Latency', 'Structured JSON'],
          capabilities: { tools: true, reasoning: false, structured: true } 
        },
        { 
          id: 'gemma2-9b-it', 
          name: 'Gemma 2 9B', 
          description: 'Google open weights model hosted on Groq.',
          contextLength: 8192,
          maxOutputTokens: 4096,
          pricing: { prompt: 0.20, completion: 0.20 },
          supportedParameters: ['temperature', 'top_p', 'response_format'],
          features: ['Ultra-low Latency', 'Structured JSON'],
          capabilities: { tools: true, reasoning: false, structured: true } 
        },
      ];
    }
  }
}
