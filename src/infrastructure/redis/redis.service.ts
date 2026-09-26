import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis;
  constructor(private readonly config: ConfigService) {}
  async onModuleInit() {
    this.client = new Redis({
      host: this.config.get('REDIS_HOST', '127.0.0.1'),
      port: this.config.get('REDIS_PORT', 6379),
      password: this.config.get('REDIS_PASSWORD') || undefined,
      keyPrefix: this.config.get('REDIS_KEY_PREFIX', ''),
      lazyConnect: true,
      enableOfflineQueue: false,
      connectTimeout: 2000,
      maxRetriesPerRequest: 1,
      retryStrategy: (attempts) => Math.min(attempts * 200, 2000),
    });
    this.client.on('error', () => {});
    try {
      await this.client.connect();
    } catch {
      /* Authentication fails closed. */
    }
  }
  async onModuleDestroy() {
    this.client?.disconnect();
  }
  getClient() {
    return this.client;
  }
  private async call<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch {
      throw new ServiceUnavailableException('SESSION_STORE_UNAVAILABLE');
    }
  }
  get(key: string) {
    return this.call(() => this.client.get(key));
  }
  set(key: string, value: string, ttl = 604800) {
    return this.call(() => this.client.set(key, value, 'EX', ttl));
  }
  del(key: string) {
    return this.call(() => this.client.del(key));
  }
  ping() {
    return this.call(() => this.client.ping());
  }
  epoch(userId: string, candidate: string) {
    return this.call(async () => {
      await this.client.set(`auth:user:${userId}`, candidate, 'NX');
      return (await this.client.get(`auth:user:${userId}`))!;
    });
  }
  rotate(key: string, expected: string, next: string) {
    return this.call(
      async () =>
        Number(
          await this.client.eval(
            "if redis.call('GET',KEYS[1]) ~= ARGV[1] then return 0 end redis.call('SET',KEYS[1],ARGV[2],'EX',ARGV[3]) return 1",
            1,
            key,
            expected,
            next,
            604800,
          ),
        ) === 1,
    );
  }
  async revokeUser(userId: string) {
    await this.del(`auth:user:${userId}`);
  }
}
