import { Controller, Get } from '@nestjs/common';
import { ValidationService } from './validation.service';

@Controller('validation')
export class ValidationController {
  constructor(private readonly validation: ValidationService) {}

  /** Validity evidence: DEM slopes on the real drive vs random lines, A* vs the drive, agent tool choice, science references. */
  @Get('report')
  report() { return this.validation.report(); }
}
