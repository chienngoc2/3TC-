# Kế hoạch triển khai backend trên AWS EC2 — Redis dành riêng cho authentication

Ngày cập nhật: 27/09/2026. Trạng thái: kế hoạch triển khai; chưa xác nhận hạ tầng đã được tạo hoặc deployment đã thành công.

## 1. Kiến trúc và phạm vi

Mô hình: một AWS EC2 instance chạy NestJS và Redis 7 bằng Docker Compose; Nginx trên host cung cấp HTTPS và reverse proxy; Supabase PostgreSQL lưu dữ liệu nghiệp vụ.

Redis chỉ phục vụ authentication: hash refresh token, session, user epoch, rotation Lua, logout và thu hồi phiên. Không dùng Redis làm hàng đợi, khóa nghiệp vụ hoặc cache dùng eviction tùy ý. Khóa nghiệp vụ nằm trong PostgreSQL.

BullMQ và @nestjs/bullmq được loại bỏ vì code phase 1–5 chưa có queue, producer hay worker. Không triển khai queue mới để thay thế ở lượt chuẩn hóa này.

Phase 1–5 đã implement REST/realtime. AI/RAG/SSE, Cron, FCM và đóng gói production chưa được triển khai. Những ví dụ Docker/Nginx dưới đây là cấu hình mục tiêu, không phải artifact đã build/kiểm chứng trên EC2.

EC2 phù hợp với tiến trình thường trú và không tự sleep khi thiếu request. Một instance vẫn là điểm lỗi đơn; restart, bảo trì và deploy có thể làm gián đoạn. Không cam kết uptime tuyệt đối hoặc bảo toàn 100% hoạt động chỉ bằng đổi hosting.

## 2. Tác vụ nền sau khi bỏ BullMQ

Khi triển khai phase 6, dùng @nestjs/schedule trong backend, timezone Asia/HoChiMinh:

- Hết hạn hợp đồng: cập nhật ACTIVE có end_date < ngày nghiệp vụ hiện tại, giữ quota lịch sử; thao tác idempotent, chạy bù khi khởi động. Không cấp quyền chỉ dựa vào status: các truy vấn nghiệp vụ hiện tự xét ngày hiệu lực.
- Nhắc lịch: truy vấn lịch nhóm/PT đến hạn, batch có giới hạn, ghi kết quả gửi và chống trùng theo booking/lần nhắc. Quét việc đến hạn chưa xử lý để chạy bù, không chỉ dùng cửa sổ 10 phút dễ bỏ sót.
- Nếu yêu cầu thông báo bền vững/retry: thêm model PostgreSQL lưu trạng thái, attempts, nextAttemptAt, khóa nhận việc và chính sách retry có giới hạn. Đây là thiết kế tương lai, chưa có migration hoặc worker.
- Nếu mở rộng nhiều instance: bổ sung khóa/lease và cơ chế truyền sự kiện giữa các tiến trình. Scheduler và event trong bộ nhớ không tự bảo đảm xử lý đúng một lần hoặc không mất thông báo.

AI SSE có thể xử lý trực tiếp theo request, không mặc nhiên cần queue. Chỉ cân nhắc lại queue khi khối lượng/retry/worker riêng thực sự đòi hỏi.

## 3. EC2, ngân sách và credit

Chọn region gần Supabase và người dùng, chốt region trước khi lập giá. Với tải đồ án có thể bắt đầu t4g.small (ARM64, 2 vCPU/2 GiB) hoặc t3.small (AMD64); kiểm tra image Prisma/bcrypt trên kiến trúc đã chọn. EBS gp3 khoảng 25 GiB, một public IPv4 ổn định cho DNS.

Công thức dự toán 50 ngày (7 tuần chính xác là 49 ngày):

| Hạng mục | Công thức |
| --- | --- |
| EC2 | 1.200 giờ × đơn giá Linux On-Demand tại region đã chọn |
| EBS | 25 GiB × giá gp3/tháng × hệ số thời gian, cộng IOPS/throughput bổ sung nếu có |
| IPv4 | 1.200 × $0.005 = $6, trước credit/thuế |
| Outbound | Theo lưu lượng và allowance thực tế của tài khoản |
| Khác | CPU surplus, snapshot, logs/alarms, thuế và tài nguyên ngoài kế hoạch |

Không dùng $30.84 làm giá cam kết: chưa xác minh region, dịch vụ đủ điều kiện credit hoặc khối lượng thực tế. Kiểm tra số credit còn lại, ngày hết hạn và phạm vi áp dụng trong tài khoản giáo dục; không mặc định mọi tài khoản đều được cấp $200.

T3/T4g Unlimited có thể tính phí CPU surplus; theo dõi CPUCreditBalance/CPUSurplusCreditsCharged hoặc chọn Standard và chấp nhận giới hạn khi hết credit. AWS có allowance outbound Internet 100 GB/tháng cộng gộp theo điều kiện áp dụng; không tự tính phí toàn bộ 15 GB nếu allowance chưa dùng hết.

Không cần ALB, NAT Gateway hoặc ElastiCache cho một instance này. Public IPv4 đang dùng và nhàn rỗi đều có giá cơ bản $0.005/giờ; giải phóng địa chỉ không cần thiết. STOP EC2 không loại bỏ phí EBS/IPv4 còn giữ.

Tạo Monthly Cost Budget $40 với cảnh báo actual 50%/80%, forecast 100%; kiểm tra tùy chọn bao gồm credit để theo dõi gross cost thay vì chỉ số tiền phải trả sau credit. Theo dõi cả tổng kỳ 50 ngày và credit còn lại. Email budget không phải hard cap hoặc tự động tắt tài nguyên.

CloudWatch EstimatedCharges: bật Billing Alerts, dùng us-east-1 (N. Virginia), USD, ngưỡng $35 và SNS email đã xác nhận subscription. Dữ liệu billing có độ trễ; không dùng giới hạn $1.50 sau 48 giờ làm tiêu chí pass/fail deployment.

Nguồn: [EC2 pricing](https://aws.amazon.com/ec2/pricing/on-demand/), [IPv4 pricing](https://aws.amazon.com/vpc/pricing/), [Billing alarms](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/monitor_estimated_charges_with_cloudwatch.html).

## 4. Host và mạng

Chọn Ubuntu 24.04 LTS đúng kiến trúc EC2. Cài Docker Engine và Compose V2 theo [hướng dẫn Docker](https://docs.docker.com/engine/install/ubuntu/), Nginx và Certbot/plugin Nginx theo hướng dẫn distro. Dùng docker compose, không dựa vào docker-compose V1.

Security Group: mở 80/443 cho người dùng; SSH chỉ từ IP quản trị hoặc dùng SSM với quyền phù hợp. Không mở 3000/6379 ra Internet. Bật IMDSv2, dùng IAM tối thiểu và mã hóa EBS. User thuộc docker group có quyền gần tương đương root; chỉ cấp cho người vận hành.

Khuyến nghị build image trong CI để tránh tranh RAM/CPU với ứng dụng. Swap 2 GiB là phương án hỗ trợ nếu build trên máy 2 GiB, không bắt buộc hoặc bảo đảm chống OOM; kiểm tra swap/fstab trước khi thêm để tránh cấu hình trùng. Theo dõi RAM, CPU và dung lượng đĩa.

## 5. Docker Compose mục tiêu

File triển khai production riêng để không làm thay đổi Redis local đang dùng. Dockerfile dưới đây nằm trong backend, context là backend.

```yaml
services:
  redis:
    image: redis:7-alpine # Cố định tag patch/digest đã kiểm chứng trước deployment
    restart: unless-stopped
    command: [redis-server, --appendonly, 'yes', --appendfsync, everysec, --maxmemory, 256mb, --maxmemory-policy, noeviction]
    volumes:
      - redis_auth_data:/data
    networks: [backend_net]
    healthcheck:
      test: [CMD, redis-cli, ping]
      interval: 10s
      timeout: 5s
      retries: 3
    logging:
      driver: json-file
      options: {max-size: 10m, max-file: '3'}
  backend:
    build: {context: ., dockerfile: Dockerfile}
    restart: unless-stopped
    env_file: [.env.production]
    environment:
      REDIS_HOST: redis
      REDIS_PORT: 6379
    depends_on:
      redis: {condition: service_healthy}
    ports: ['127.0.0.1:3000:3000']
    networks: [backend_net]
    init: true
    stop_grace_period: 30s
    healthcheck:
      test: [CMD, node, -e, "fetch('http://127.0.0.1:3000/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s
    logging:
      driver: json-file
      options: {max-size: 10m, max-file: '3'}
networks:
  backend_net: {driver: bridge}
volumes:
  redis_auth_data:
```

Redis không publish port lên host. Persistence AOF + volume giúp giữ session khi restart; everysec vẫn có cửa sổ mất dữ liệu khoảng một giây khi crash. Noeviction giữ key nhưng từ chối ghi khi đầy: giám sát used_memory và lỗi SESSION_STORE_UNAVAILABLE, dự trù overhead ngoài maxmemory. Bảo vệ volume/backup, không xóa bằng compose down -v trong cập nhật bình thường.

Redis là session store có thẩm quyền, không phải bản sao cache. Nếu chủ động chấp nhận mất phiên sau restart phải ghi rõ chính sách; cấu hình mặc định này ưu tiên giữ phiên. Docker healthcheck không tự restart process bị unhealthy; giám sát cần có cảnh báo và quy trình phục hồi.

Nguồn: [Redis persistence](https://redis.io/docs/latest/operate/oss_and_stack/management/persistence/), [Eviction](https://redis.io/docs/latest/develop/reference/eviction/).

## 6. Dockerfile và build context mục tiêu

Node 20 đã EOL tại ngày tài liệu. Dùng Node 24 LTS và cố định patch/digest được kiểm chứng trong CI. Debian slim giảm biến số musl/native libraries khi kiểm tra Prisma/bcrypt.

```dockerfile
FROM node:24-bookworm-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --include=dev
COPY . .
RUN npm run prisma:generate && npm run build
RUN npm prune --omit=dev

FROM node:24-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/package.json ./package.json
USER node
EXPOSE 3000
CMD ["node", "dist/main"]
```

.dockerignore mục tiêu:

```text
node_modules
dist
.git
.env
.env.*
.tmp
coverage
*.log
```

Không đưa secrets vào build args/image. Kiểm tra npm ci, Prisma generation, native binaries và khởi động image trên linux/arm64 nếu dùng t4g; amd64 nếu dùng t3. Runtime đã prune không có Prisma CLI: migration cần job/image công cụ riêng chứa dev dependencies và scripts/SQL, không chạy CLI trong runner này.

## 7. Biến môi trường

Compose thống nhất dùng .env.production; đặt ngoài Git, chmod 600 trên host. Mỗi môi trường sinh JWT secrets độc lập bằng node:crypto; không dùng giá trị mẫu làm secret thật.

```dotenv
NODE_ENV=production
PORT=3000
CORS_ORIGINS=https://admin.example.com,https://member.example.com
JWT_ACCESS_SECRET=<unique-random-secret>
JWT_REFRESH_SECRET=<another-unique-random-secret>
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
DATABASE_URL=postgresql://<user>.<project>:<encoded-password>@<session-pooler-host>:5432/postgres?sslmode=require&connection_limit=10&pool_timeout=20
DIRECT_URL=postgresql://<migration-user>:<encoded-password>@db.<project>.supabase.co:5432/postgres?sslmode=require
REDIS_HOST=redis
REDIS_PORT=6379
```

REDIS_TTL được bỏ: code hiện đặt session/rotation TTL 604800 giây, không đọc biến này. Chỉ khai báo GEMINI/FCM khi module tương ứng thực sự được triển khai, không mô tả chúng là yêu cầu của phase 1–5.

Runtime dùng Session Pooler cổng 5432; đây không phải Direct Connection. Direct host thường cần IPv6: kiểm tra đường mạng EC2; nếu không khả dụng, dùng Session Pooler được xác nhận phù hợp cho migration. Connection limit là mỗi process, tính cả migration và công cụ quản trị. Xác minh chính sách hoạt động/backup của Supabase theo gói đang dùng để phù hợp mục tiêu vận hành liên tục.

Nguồn: [Supabase connections](https://supabase.com/docs/guides/database/connecting-to-postgres).

## 8. Nginx, TLS và realtime

Cài Nginx/Certbot trước; trỏ DNS tới IP ổn định, mở 80/443, kiểm tra HTTP trước khi xin TLS. Map dưới đây đặt trong http context (ví dụ conf.d), server đặt trong sites-available:

```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    '' close;
}
server {
    listen 80;
    server_name api.example.com;
    client_max_body_size 1m;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }
    location /socket.io/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_read_timeout 120s;
    }
}
```

Socket.IO namespace /realtime không thay thế transport path /socket.io/. Client dùng namespace và handshake auth.token; kiểm tra cả polling và WebSocket upgrade. Bổ sung proxy headers tương ứng cho location Socket.IO nếu ứng dụng cần thông tin client.

Kích hoạt site, chạy nginx -t, reload rồi xin certbot --nginx với domain/email thực tế; kiểm tra certbot renew --dry-run và renewal timer. Với AI SSE tương lai, thêm location đúng route, proxy_buffering off, timeout và heartbeat thích hợp; không đặt timeout một ngày cho toàn bộ API và không đưa SSE chưa có vào checklist hiện tại.

Giữ validation/filter/interceptor, CORS allowlist và shutdown hooks của backend. Không thay main.ts bằng ví dụ rút gọn. Realtime cần reconnect phía client sau restart; event hiện chỉ phát trong tiến trình sau transaction commit, chưa có outbox hoặc adapter nhiều instance.

## 9. Migration, deployment và rollback

1. Chạy npm ci và npm run check trên checkout sạch; ghi commit/image tag cần phát hành.
2. Review migration history với DB hiện có, backup theo chính sách môi trường. Không mặc định migrate deploy sẽ xử lý được lịch sử cũ chưa baseline.
3. Dùng môi trường công cụ migration chứa Prisma CLI; chạy prisma migrate deploy chỉ sau khi history đã được xác nhận/baseline đúng. Không dùng db:setup production vì có db push và seed.
4. Áp dụng SQL V5 bằng npm run db:constraints và xác minh npm run db:verify:v5 trong môi trường có scripts, SQL và DIRECT_URL cần thiết. Kiểm tra thủ tục/trigger/RLS/constraint thực tế, không chỉ Prisma schema.
5. Kiểm tra docker compose --env-file .env.production -f <production-compose> config --quiet để tránh in secret; build/pull image rồi khởi động Redis/backend, kiểm tra health và Nginx.
6. Lưu tag image trước đó để rollback code; đánh giá tương thích schema trước rollback. Thay một backend container có thể gây gián đoạn ngắn, không tuyên bố zero downtime.
7. Theo dõi lỗi API, session store, RAM/CPU/disk, log growth và billing. Kết thúc đồ án: backup cần thiết, terminate tài nguyên, giải phóng EIP và xóa storage không cần để dừng phí.

## 10. Checklist xác nhận

### Backend phase 1–5

- [ ] Image build/boot thành công trên kiến trúc EC2 đã chọn; không có secret trong context/image.
- [ ] /api/v1/health qua HTTPS báo DB và Redis UP; không trả ok vô điều kiện.
- [ ] /api/v1/analytics/system-metrics với ADMIN trả uptime/CPU/RAM/Node version; không kỳ vọng activeConnections vì code chưa cung cấp.
- [ ] Login tạo auth:session:<sid> (hash, TTL 7 ngày) và auth:user:<userId> (epoch, không TTL); không dùng key refresh_token:<user_id>.
- [ ] Refresh, replay, logout, đổi mật khẩu/khóa tài khoản và Socket.IO revalidation hoạt động.
- [ ] Restart Redis/backend giữ session theo cấu hình persistence; không publish Redis/3000 công khai.
- [ ] Migration/SQL V5 được xác minh; kiểm tra RLS với quyền phù hợp, không coi test owner DB là kiểm toán RLS đầy đủ.
- [ ] Kiểm tra booking/quota, hóa đơn, cấp/trả tủ và realtime sau deployment.
- [ ] TLS renewal, reconnect, log rotation, giám sát và rollback được kiểm chứng.
- [ ] Credit, budget/SNS và tài nguyên tính phí được kiểm tra thực tế.

### Phase 6 tương lai

- [ ] Scheduler timezone, chạy bù, chống trùng và ngày hết hạn đúng nghiệp vụ.
- [ ] FCM retry/lưu kết quả được kiểm chứng nếu triển khai.
- [ ] AI/RAG/SSE được kiểm chứng sau khi có module.

Không có tiêu chí BullMQ completed/failed jobs. Các mục chưa đánh dấu không phải bằng chứng đã đạt.
