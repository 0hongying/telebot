import { BaseEntity } from 'src/entity/base';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class BotEvonetToken extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @Column()
  token: string;
}
