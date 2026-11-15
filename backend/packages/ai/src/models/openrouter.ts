export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content:
    | string
    | Array<
        | { type: 'text'; text: string }
        | {
            type: 'input_audio';
            input_audio: {
              data: string; // base64
              format: 'm4a' | 'mp3' | 'wav';
            };
          }
      >;
}

export interface OpenRouterChatRequest {
  model: string;
  messages: OpenRouterMessage[];
  response_format?: { type: 'json_object' };
  temperature?: number;
  max_tokens?: number;
}

export interface OpenRouterChatResponse {
  id: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface OpenRouterClientOptions {
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
}

/**
 * OpenRouter client with enforced provider data_collection: 'deny' (B5.2 / ADR-008).
 * Ensures zero data retention by model providers for privacy and compliance.
 */
export class OpenRouterClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(options: OpenRouterClientOptions = {}) {
    this.apiKey = options.apiKey ?? process.env['OPENROUTER_API_KEY'] ?? '';
    this.baseUrl = options.baseUrl ?? 'https://openrouter.ai/api/v1';
    this.timeoutMs = options.timeoutMs ?? 25_000;
  }

  async createChatCompletion(request: OpenRouterChatRequest): Promise<OpenRouterChatResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
          'HTTP-Referer': 'https://mockza.app',
          'X-Title': 'Mockza IELTS Prep',
        },
        body: JSON.stringify({
          ...request,
          // STRICT NO-RETENTION ROUTING
          provider: {
            data_collection: 'deny',
          },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenRouter API error (${response.status}): ${errorText}`);
      }

      return (await response.json()) as OpenRouterChatResponse;
    } finally {
      clearTimeout(timeout);
    }
  }
}
