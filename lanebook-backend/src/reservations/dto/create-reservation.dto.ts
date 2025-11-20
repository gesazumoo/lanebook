import { IsArray, ArrayMinSize, ArrayMaxSize, IsUUID } from 'class-validator';

export class CreateReservationDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one schedule ID is required' })
  @ArrayMaxSize(4, { message: 'Maximum 4 schedule IDs allowed' })
  @IsUUID('4', { each: true, message: 'Each schedule ID must be a valid UUID' })
  schedule_ids: string[];
}

