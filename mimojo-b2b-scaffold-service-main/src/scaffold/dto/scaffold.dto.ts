import { ArrayMinSize, IsArray, IsBoolean, IsNotEmpty, IsOptional, IsString, IsUrl, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class FeatureDto {
  @ApiProperty({ example: 'create order' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({
    required: false,
    type: [String],
    example: [
      'https://github.com/acme/order-svc/blob/main/src/order/order.controller.ts',
      'https://github.com/acme/billing-svc/blob/main/src/invoice/invoice.service.ts',
    ],
    description: 'Optional GitHub URLs (file or class permalinks) to reference for this feature',
  })
  @IsOptional()
  @IsArray()
  @IsUrl({ require_protocol: true }, { each: true })
  refs?: string[];
}

export class StartScaffoldDto {
  @ApiProperty({ example: 'order-management-service' })
  @IsNotEmpty()
  @IsString()
  projectName: string;

  @ApiProperty({
    type: [FeatureDto],
    example: [
      {
        name: 'create order',
        refs: ['https://github.com/acme/order-svc/blob/main/src/order/order.controller.ts'],
      },
      { name: 'cancel order' },
    ],
    description: 'Feature list. Each feature may include reference GitHub links.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => FeatureDto)
  features: FeatureDto[];
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
