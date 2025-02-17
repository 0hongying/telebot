import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export function onInstance0() {
  const instance = process.env.NODE_APP_INSTANCE;
  return !instance || instance === '1';
}

@Injectable()
export class TasksService {
  constructor(
    @InjectDataSource()
    private dataSource: DataSource
  ) {}

  @Cron(CronExpression.EVERY_30_MINUTES, { disabled: !onInstance0() })
  async refreshViewCron() {
    let retryCount = 0;
    while (retryCount <= 3) {
      try {
        await this.dataSource.createQueryRunner().query('REFRESH MATERIALIZED VIEW new_character_stats');
      } catch (err) {
        console.error(`Refresh attempt ${retryCount + 1} error:`, err);
      }
      retryCount++;
    }
  }
}
