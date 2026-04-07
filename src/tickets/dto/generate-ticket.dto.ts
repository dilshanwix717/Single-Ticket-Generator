import { Type } from 'class-transformer';
import { IsArray, IsNumber } from 'class-validator';

export class GenerateTicketDto {
  @IsArray()
  @Type(() => Number)
  @IsNumber({}, { each: true })
  combination!: number[];
}
