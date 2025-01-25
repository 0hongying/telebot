import { Body, Controller, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { BotService } from './bot.service';
import { Request, Response } from 'express';
import { CreateBotChatDto } from './bot.dto';

@Controller('bot')
export class BotController {
  constructor(private readonly botService: BotService) {}

  @Post('channel/completion')
  @HttpCode(200)
  async channelBotCompletion(@Req() req: Request, @Res() res: Response) {
    if (!this.botService.isAccessAllowed(req.body)) {
      res.sendStatus(HttpStatus.OK);
      return;
    }
    await this.botService.channelBotCompletion(req);
    res.sendStatus(HttpStatus.OK);
  }

  @Post('chat/completion')
  @HttpCode(200)
  async chatBotCompletion(@Req() req: Request, @Res() res: Response) {
    if (!this.botService.isAccessAllowed(req.body)) {
      res.sendStatus(HttpStatus.OK);
      return;
    }
    await this.botService.chatBotCompletion(req);
    res.sendStatus(HttpStatus.OK);
  }

  @Post('chat')
  @HttpCode(200)
  async createTelegramChat(@Body() payload: CreateBotChatDto) {
    console.log(`click chat with ${JSON.stringify(payload)}`);
    await this.botService.sendCharacterCardFromWebsite(payload);
  }
}
