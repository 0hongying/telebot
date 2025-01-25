import { ViewEntity, ViewColumn } from 'typeorm';

@ViewEntity({
  name: 'character_stats',
})
export class CharacterStats {
  @ViewColumn()
  characterId: string;

  @ViewColumn()
  totalChat: number;

  @ViewColumn()
  totalMessage: number;
}