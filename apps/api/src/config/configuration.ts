import { join } from 'node:path';

export type AppConfig = {
  port: number;
  dataDir: string;
  corsOrigins: string[];
  httpRetryCount: number;
  eonet: {
    baseUrl: string;
    timeoutMs: number;
    cacheTtlSec: number;
    defaultStatus: string;
    defaultLimit: number;
    defaultDays: number;
  };
  observabilityBackend?: 'langsmith' | 'langfuse';
};

export default (): AppConfig => {
  const cors = process.env.CORS_ORIGINS || process.env.WEB_ORIGIN || 'http://localhost:3000';
  return {
    port: Number(process.env.PORT) || 4000,
    dataDir: process.env.DATA_DIR || join(process.cwd(), '../../data'),
    corsOrigins: cors.split(',').map((origin) => origin.trim()).filter(Boolean),
    httpRetryCount: Number(process.env.HTTP_RETRY_COUNT) || 2,
    eonet: {
      baseUrl: process.env.EONET_BASE_URL || 'https://eonet.gsfc.nasa.gov/api/v3',
      timeoutMs: Number(process.env.EONET_TIMEOUT_MS) || 10000,
      cacheTtlSec: Number(process.env.EONET_CACHE_TTL_SEC) || 120,
      defaultStatus: process.env.EONET_DEFAULT_STATUS || 'open',
      defaultLimit: Number(process.env.EONET_DEFAULT_LIMIT) || 50,
      defaultDays: Number(process.env.EONET_DEFAULT_DAYS) || 30,
    },
    observabilityBackend: process.env.OBSERVABILITY_BACKEND === 'langfuse' && process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY
      ? 'langfuse'
      : process.env.OBSERVABILITY_BACKEND === 'langsmith' && process.env.LANGCHAIN_API_KEY
        ? 'langsmith'
        : undefined,
  };
};
