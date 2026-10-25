import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { PlacesModule } from '../places/places.module';
import { RoutesModule } from '../routes/routes.module';
import { ValidationController } from './validation.controller';
import { ValidationService } from './validation.service';

@Module({ imports: [CommonModule, PlacesModule, RoutesModule], controllers: [ValidationController], providers: [ValidationService] })
export class ValidationModule {}
