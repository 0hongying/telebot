import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateBotEventDto {
  @IsNotEmpty()
  @IsNumber()
  userId: number;

  @IsNotEmpty()
  @IsString()
  eventName: string;

  @IsString()
  @IsOptional()
  referrerInfo?: string;
}
