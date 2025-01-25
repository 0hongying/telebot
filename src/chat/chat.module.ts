import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClaudeAPIService } from 'src/chat/service/claude-api.service';
import { AmethystAPIService } from 'src/chat/service/amethyst-api.service';
import { OpenrouterAPIService } from 'src/chat/service/openrouter-api.service';
import { Characters } from 'src/character/entity/characters.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Characters])],
  providers: [ClaudeAPIService, AmethystAPIService, OpenrouterAPIService],
  exports: [ClaudeAPIService, AmethystAPIService, OpenrouterAPIService],
})
export class ChatModule {}
