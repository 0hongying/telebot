import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { TagEntity } from 'src/tag/tag.dto';

export class CharacterDto {
  @IsNotEmpty()
  @IsString()
  avatar: string;

  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  personality: string;

  @IsString()
  scenario: string;

  @IsString()
  description: string;

  @IsString()
  exampleDialogs: string;

  @IsNotEmpty()
  @IsString()
  firstMessage: string;

  @IsNotEmpty()
  @IsBoolean()
  isPublic: boolean;

  @IsNumber({}, { each: true })
  tagIds: number[];
}

export class CharacterStats {
  chat: number;
  message: number;
  // Review etc later lol
}

export class CharacterView {
  id: string;
  name: string;
  avatar: string;
  description: string;
  createdAt: Date;
  isPublic: boolean;
  creatorId: string;
  tags?: TagEntity[];
  genderId: number;

  stats?: CharacterStats; // Populated later
}

export class SearchCharactersParams {
  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  tagId?: number;

  @IsNumber()
  @Type(() => Number)
  page: number;

  @IsString()
  @IsIn(['latest', 'popular'])
  sort: 'latest' | 'popular';

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  genderId?: number;
}

