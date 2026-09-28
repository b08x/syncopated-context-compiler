import { GenerationPrompt, GenerationResult, ModelProvider, ModelInfo } from '../../types/provider';
import { GoogleGenAI, Modality } from "@google/genai";

export class GeminiAdapter implements ModelProvider {
  id = 'google';
  name = 'Google Gemini';
  supportsDirectBrowser = false;

  async generate(prompt: GenerationPrompt, apiKey?: string, modelId?: string): Promise<GenerationResult> {
    const key = apiKey || (typeof process !== 'undefined' ? (process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY) : undefined);
    if (!key) throw new Error('Gemini API key missing');
    
    const ai = new GoogleGenAI({ apiKey: key });
    let model = modelId || 'gemini-flash-latest';
    if (model === 'gemini-3-flash-preview') {
      model = 'gemini-flash-latest';
    }
    
    // Defensive content wrapping for the SDK
    const contents = Array.isArray(prompt.user) 
      ? prompt.user 
      : [{ role: 'user', parts: [{ text: prompt.user }] }];

    try {
      const response = await ai.models.generateContent({
        model: model,
        contents,
        config: {
          systemInstruction: prompt.system,
          responseMimeType: prompt.schema ? "application/json" : "text/plain",
        }
      });

      return { 
        text: response.text || '',
        object: prompt.schema ? JSON.parse(response.text || '{}') : undefined
      };
    } catch (err: any) {
      // If 503 / high demand occurs and we weren't already on gemini-flash-latest, retry on gemini-flash-latest
      if ((err.status === 503 || err.message?.includes('503') || err.message?.includes('high demand')) && model !== 'gemini-flash-latest') {
        const fallbackResponse = await ai.models.generateContent({
          model: 'gemini-flash-latest',
          contents,
          config: {
            systemInstruction: prompt.system,
            responseMimeType: prompt.schema ? "application/json" : "text/plain",
          }
        });
        return { 
          text: fallbackResponse.text || '',
          object: prompt.schema ? JSON.parse(fallbackResponse.text || '{}') : undefined
        };
      }
      throw err;
    }
  }

  async *stream(prompt: GenerationPrompt, apiKey?: string, modelId?: string): AsyncGenerator<string> {
    const key = apiKey || (typeof process !== 'undefined' ? (process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY) : undefined);
    if (!key) throw new Error('Gemini API key missing');

    const ai = new GoogleGenAI({ apiKey: key });
    let model = modelId || 'gemini-flash-latest';
    if (model === 'gemini-3-flash-preview') {
      model = 'gemini-flash-latest';
    }

    const response = await ai.models.generateContentStream({
      model: model,
      contents: prompt.user,
      config: {
        systemInstruction: prompt.system,
      }
    });

    for await (const chunk of response) {
      yield chunk.text || '';
    }
  }

  async speak(text: string, apiKey?: string): Promise<string> {
    const key = apiKey || (typeof process !== 'undefined' ? (process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY) : undefined);
    if (!key) throw new Error('Gemini API key missing');

    const ai = new GoogleGenAI({ apiKey: key });
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash-lite-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error('Failed to generate audio');
    return base64Audio;
  }

  async fetchModels(apiKey?: string): Promise<ModelInfo[]> {
    const key = apiKey || (typeof process !== 'undefined' ? (process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY) : undefined);
    
    // We can also fetch live models from Google if key is available
    if (key) {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.models) && data.models.length > 0) {
            return data.models
              .filter((m: any) => m.name && (m.supportedGenerationMethods?.includes('generateContent') || m.name.includes('gemini')))
              .map((m: any) => {
                const cleanId = m.name.replace(/^models\//, '');
                const isPro = cleanId.includes('pro');
                const isFlash = cleanId.includes('flash');
                const isVision = cleanId.includes('vision') || cleanId.includes('flash') || cleanId.includes('pro');
                
                const features: string[] = ['Structured JSON', 'Function Calling'];
                if (isVision) features.push('Vision');
                if (isPro) features.push('Deep Reasoning');
                if (cleanId.includes('thinking')) features.push('Thought Chain');
                
                return {
                  id: cleanId,
                  name: m.displayName || cleanId,
                  description: m.description,
                  contextLength: m.inputTokenLimit || (isPro ? 2097152 : 1048576),
                  maxOutputTokens: m.outputTokenLimit || 8192,
                  pricing: {
                    prompt: isPro ? 1.25 : 0.075,
                    completion: isPro ? 5.00 : 0.30
                  },
                  supportedParameters: ['temperature', 'top_p', 'top_k', 'tools', 'response_schema', 'seed'],
                  features,
                  capabilities: {
                    tools: true,
                    reasoning: isPro,
                    structured: true,
                    vision: isVision,
                    audio: cleanId.includes('audio') || cleanId.includes('tts')
                  }
                };
              });
          }
        }
      } catch (e) {
        console.warn('Failed to fetch dynamic Google models, falling back to curated list:', e);
      }
    }

    return [
      {
        id: 'gemini-flash-latest',
        name: 'Gemini Flash Latest',
        description: 'Next-generation multimodal workhorse model, fast and cost-effective.',
        contextLength: 1048576,
        maxOutputTokens: 8192,
        pricing: { prompt: 0.075, completion: 0.30 },
        supportedParameters: ['temperature', 'top_p', 'top_k', 'tools', 'response_schema', 'seed'],
        features: ['Function Calling', 'Structured JSON', 'Vision', 'Audio Input', 'Fast Latency'],
        capabilities: { tools: true, reasoning: true, structured: true, vision: true, audio: true }
      },
      {
        id: 'gemini-3.8-flash',
        name: 'Gemini 3.8 Flash',
        description: 'Optimized high-throughput multimodal intelligence for batch processing & reasoning.',
        contextLength: 1048576,
        maxOutputTokens: 8192,
        pricing: { prompt: 0.075, completion: 0.30 },
        supportedParameters: ['temperature', 'top_p', 'top_k', 'tools', 'response_schema'],
        features: ['Function Calling', 'Structured JSON', 'Vision', 'High Throughput'],
        capabilities: { tools: true, reasoning: true, structured: true, vision: true }
      },
      {
        id: 'gemini-3.1-pro-preview',
        name: 'Gemini 3.1 Pro (Preview)',
        description: 'Flagship reasoning and code intelligence model with 2M token context window.',
        contextLength: 2097152,
        maxOutputTokens: 8192,
        pricing: { prompt: 1.25, completion: 5.00 },
        supportedParameters: ['temperature', 'top_p', 'top_k', 'tools', 'response_schema', 'seed'],
        features: ['Deep Reasoning', 'Function Calling', 'Structured JSON', 'Vision', '2M Context'],
        capabilities: { tools: true, reasoning: true, structured: true, vision: true }
      }
    ];
  }
}
