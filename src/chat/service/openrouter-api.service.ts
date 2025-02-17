import axios, { AxiosRequestConfig } from 'axios';
import { OpenAIInputMessage } from '../types/openai';
import { Injectable } from '@nestjs/common';
import { Helper } from 'src/shared/helper';
import { ChatResult } from 'src/chat/types/chat';
import { ClaudeAPIService } from 'src/chat/service/claude-api.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class OpenrouterAPIService {
  private readonly openrouterKey = this.config.get('OPENROUTER_KEY');

  constructor(
    private readonly config: ConfigService,
    private readonly claudeAPIService: ClaudeAPIService
  ) {}

  async tryCallOpenrouter(originMessages: OpenAIInputMessage[], model: string): Promise<ChatResult> {
    let messages = Helper.replaceWithDefaultSystemPrompt(originMessages);
    try {
      const response = await this.callOpenrouterReturnStream(messages, model);
      return { apiKey: `openrouter-${model}`, response };
    } catch (error) {
      try {
        console.error(`All attempts call openrouter ${model} have failed`);
        return await this.claudeAPIService.tryCallClaudeHaiku(originMessages);
      } catch (error) {
        throw new Error('All attempts in openrouter have failed');
      }
    }
  }

  async callOpenrouterReturnStream(messages: OpenAIInputMessage[], model: string) {
    try {
      const baseUrl = 'https://openrouter.ai/api/v1';
      const authorizationHeader = `Bearer ${this.openrouterKey}`;
      const response = await axios.post(
        `${baseUrl}/chat/completions`,
        { 
          max_tokens: 400,
          stream: true,
          model,
          messages,
          temperature: 1, 
          provider: { order: ['DeepInfra', 'Hyperbolic'] }, 
          allow_fallbacks: false 
        },
        { 
          headers: {
            Authorization: authorizationHeader,
          },
          responseType: 'stream', 
          timeout: 20 * 1000, 
          proxy: false
        },
      );
      if (response.status === 200) {
        console.log(`use openrouter ${model} proxy: success`);
        return response;
      } else {
        console.log(`use openrouter ${model}  not 200: ${response.status}, ${response.data}`);
      }
    } catch (err) {
      console.error(`Error invoking aws openrouter ${model} :`, err);
    }
    throw new Error(`Call openrouter ${model} have failed`);
  }

  async callOpenrouterReturnJson(messages: OpenAIInputMessage[], model: string) {
    const baseUrl = 'https://openrouter.ai/api/v1';
    const authorizationHeader = `Bearer ${this.openrouterKey}`;
    const response = await axios.post(
      `${baseUrl}/chat/completions`,
      {
        model,
        max_tokens: 0,
        stream: false,
        messages,
      },
      {
        headers: {
          Authorization: authorizationHeader,
        },
        responseType: 'json',
        proxy: false,
        timeout: 15 * 1000,
      },
    );
    if (response.status === 200) {
      return response;
    } else {
      console.log(`call openrouter ${model} not 200: ${response.status}, ${response.data}`);
      throw new Error(`call openrouter ${model} have failed`);
    }
  }
}
