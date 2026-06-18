import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { SampleService } from './services/sample.service';
import { User } from './entities/sample.model';
import { SampleController } from './controller/sample.controller';
import { ModelService } from './services/model.service';

@Module({
  imports: [SequelizeModule.forFeature([User])],
  controllers: [SampleController],
  providers: [SampleService, ModelService],
  exports: [SampleService],
})
export class SampleModule {}
