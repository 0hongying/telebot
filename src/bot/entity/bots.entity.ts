import { BaseEntity } from 'src/entity/base';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Bots extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  type: string;

  @Column()
  name: string;

  @Column()
  token: string;

  @Column({ default: false })
  isChannel: boolean;
}
