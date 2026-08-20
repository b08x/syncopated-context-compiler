import { GenerationPrompt, GenerationResult, ModelProvider, ModelInfo } from '../../types/provider';
import { GoogleGenAI, Modality } from "@google/genai";

export class GeminiAdapter implements ModelProvider {
  id = 'google';
  name = 'Google Gemini';
  supportsDirectBrowser = false;

  async generate(prompt: GenerationPrompt, apiKey?: string, modelId?: string): Promise<GenerationResult> {
    const key = apiKey || (typeof process !== 'undefined' ? process.env.GEMINI_API_KEY : undefined);
    if (!key) throw new Error('Gemini API key missing');
    
    const ai = new GoogleGenAI({ apiKey: key });
    const model = modelId || 'gemini-3-flash-preview';
    
    // Defensive content wrapping for the SDK
    const contents = Array.isArray(prompt.user) 
      ? prompt.user 
      : [{ role: 'user', parts: [{ text: prompt.user }] }];

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
  }

  async *stream(prompt: GenerationPrompt, apiKey?: string, modelId?: string): AsyncGenerator<string> {
    const key = apiKey || (typeof process !== 'undefined' ? process.env.GEMINI_API_KEY : undefined);
    if (!key) throw new Error('Gemini API key missing');

    const ai = new GoogleGenAI({ apiKey: key });
    const model = modelId || 'gemini-3-flash-preview';

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
    const key = apiKey || (typeof process !== 'undefined' ? process.env.GEMINI_API_KEY : undefined);
    if (!key) throw new Error('Gemini API key missing');

    const ai = new GoogleGenAI({ apiKey: key });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
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
    return [
      {
        id: 'gemini-3-flash-preview',
        name: 'Gemini 3 Flash (Preview)',
        capabilities: { tools: true, reasoning: true, structured: true }
      },
      {
        id: 'gemini-3.1-pro-preview',
        name: 'Gemini 3.1 Pro (Preview)',
        capabilities: { tools: true, reasoning: true, structured: true }
      },
      {
        id: 'gemini-flash-latest',
        name: 'Gemini Flash Latest',
        capabilities: { tools: true, reasoning: false, structured: true }
      }
    ];
  }
}
