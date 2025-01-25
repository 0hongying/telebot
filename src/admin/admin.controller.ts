import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { msgFail, msgSuccess } from 'src/shared/utils';
import { AdminService } from './admin.service';
import { AdminGuard, AdminKey } from 'src/auth/auth.guard';
import { ssKey } from 'src/shared/const';
import { CacheManagerService } from 'src/shared/cache-manager.service';
import { CharacterListCacheService } from 'src/character/character-list-cache.service';
import { SubscriptionWebhookHandleService } from 'src/subscription/subscription-webhook-handle.service';
import { SubscriptionDataService } from 'src/subscription/service/subscription-data.service';

@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly cacheManagerService: CacheManagerService,
    private readonly characterListCacheService: CharacterListCacheService,
    private readonly subscriptionWebhookHandleService: SubscriptionWebhookHandleService,
    private readonly subscriptionDataService: SubscriptionDataService,
  ) {}

  @AdminKey(ssKey)
  @UseGuards(AdminGuard)
  @Post('push-message')
  async pushUserMessage(@Body() body: { userIds: number[]; message: string }) {
    const data = await this.adminService.pushUserMessage(body.userIds, body.message);
    return msgSuccess({ data });
  }

  @AdminKey(ssKey)
  @UseGuards(AdminGuard)
  @Post('clear-cache')
  async clearCacheManagerByKey(@Body() body: { key: string }) {
    const data = await this.cacheManagerService.clearCachePrefix(body.key);
    return msgSuccess({ data });
  }

  @AdminKey(ssKey)
  @UseGuards(AdminGuard)
  @Post('character/cache/refresh')
  async refreshCharactersCache() {
    await this.characterListCacheService.initAllCache();
    return msgSuccess({});
  }

  @AdminKey(ssKey)
  @UseGuards(AdminGuard)
  @Post('create-new-subscription')
  async manualCreateNewSubscription(@Body() jsonData: any): Promise<any> {
    if (!jsonData.planId || !jsonData.messageQuotaCount || jsonData.messageQuotaCount < 0 || !jsonData.userId) {
      return msgFail({});
    }
    const existSubscription = await this.subscriptionDataService.findActiveSubscription(jsonData.userId);
    if (existSubscription) {
      return msgFail({});
    }
    await this.subscriptionWebhookHandleService.handleSuscriptionCreated(
      jsonData.userId,
      jsonData.planId,
      undefined,
      undefined,
      jsonData.messageQuotaCount,
    );
    return msgSuccess({});
  }
}
