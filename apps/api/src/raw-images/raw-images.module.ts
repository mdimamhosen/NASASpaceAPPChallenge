import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { RawImagesController } from './raw-images.controller';
import { RawImagesService } from './raw-images.service';

@Module({
  imports: [CommonModule],
  controllers: [RawImagesController],
  providers: [RawImagesService],
  exports: [RawImagesService],
})
export class RawImagesModule {}
