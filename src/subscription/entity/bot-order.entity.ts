import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { BaseEntity } from '../../entity/base';

export type Status = 'pending' | 'payed' | 'cancel' | 'refund' | 'timeout' | 'fail';
export type Action = 'renew' | 'subscribe' | 'update' | 'refund' | 'upgrade';

@Entity()
export class BotOrder extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: false })
  userId: number;

  @Column({ nullable: false })
  productId: string;

  @Column()
  thirdPartyOrderId: string;

  @Column({ nullable: true })
  purchaseToken: string;

  @Column({ default: 'pending' })
  status: Status;

  @Column()
  action: Action;

  @Column()
  orderNo: string;

  @Column()
  amount: number;

  @Column()
  reason: string;

  @Column({ type: 'text' })
  remark: string;
}
