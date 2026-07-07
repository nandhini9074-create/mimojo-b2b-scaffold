import { ArrayMinSize, IsArray, IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class FeatureDto {
  @ApiProperty({ example: 'create order' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ example: 'api', enum: ['api', 'file'], required: false })
  @IsOptional()
  @IsEnum(['api', 'file'])
  type?: 'api' | 'file';

  @ApiProperty({ example: 'VISA', enum: ['VISA', 'MC', 'MC and VISA'], required: false, description: 'Card scheme — only applicable for transaction API type features.' })
  @IsOptional()
  @IsString()
  scheme?: 'VISA' | 'MC' | 'MC and VISA';
}

export class TemplateGroupDto {
  @ApiProperty({ example: 'enrollment', enum: ['enrollment', 'transaction'] })
  @IsNotEmpty()
  @IsString()
  id: 'enrollment' | 'transaction';

  @ApiProperty({ type: [FeatureDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => FeatureDto)
  features: FeatureDto[];
}

export class StartScaffoldDto {
  @ApiProperty({ example: 'order-management-service' })
  @IsNotEmpty()
  @IsString()
  projectName: string;

  @ApiProperty({
    type: [FeatureDto],
    required: false,
    example: [
      { name: 'create order', type: 'api' },
      { name: 'file upload', type: 'file' },
    ],
    description: 'Feature list. Template references are auto-resolved from the server config based on feature type.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FeatureDto)
  features?: FeatureDto[];

  @ApiProperty({
    type: [TemplateGroupDto],
    required: false,
    description: 'List of template blocks, each containing their own features.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateGroupDto)
  template_groups?: TemplateGroupDto[];
}

export class ApproveStageDto {
  @ApiProperty({ description: 'true = move to next stage, false = regenerate this stage with feedback' })
  @IsBoolean()
  approved: boolean;

  @ApiProperty({ required: false, description: 'Required when approved=false' })
  @IsOptional()
  @IsString()
  feedback?: string;
}

export class RestartStageDto {
  @ApiProperty({
    description: 'Stage to restart from. Must be one of: functions | diagrams | docs | db | code | github',
    example: 'diagrams',
  })
  @IsNotEmpty()
  @IsString()
  stage: string;

  @ApiProperty({
    required: false,
    description: 'Optional feedback to apply when re-running the target stage. Also recorded as a refinement so downstream stages see it.',
  })
  @IsOptional()
  @IsString()
  feedback?: string;
}
