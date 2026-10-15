import { OnModuleDestroy } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayInit,
  SubscribeMessage,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Namespace, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService, SessionPayload } from '../../modules/auth/auth.service';
import { DomainEvents, DomainEvent } from '../../common/events/domain-events';
import { Public } from '../../common/decorators/public.decorator';
@WebSocketGateway({
  namespace: '/realtime',
  cors: {
    origin: (origin, callback) => {
      const allowed = (process.env.CORS_ORIGINS ?? 'http://localhost:3001')
        .split(',')
        .map((value) => value.trim());
      callback(null, !origin || allowed.includes(origin));
    },
  },
})
export class SocketGateway
  implements OnGatewayConnection, OnGatewayInit, OnModuleDestroy
{
  @WebSocketServer() server: Namespace;
  private unsubscribe?: () => void;
  constructor(
    private readonly auth: AuthService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly events: DomainEvents,
  ) {}
  afterInit(server: Namespace) {
    this.server = server;
    server.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth?.token;
        if (typeof token !== 'string') throw new Error('TOKEN_REQUIRED');
        const payload = await this.jwt.verifyAsync<SessionPayload>(token, {
          secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        });
        socket.data.actor = await this.auth.validateAccess(payload);
        socket.data.payload = payload;
        next();
      } catch {
        next(new Error('UNAUTHORIZED'));
      }
    });
    this.unsubscribe = this.events.subscribe((event) => {
      void this.broadcast(event);
    });
  }
  async handleConnection(socket: Socket) {
    const actor = socket.data.actor;
    await socket.join(`user:${actor.userId}`);
    if (['CENTER_MANAGER', 'RECEPTIONIST', 'COACH'].includes(actor.role))
      await socket.join(`role:${actor.role}`);
  }
  private async broadcast(event: DomainEvent) {
    const rooms = [
      ...(event.userIds ?? []).map((id) => `user:${id}`),
      ...(event.roles ?? []).map((role) => `role:${role}`),
    ];
    if (!rooms.length) return;
    // Revalidate every recipient: logout, disabled accounts and token expiry take effect on live connections.
    const recipients = new Map<string, Socket>();
    for (const room of rooms)
      for (const id of this.server.adapter.rooms.get(room) ?? []) {
        const socket = this.server.sockets.get(id);
        if (socket) recipients.set(id, socket);
      }
    await Promise.all(
      [...recipients.values()].map(async (socket) => {
        try {
          const payload = socket.data.payload as SessionPayload & {
            exp: number;
          };
          if (payload.exp * 1000 <= Date.now()) throw new Error('EXPIRED');
          const actor = await this.auth.validateAccess(payload);
          const authorized =
            event.userIds?.includes(actor.userId) ||
            event.roles?.includes(actor.role);
          if (authorized) socket.emit(event.name, event.data);
        } catch {
          socket.disconnect(true);
        }
      }),
    );
  }
  // The gateway authenticates this transport; HTTP Passport must not parse Socket.IO packets.
  @Public()
  @SubscribeMessage('ping')
  ping(@ConnectedSocket() socket: Socket) {
    if ((socket.data.payload.exp as number) * 1000 <= Date.now()) {
      socket.disconnect(true);
      return;
    }
    return this.auth
      .validateAccess(socket.data.payload)
      .then(() => ({
        event: 'pong',
        data: { timestamp: new Date().toISOString() },
      }))
      .catch(() => {
        socket.disconnect(true);
      });
  }
  onModuleDestroy() {
    this.unsubscribe?.();
  }
}
