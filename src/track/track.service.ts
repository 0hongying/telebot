import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BotEvent } from 'src/track/entity/bot-event.entity';
import { CreateBotEventDto } from './track.dto';

@Injectable()
export class TrackService {
  constructor(
    @InjectRepository(BotEvent)
    private readonly botEventRepository: Repository<BotEvent>,
  ) {}

  async addTelegramEvent(payload: CreateBotEventDto) {
    const { userId, eventName, referrerInfo } = payload;
    await this.botEventRepository.save({ userId, eventName, referrerInfo });
  }
}
