import { z } from 'zod';

const schema = z.object({
  PORT: z.string().optional(),
  DATA_DIR: z.string().optional(),
  CORS_ORIGINS: z.string().optional(),
  WEB_ORIGIN: z.string().optional(),
  HTTP_RETRY_COUNT: z.string().optional(),
  EONET_BASE_URL: z.string().optional(),
  EONET_TIMEOUT_MS: z.string().optional(),
  EONET_CACHE_TTL_SEC: z.string().optional(),
  EONET_DEFAULT_STATUS: z.string().optional(),
  EONET_DEFAULT_LIMIT: z.string().optional(),
  EONET_DEFAULT_DAYS: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  CLAUDE_API_KEY: z.string().optional(),
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  DEEPSEEK_API_KEY: z.string().optional(),
  OBSERVABILITY_BACKEND: z.string().optional(),
  LANGCHAIN_TRACING_V2: z.string().optional(),
  LANGCHAIN_API_KEY: z.string().optional(),
  LANGCHAIN_PROJECT: z.string().optional(),
  LANGFUSE_PUBLIC_KEY: z.string().optional(),
  LANGFUSE_SECRET_KEY: z.string().optional(),
  LANGFUSE_BASE_URL: z.string().optional(),
  DATABASE_URL: z.string().optional(),
  POSTGIS_ENABLED: z.string().optional(),
  NASA_API_KEY: z.string().optional(),
}).passthrough();

export function validateEnv(config: Record<string, unknown>) {
  const parsed = schema.safeParse(config);
  if (!parsed.success) {
    const detail = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
    throw new Error(`Invalid environment configuration: ${detail}`);
  }
  return config;
}
