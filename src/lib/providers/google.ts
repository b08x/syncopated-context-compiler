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

  async fetchModels(_apiKey?: string): Promise<ModelInfo[]> {
    return [
      {
        id: 'gemini-flash-latest',
        name: 'Gemini Flash Latest',
        capabilities: { tools: true, reasoning: true, structured: true }
      },
      {
        id: 'gemini-3.8-flash',
        name: 'Gemini 3.8 Flash',
        capabilities: { tools: true, reasoning: true, structured: true }
      },
      {
        id: 'gemini-3.1-pro-preview',
        name: 'Gemini 3.1 Pro (Preview)',
        capabilities: { tools: true, reasoning: true, structured: true }
      }
    ];
  }
}
