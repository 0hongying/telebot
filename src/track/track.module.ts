import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BotEvent } from 'src/track/entity/bot-event.entity';
import { TrackService } from 'src/track/track.service';
import { TrackController } from './track.controller';

@Module({
  imports: [TypeOrmModule.forFeature([BotEvent])],
  providers: [TrackService],
  exports: [TrackService],
  controllers: [TrackController],
})
export class TrackModule {}
