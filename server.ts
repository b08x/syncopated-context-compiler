import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GeminiAdapter } from "./src/lib/providers/google";
import { OpenRouterAdapter } from "./src/lib/providers/openrouter";
import { MistralAdapter } from "./src/lib/providers/mistral";
import { GroqAdapter } from "./src/lib/providers/groq";
import { OllamaAdapter } from "./src/lib/providers/ollama";
import { ModelProvider } from "./src/types/provider";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Helper to ensure Nginx proxy_intercept_errors (which intercepts 403, 502, 503, 504)
  // never replaces an API JSON error response with warmup.html or forbidden.html
  const getSafeApiStatus = (status: any, defaultStatus = 500) => {
    const num = Number(status);
    if (!num || [403, 502, 503, 504].includes(num)) {
      return defaultStatus;
    }
    return num;
  };

  const extractErrorMessage = (error: any, fallback = "An error occurred"): string => {
    if (!error) return fallback;
    if (typeof error === 'string') return error;
    if (error.message) {
      try {
        const parsed = JSON.parse(error.message);
        if (parsed?.error?.message) return parsed.error.message;
        if (typeof parsed?.error === 'string') return parsed.error;
      } catch {
        // Not a JSON string
      }
      return error.message;
    }
    return fallback;
  };

  const providers = {
    google: new GeminiAdapter(),
    openrouter: new OpenRouterAdapter(),
    mistral: new MistralAdapter(),
    groq: new GroqAdapter(),
    ollama: new OllamaAdapter(),
  };

  const getApiKey = (providerId: string) => {
    switch (providerId) {
      case 'google':
      case 'gemini': return process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
      case 'openrouter': return process.env.OPENROUTER_API_KEY;
      case 'mistral': return process.env.MISTRAL_API_KEY;
      case 'groq': return process.env.GROQ_API_KEY;
      case 'ollama': return ''; // Ollama usually doesn't need a key
      default: return '';
    }
  };

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/llm/status", (req, res) => {
    res.json({
      status: "ok",
      providers: {
        google: Boolean(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY),
        openrouter: Boolean(process.env.OPENROUTER_API_KEY),
        mistral: Boolean(process.env.MISTRAL_API_KEY),
        groq: Boolean(process.env.GROQ_API_KEY),
        ollama: true,
      }
    });
  });

  app.post("/api/llm/test", async (req, res) => {
    const startTime = Date.now();
    try {
      const { providerId, apiKey: clientApiKey } = req.body;
      const provider = providers[providerId as keyof typeof providers] as ModelProvider;
      if (!provider) {
        return res.status(404).json({ success: false, error: `Provider '${providerId}' not found` });
      }

      const apiKey = clientApiKey || getApiKey(providerId);
      if (providerId !== 'ollama' && !apiKey) {
        return res.status(400).json({ 
          success: false, 
          error: `No API key provided or configured for ${provider.name}` 
        });
      }

      const models = await provider.fetchModels(apiKey);
      const latencyMs = Date.now() - startTime;
      
      if (!models || !Array.isArray(models)) {
        throw new Error("Invalid response format from provider");
      }

      res.json({
        success: true,
        providerId,
        providerName: provider.name,
        modelsCount: models.length,
        latencyMs,
        message: `Successfully connected to ${provider.name} (${models.length} models discovered in ${latencyMs}ms)`
      });
    } catch (error: any) {
      const latencyMs = Date.now() - startTime;
      console.error(`Connection test failed for ${req.body?.providerId}:`, error);
      res.status(getSafeApiStatus(error.status, 400)).json({
        success: false,
        providerId: req.body?.providerId,
        latencyMs,
        error: extractErrorMessage(error, "Failed to establish connection")
      });
    }
  });

  app.get("/api/llm/models/:providerId", async (req, res) => {
    try {
      const { providerId } = req.params;
      const provider = providers[providerId as keyof typeof providers] as ModelProvider;
      if (!provider) {
        console.warn(`Provider not found: ${providerId}`);
        return res.status(404).json({ error: "Provider not found" });
      }

      const apiKey = getApiKey(providerId);
      const models = await provider.fetchModels(apiKey);
      if (!models || !Array.isArray(models)) {
        throw new Error(`Provider ${providerId} returned invalid models format`);
      }
      res.json(models);
    } catch (error: any) {
      console.error(`Error in /api/llm/models/${req.params.providerId}:`, error);
      res.status(getSafeApiStatus(error.status, 500)).json({ 
        error: extractErrorMessage(error, "Failed to fetch models") 
      });
    }
  });

  app.post("/api/llm/generate", async (req, res) => {
    try {
      const { providerId, modelId, prompt, apiKey: clientApiKey } = req.body;
      const provider = providers[providerId as keyof typeof providers] as ModelProvider;
      if (!provider) return res.status(404).json({ error: "Provider not found" });

      const apiKey = clientApiKey || getApiKey(providerId);
      const result = await provider.generate(prompt, apiKey, modelId);
      res.json(result);
    } catch (error: any) {
      console.error(`Error in /api/llm/generate (${req.body?.providerId}):`, error);
      res.status(getSafeApiStatus(error.status, 500)).json({ 
        error: extractErrorMessage(error, "Generation failed") 
      });
    }
  });

  // Streaming endpoint
  app.post("/api/llm/stream", async (req, res) => {
    try {
      const { providerId, modelId, prompt, apiKey: clientApiKey } = req.body;
      const provider = providers[providerId as keyof typeof providers] as ModelProvider;
      if (!provider) return res.status(404).json({ error: "Provider not found" });

      const apiKey = clientApiKey || getApiKey(providerId);
      
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      for await (const chunk of provider.stream(prompt, apiKey, modelId)) {
        res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
      }
      res.write('data: [DONE]\n\n');
      res.end();
    } catch (error: any) {
      console.error(`Stream error for ${req.body?.providerId}:`, error);
      const errMsg = extractErrorMessage(error, "Streaming failed");
      if (!res.headersSent) {
        res.status(getSafeApiStatus(error.status, 500)).json({ error: errMsg });
      } else {
        res.write(`data: ${JSON.stringify({ error: errMsg })}\n\n`);
        res.end();
      }
    }
  });

  app.post("/api/llm/speak", async (req, res) => {
    try {
      const { providerId, text, apiKey: clientApiKey } = req.body;
      let provider = providers[providerId as keyof typeof providers] as ModelProvider;
      
      // If provider not found or lacks speak, try falling back to google
      if (!provider || !provider.speak) {
        console.warn(`Provider ${providerId} does not support speak. Falling back to google.`);
        provider = providers.google;
      }

      if (!provider || !provider.speak) {
        return res.status(404).json({ error: "No available provider supports speak" });
      }

      const apiKey = clientApiKey || getApiKey(provider === providers.google ? 'google' : providerId);
      const base64Audio = await provider.speak(text, apiKey);
      res.json({ audio: base64Audio });
    } catch (error: any) {
      console.error(`Speak error for ${req.body?.providerId}:`, error);
      res.status(getSafeApiStatus(error.status, 500)).json({ 
        error: extractErrorMessage(error, "Speech generation failed") 
      });
    }
  });

  // Handle common API 404s before Vite
  app.all("/api/*", (req, res) => {
    res.status(404).json({ error: `API route not found: ${req.method} ${req.path}` });
  });

  app.all("/api", (req, res) => {
    res.status(404).json({ error: "API route not found" });
  });

  // Ensure all unhandled API errors return JSON
  app.use((err: any, req: any, res: any, next: any) => {
    if (req.path.startsWith('/api')) {
      console.error('Unhandled API Error:', err);
      return res.status(getSafeApiStatus(err.status, 500)).json({ 
        error: extractErrorMessage(err, 'Internal Server Error'),
        details: process.env.NODE_ENV !== 'production' ? err.stack : undefined
      });
    }
    next(err);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
