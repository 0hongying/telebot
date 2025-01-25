import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BotInvitation } from 'src/invitation/entity/bot-invitation.entity';
import { BotUser } from 'src/entity/bot-user.entity';
import { BotMessageQuota } from 'src/subscription/entity/bot-message-quota.entity';
import { BotMessageQuotaReward } from 'src/subscription/entity/bot-message-quota-reward.entity';
import { InvitationService } from './invitation.service';
import { BotSubscription } from 'src/subscription/entity/bot-subscription.entity';
import { TrackModule } from 'src/track/track.module';

@Module({
  imports: [TypeOrmModule.forFeature([BotInvitation, BotUser, BotMessageQuota, BotMessageQuotaReward, BotSubscription]), TrackModule],
  exports: [InvitationService],
  providers: [InvitationService],
})
export class InvitationModule {}
