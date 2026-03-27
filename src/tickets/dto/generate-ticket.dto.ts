import { Type } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';

export class GenerateTicketDto {
  @IsString()
  @IsNotEmpty()
  player_id!: string;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  bet_amount!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  multiplier!: number;

  @IsArray()
  @Type(() => Number)
  @IsNumber({}, { each: true })
  combination!: number[];

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  bet_tier?: number;
}
