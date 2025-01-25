import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { BaseEntity } from '../../entity/base';

export type STATUS = 'ACTIVE' | 'EXPIRED' | 'END';
@Entity()
export class BotSubscription extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @Column()
  planId: number;

  @Column()
  status: STATUS;

  @Column({ type: 'timestamptz' })
  startTime: Date;

  @Column({ type: 'timestamptz' })
  endTime: Date;

  @Column()
  autoRenew: boolean;

  @Column({ nullable: true })
  thirdPartySubscriptionId: string;

  @Column({ nullable: true })
  paymentChannelId: number;

  @Column({ nullable: true })
  channelType: string;

  @Column({ nullable: true })
  stripeCustomerId: string;

  constructor(
    userId: number,
    planId: number,
    status: STATUS,
    startTime: Date,
    endTime: Date,
    paymentChannelId?: number,
    channelType?: string,
    stripeCustomerId?: string,
    thirdPartySubscriptionId?: string,
  ) {
    super();
    this.userId = userId;
    this.planId = planId;
    this.status = status;
    this.startTime = startTime;
    this.endTime = endTime;
    this.autoRenew = true;
    this.paymentChannelId = paymentChannelId!;
    this.channelType = channelType!;
    this.stripeCustomerId = stripeCustomerId!;
    this.thirdPartySubscriptionId = thirdPartySubscriptionId!;
  }
}
