import { IsString, IsNotEmpty } from 'class-validator';

export class ExampleDto {
  @IsString()
  @IsNotEmpty()
  id: string;
}
