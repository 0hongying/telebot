import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@Controller()
@ApiTags('test')
@ApiBearerAuth()
export class AppController {
  constructor() {}

  @Get('/env')
  getEnv() {
    return { env: process.env.NODE_ENV || 'local' };
  }
}
