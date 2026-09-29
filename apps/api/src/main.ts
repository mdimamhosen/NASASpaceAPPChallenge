import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { LangfuseSpanProcessor } from '@langfuse/otel';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  if (
    config.get('observabilityBackend') === 'langfuse' &&
    process.env.LANGFUSE_PUBLIC_KEY &&
    process.env.LANGFUSE_SECRET_KEY
  ) {
    new NodeTracerProvider({ spanProcessors: [new LangfuseSpanProcessor()] }).register();
  }
  const origins = config.get<string[]>('corsOrigins') ?? ['http://localhost:3000'];
  app.enableCors({ origin: origins });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  const port = config.get<number>('port') ?? 4000;
  await app.listen(port);
}

void bootstrap();
