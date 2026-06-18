import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ScaffoldService } from './scaffold.service';
import { ApproveStageDto, RestartStageDto, StartScaffoldDto } from './dto/scaffold.dto';

/**
 * Human-in-the-loop scaffold pipeline.
 *
 * Flow (each stage pauses; reviewer must approve or reject with feedback):
 *   POST /scaffold/start                     → runs `functions` stage
 *   POST /scaffold/:id/approve {approved:true}  → advances to `diagrams`
 *   POST /scaffold/:id/approve {approved:true}  → advances to `docs`
 *   POST /scaffold/:id/approve {approved:true}  → advances to `db`
 *   POST /scaffold/:id/approve {approved:true}  → advances to `code`
 *   POST /scaffold/:id/approve {approved:true}  → advances to `github` (push)
 *
 *   POST /scaffold/:id/approve {approved:false, feedback:"..."} → regenerates current stage
 *   GET  /scaffold/:id                       → current state snapshot
 */
@ApiTags('scaffold')
@Controller('scaffold')
export class ScaffoldController {
  constructor(private readonly scaffoldService: ScaffoldService) {}

  @ApiOperation({ summary: 'Start a new scaffold session (runs functions stage)' })
  @Post('start')
  start(@Body() dto: StartScaffoldDto) {
    return this.scaffoldService.start(dto.projectName, dto.features);
  }

  @ApiOperation({ summary: 'Approve or reject current stage' })
  @Post(':id/approve')
  approve(@Param('id') id: string, @Body() dto: ApproveStageDto) {
    return this.scaffoldService.approve(id, dto.approved, dto.feedback);
  }

  @ApiOperation({
    summary: 'Restart from any previously executed stage',
    description:
      'Jump back to a prior stage, re-run it (with optional feedback), and clear all downstream outputs so they will be regenerated when the user approves forward again.',
  })
  @Post(':id/restart')
  restart(@Param('id') id: string, @Body() dto: RestartStageDto) {
    return this.scaffoldService.restart(id, dto.stage, dto.feedback);
  }

  @ApiOperation({ summary: 'List all persisted sessions (newest first)' })
  @Get()
  list() {
    return this.scaffoldService.list();
  }

  @ApiOperation({ summary: 'Get current session state' })
  @Get(':id')
  get(@Param('id') id: string) {
    return this.scaffoldService.get(id);
  }
}
