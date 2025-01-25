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

  stats?: CharacterStats; // Populated later
}

export class SearchCharactersParams {
  @IsString()
  @IsOptional()
  user_id?: string;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  tag_id?: number;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  page?: number;

  @IsString()
  @IsIn(['sfw', 'all', 'nsfw'])
  @IsOptional()
  mode?: 'sfw' | 'all' | 'nsfw';

  @IsString()
  @IsOptional()
  @IsIn(['latest', 'popular'])
  sort?: 'latest' | 'popular';

  @IsString()
  @IsIn(['trending', 'newcomer'])
  @IsOptional()
  special_mode?: 'trending' | 'newcomer'; // Some special mode for front-page, custom filter & sort
}

