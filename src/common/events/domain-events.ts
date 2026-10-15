import { Injectable, Global, Module } from '@nestjs/common';
import { EventEmitter } from 'node:events';
export interface DomainEvent {
  name: string;
  data: object;
  userIds?: string[];
  roles?: string[];
}
@Injectable()
export class DomainEvents {
  private readonly emitter = new EventEmitter();
  publish(event: DomainEvent) {
    this.emitter.emit('event', event);
  }
  subscribe(listener: (event: DomainEvent) => void) {
    this.emitter.on('event', listener);
    return () => this.emitter.off('event', listener);
  }
}
@Global()
@Module({ providers: [DomainEvents], exports: [DomainEvents] })
export class DomainEventsModule {}
