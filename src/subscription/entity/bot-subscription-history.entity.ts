import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { BaseEntity } from '../../entity/base';

@Entity()
export class BotSubscriptionHistory extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @Column({ type: 'int', nullable: true })
  oldPlanId: number | null;

  @Column({ type: 'int', nullable: true })
  newPlanId: number | null;

  @Column({ type: 'timestamptz' })
  changeTime: Date;

  @Column({ type: 'varchar', nullable: true })
  reason: string | null;

  @Column({ nullable: true })
  paymentChannelId: number;

  @Column({ nullable: true })
  channelType: string;

  @Column({ nullable: true })
  stripeCustomerId: string;

  @Column({ nullable: true })
  thirdPartySubscriptionId: string;

  constructor(
    userId: number,
    oldPlanId: number | null,
    newPlanId: number | null,
    changeTime: Date,
    reason: string | null,
    paymentChannelId?: number,
    channelType?: string,
    stripeCustomerId?: string,
    thirdPartySubscriptionId?: string,
  ) {
    super();
    this.userId = userId;
    this.oldPlanId = oldPlanId;
    this.newPlanId = newPlanId;
    this.changeTime = changeTime;
    this.reason = reason;
    this.paymentChannelId = paymentChannelId!;
    this.channelType = channelType!;
    this.stripeCustomerId = stripeCustomerId!;
    this.thirdPartySubscriptionId = thirdPartySubscriptionId!;
  }
}
