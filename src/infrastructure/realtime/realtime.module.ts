import { Module } from '@nestjs/common';
import { AuthModule } from '../../modules/auth/auth.module';
import { SocketGateway } from './socket.gateway';
@Module({ imports: [AuthModule], providers: [SocketGateway] })
export class RealtimeModule {}
