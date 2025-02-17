import { IsString } from "class-validator";

export class CreateIntroductionDto {
  @IsString()
  name: string;

  @IsString()
  description: string;

  @IsString()
  personality: string;

  @IsString()
  firstMessage: string;

  @IsString()
  scenario: string;
}