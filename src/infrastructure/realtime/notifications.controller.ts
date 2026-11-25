import { Controller, Get, Param, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { Actor } from '../../common/types/actor';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@ApiTags('Notifications')
@ApiBearerAuth()
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Get persisted & recent in-app notifications for current user' })
  list(@CurrentUser() actor: Actor) {
    return this.service.listForActor(actor);
  }

  @Put('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read for current user' })
  markAllRead(@CurrentUser() actor: Actor) {
    return this.service.markAllRead(actor);
  }

  @Put(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  markRead(@Param('id') id: string, @CurrentUser() actor: Actor) {
    return this.service.markRead(id, actor);
  }
}
