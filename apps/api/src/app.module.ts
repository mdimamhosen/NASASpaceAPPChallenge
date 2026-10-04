import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { validateEnv } from './config/env.validation';
import { CommonModule } from './common/common.module';
import { HealthModule } from './health/health.module';
import { LayersModule } from './layers/layers.module';
import { RegionsModule } from './regions/regions.module';
import { RoutesModule } from './routes/routes.module';
import { EonetModule } from './eonet/eonet.module';
import { RagModule } from './rag/rag.module';
import { AgentModule } from './agent/agent.module';
import { OpsModule } from './ops/ops.module';
import { BriefingsModule } from './briefings/briefings.module';
import { PlacesModule } from './places/places.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['../../.env', '.env'],
      validate: validateEnv,
    }),
    CommonModule,
    HealthModule,
    LayersModule,
    RegionsModule,
    RoutesModule,
    EonetModule,
    RagModule,
    AgentModule,
    BriefingsModule,
    PlacesModule,
    OpsModule,
  ],
})
export class AppModule {}
