import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { ScaffoldController } from './scaffold.controller';
import { ScaffoldService } from './scaffold.service';
import { ScaffoldSession } from './entities/scaffold-session.model';

@Module({
  imports: [SequelizeModule.forFeature([ScaffoldSession])],
  controllers: [ScaffoldController],
  providers: [ScaffoldService],
})
export class ScaffoldModule {}
