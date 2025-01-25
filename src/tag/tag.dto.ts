import { IsDateString } from 'class-validator';

export class TagEntity {
  id: number;
  description: string;
  name: string;
  slug: string;
  createdAt: Date;
}
