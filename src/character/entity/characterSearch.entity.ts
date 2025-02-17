import { ViewEntity, ViewColumn } from 'typeorm';

@ViewEntity({
  name: 'character_search',
})
export class CharacterSearch {
  @ViewColumn()
  avatar: string;

  @ViewColumn()
  createdAt: string;

  @ViewColumn()
  creatorId: string;

  @ViewColumn()
  description: string;

  @ViewColumn()
  exampleDialogs: string;

  @ViewColumn()
  firstMessage: string;

  @ViewColumn()
  id: string;

  @ViewColumn()
  isPublic: boolean;

  @ViewColumn()
  name: string;

  @ViewColumn()
  personality: string;

  @ViewColumn()
  scenario: string;

  @ViewColumn()
  tagIds: number[];

  @ViewColumn()
  totalChat: number;

  @ViewColumn()
  totalMessage: number;

  @ViewColumn()
  updatedAt: string;

  @ViewColumn()
  deletedAt: string;

  @ViewColumn()
  introduction: any;

  @ViewColumn()
  genderId: number;
}