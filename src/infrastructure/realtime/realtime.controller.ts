import { Controller, Sse, MessageEvent } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Observable, interval, map, merge, filter } from 'rxjs';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { Actor } from '../../common/types/actor';
import { DomainEvents, DomainEvent } from '../../common/events/domain-events';

@Controller('realtime')
@ApiTags('Realtime')
@ApiBearerAuth()
export class RealtimeController {
  constructor(private readonly events: DomainEvents) {}

  @Sse('sse')
  @ApiOperation({
    summary: 'Subscribe to real-time events via Server-Sent Events (SSE)',
  })
  sse(@CurrentUser() actor: Actor): Observable<MessageEvent> {
    const eventStream = new Observable<DomainEvent>((subscriber) => {
      const unsubscribe = this.events.subscribe((event) => {
        subscriber.next(event);
      });
      return () => unsubscribe();
    }).pipe(
      filter((event) => {
        const forUser = event.userIds?.includes(actor.userId);
        const forRole = event.roles?.includes(actor.role);
        const isBroadcast = !event.userIds?.length && !event.roles?.length;
        return Boolean(forUser || forRole || isBroadcast);
      }),
      map((event) => ({
        type: event.name,
        data: event.data,
      })),
    );

    const heartbeat = interval(25000).pipe(
      map(() => ({
        type: 'ping',
        data: { timestamp: new Date().toISOString() },
      })),
    );

    return merge(eventStream, heartbeat);
  }
}
