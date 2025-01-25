import { IsBoolean, IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class CreateBotChatDto {
  @IsNotEmpty()
  @IsNumber()
  chatId: number;

  @IsNotEmpty()
  @IsNumber()
  userId: number;

  @IsNotEmpty()
  @IsString()
  characterId: string;

  @IsNotEmpty()
  @IsBoolean()
  isChannel: boolean;
}
