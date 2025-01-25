import { Controller, Post, Body } from '@nestjs/common';
import { msgSuccess } from 'src/shared/utils';
import { TrackService } from 'src/track/track.service';
import { CreateBotEventDto } from './track.dto';

@Controller('track')
export class TrackController {
  constructor(private readonly trackService: TrackService) {}

  @Post('/event')
  async addUserEvent(@Body() payload: CreateBotEventDto) {
    await this.trackService.addTelegramEvent(payload);
    return msgSuccess({});
  }
}
