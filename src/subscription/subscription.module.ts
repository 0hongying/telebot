import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BotMessageQuota } from 'src/subscription/entity/bot-message-quota.entity';
import { BotPlan } from 'src/subscription/entity/bot-plan.entity';
import { BotSubscription } from 'src/subscription/entity/bot-subscription.entity';
import { SubscriptionService } from './subscription.service';
import { MessageQuotaDataService } from './service/message-quota-data.service';
import { SubscriptionDataService } from './service/subscription-data.service';
import { EvonetService } from './evonet-pay/evonet.service';
import { BotUser } from 'src/entity/bot-user.entity';
import { BotOrder } from 'src/subscription/entity/bot-order.entity';
import { BotEvonetToken } from 'src/subscription/entity/bot-evonet-token.entity';
import { SubscriptionWebhookHandleService } from './subscription-webhook-handle.service';
import { BotSubscriptionHistory } from 'src/subscription/entity/bot-subscription-history.entity';
import { SubscriptionCommonService } from './subscription-common.service';
import { SubscriptionController } from './subscription.controller';
import { EvonetController } from './evonet-pay/evonet.controller';
import { TrackModule } from 'src/track/track.module';
import { BotChat } from 'src/chat/entity/bot-chat.entity';
import { InvitationModule } from 'src/invitation/invitation.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([BotSubscription, BotSubscriptionHistory, BotPlan, BotMessageQuota, BotUser, BotOrder, BotEvonetToken, BotChat]),
    TrackModule,
    InvitationModule,
  ],
  exports: [
    SubscriptionService,
    MessageQuotaDataService,
    SubscriptionCommonService,
    SubscriptionDataService,
    SubscriptionWebhookHandleService,
    EvonetService,
  ],
  providers: [
    SubscriptionService,
    MessageQuotaDataService,
    SubscriptionCommonService,
    SubscriptionDataService,
    SubscriptionWebhookHandleService,
    EvonetService,
  ],
  controllers: [SubscriptionController, EvonetController],
})
export class SubscriptionModule {}
