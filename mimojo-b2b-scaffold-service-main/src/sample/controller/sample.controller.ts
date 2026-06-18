import { Controller, Post, Body, Get, Param, Query } from '@nestjs/common';
import { SampleService } from '../services/sample.service';
import { ExampleDto } from '../dto/example';
import { CustomPinoLogger } from 'src/logger/custom-logger.service';
import { baseResponseHelper } from 'src/common/helpers/base-response.helper';

@Controller('sample')
export class SampleController {
  private readonly controllerName = 'SampleController';

  constructor(
    private readonly sampleService: SampleService,
    private readonly logger: CustomPinoLogger
  ) {}

  @Post('create')
  async createUser(@Body() exampleDto: ExampleDto): Promise<any> {
    const methodName = 'createUser';
    this.logger.info(`${this.controllerName}.${methodName} has been called`, { exampleDto });
    const id = await this.sampleService.sampleMethod(exampleDto);
    this.logger.info(`${this.controllerName}.${methodName} completed`, { id });
    return baseResponseHelper(id);
  }

  @Get('getNameById/:id')
  async getUserName(@Param('id') id: string, @Query('name') name: string): Promise<any> {
    const methodName = 'getUserName';
    this.logger.info(`${this.controllerName}.${methodName} has been called`, { id, name });
    this.logger.info(`${this.controllerName}.${methodName} completed`, { id, name });
    return baseResponseHelper({ id, name });
  }
}
