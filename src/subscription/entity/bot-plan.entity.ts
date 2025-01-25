import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { BaseEntity } from '../../entity/base';

@Entity()
export class BotPlan extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column() //WEEKLY, MONTHLY, YEARLY
  type: string;

  @Column()
  price: number;

  @Column()
  quotaCount: number;
}
