import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { ApiExcludeController } from '@nestjs/swagger';

@ApiExcludeController()
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  // Moved off `/` so the static frontend (public/index.html) can be served at root
  @Get('health')
  getHello(): string {
    return this.appService.getHello();
  }
}
