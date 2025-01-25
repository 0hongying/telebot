import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubscriptionModule } from 'src/subscription/subscription.module';
import { CharacterModule } from 'src/character/character.module';
import { SharedModule } from 'src/shared/shared.module';
import { BotUser } from 'src/entity/bot-user.entity';
import { Characters } from 'src/character/entity/characters.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Characters, BotUser]), SubscriptionModule, CharacterModule, SharedModule],
  providers: [AdminService],
  exports: [AdminService],
  controllers: [AdminController],
})
export class AdminModule {}
