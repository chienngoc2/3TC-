# CHIẾN LƯỢC TRIỂN KHAI BACKEND NESTJS TRÊN RENDER.COM
### HỆ THỐNG QUẢN LÝ TRUNG TÂM THỂ THAO ĐA MÔN (GYM / BOXING / YOGA / DANCING)

---

## 1. TỔNG QUAN CHUYỂN DỊCH HẠ TẦNG (TỪ VERCEL SANG RENDER.COM)

### 1.1. Bối cảnh & Lý do thay đổi
Ban đầu, hệ thống dự kiến đưa Backend NestJS lên **Vercel Serverless Functions**. Tuy nhiên, qua thẩm định kỹ thuật chuyên sâu, mô hình Serverless bộc lộ hàng loạt xung đột kiến trúc đối với một framework dạng long-running monolith như NestJS:
1. **Nghẽn kết nối Database (Prisma Exhaustion):** Mỗi function invocation có thể tạo connection mới tới PostgreSQL; dưới tải đột biến, số connection vượt ngưỡng cho phép của Supabase. Việc phụ thuộc vào Supabase Transaction Pooler (Port 6543) lại gây hạn chế với các câu lệnh prepared statements phức tạp.
2. **Hạn chế Streaming SSE & Timeout:** Vercel Function giới hạn thời gian thực thi (mặc định ngắn trên bản cấu hình cũ, phụ thuộc `maxDuration`), gây rủi ro ngắt stream AI Assistant giữa chừng.
3. **Giới hạn Cron Jobs gói Hobby:** Vercel Cron chỉ hỗ trợ chạy tối thiểu 1 lần/ngày, hoàn toàn không đáp ứng được các tác vụ quét độ phân giải phút (như nhắc lịch tập trước 2 tiếng).
4. **Vòng đời Stateless đối nghịch với State:** Việc re-bootstrap DI container hoặc duy trì session in-memory không khả thi trên kiến trúc ephemeral.

### 1.2. Lựa chọn Render.com (Web Service PaaS)
Render.com cung cấp mô hình **Long-running Containerized Web Service** kết nối trực tiếp với GitHub Repository (Git Push Deployment), giải quyết triệt để các rào cản trên:
* **Hỗ trợ tiến trình nền liên tục:** Khởi tạo DI container đúng 1 lần duy nhất khi container start; không có chi phí cold start ở các request tiếp theo.
* **Tự nhiên với Prisma:** Kết nối trực tiếp vào Supabase PostgreSQL (Direct URL - Port 5432) với Connection Pool được kiểm soát tập trung ngay trong Node.js process.
* **Tương thích hoàn hảo với Server-Sent Events (SSE):** Kết nối HTTP streaming cho AI Chatbot (`/api/v1/ai-assistant/chat-stream`) được duy trì ổn định không bị timeout cưỡng bức.
* **Vận hành Cron nội bộ:** Hỗ trợ mô-đun `@nestjs/schedule` chạy chuẩn xác theo từng phút mà không tốn chi phí thuê external webhook scheduler.

---

## 2. PHƯƠNG ÁN THAY THẾ REDIS QUẢN LÝ PHIÊN & REFRESH TOKEN ROTATION

Hệ thống yêu cầu cơ chế **Token Family Rotation** (phát hiện và thu hồi toàn bộ chuỗi token nếu token cũ bị sử dụng lại trái phép) với thời hạn TTL 7 ngày, đồng thời hỗ trợ đăng xuất / vô hiệu hóa phiên tức thì. Dưới đây là 3 phương án khả thi để thay thế Redis tự host:

### So sánh các phương án kỹ thuật

| Tiêu chí | Phương án 1: Bảng `auth_refresh_tokens` trên PostgreSQL (Khuyên dùng) | Phương án 2: Upstash Redis Serverless (HTTP REST) | Phương án 3: JWT Blacklist / In-Memory (Node-Cache) |
| :--- | :--- | :--- | :--- |
| **Hạ tầng phụ thuộc** | **Không** (Dùng chung DB Supabase hiện có) | Có (Đăng ký thêm tài khoản Upstash) | Không (Lưu trực tiếp trong RAM server) |
| **Độ tin cậy khi Restart** | **100% Bền bỉ** (Persistence chuẩn ACID) | **100% Bền bỉ** (Cloud-managed) | **Mất sạch** khi container sleep hoặc redeploy |
| **Bảo mật Token Rotation** | Cực cao (Ràng buộc quan hệ dữ liệu) | Rất cao (Cơ chế TTL và Key Pattern) | Thấp (Dễ bị rò rỉ hoặc mất đồng bộ) |
| **Độ trễ thao tác** | ~5ms - 15ms (Có B-Tree Index) | ~20ms - 50ms (Qua HTTP REST call) | < 1ms (Đọc trực tiếp từ RAM) |
| **Chi phí vận hành** | **0 VNĐ** (Nằm trong dung lượng Supabase) | **0 VNĐ** (Free tier 10,000 req/ngày) | **0 VNĐ** |

---

### PHƯƠNG ÁN CHỌN: BẢNG `auth_refresh_tokens` TRÊN POSTGRESQL (SUPABASE)

Đây là phương án tối ưu nhất, nhất quán với triết lý tinh giản hạ tầng (chỉ quản lý 1 DB duy nhất).

#### 1. DDL Schema bảng lưu Refresh Token
```sql
CREATE TABLE auth_refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL, -- SHA-256 hash của token thực tế
    family_id UUID NOT NULL,          -- Định danh chuỗi luân chuyển (Token Family)
    is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_auth_refresh_token_hash UNIQUE (token_hash)
);

-- Index tối ưu tốc độ tra cứu khi Refresh
CREATE INDEX idx_refresh_tokens_lookup 
    ON auth_refresh_tokens (token_hash) 
    WHERE is_revoked = FALSE;

-- Index phục vụ thu hồi toàn bộ thiết bị và phát hiện tấn công giả mạo (Addendum Bug Fix)
CREATE INDEX idx_refresh_tokens_family_id 
    ON auth_refresh_tokens (family_id);

CREATE INDEX idx_refresh_tokens_user_id 
    ON auth_refresh_tokens (user_id);
```

#### 2. Thuật toán Token Family Rotation (NestJS Service Implementation)
```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  // 1. Cấp phát khi Login
  async createSession(userId: string) {
    const rawRefreshToken = crypto.randomBytes(40).toString('hex');
    const tokenHash = this.hashToken(rawRefreshToken);
    const familyId = uuidv4();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 ngày

    await this.prisma.auth_refresh_tokens.create({
      data: {
        user_id: userId,
        token_hash: tokenHash,
        family_id: familyId,
        expires_at: expiresAt,
      },
    });

    return { rawRefreshToken, familyId };
  }

  // 2. Xoay vòng Token khi nhận POST /auth/refresh
  async rotateRefreshToken(rawToken: string) {
    const tokenHash = this.hashToken(rawToken);

    const tokenRecord = await this.prisma.auth_refresh_tokens.findUnique({
      where: { token_hash: tokenHash },
    });

    if (!tokenRecord) {
      throw new UnauthorizedException('Mã làm mới không tồn tại.');
    }

    // PHÁT HIỆN TẤN CÔNG: Token đã bị thu hồi nhưng bị đem ra sử dụng lại!
    if (tokenRecord.is_revoked || tokenRecord.expires_at < new Date()) {
      // Hủy diệt toàn bộ session cùng family_id để bảo vệ tài khoản
      await this.prisma.auth_refresh_tokens.updateMany({
        where: { family_id: tokenRecord.family_id },
        data: { is_revoked: true },
      });
      throw new UnauthorizedException('Phát hiện truy cập trái phép. Tất cả phiên làm việc đã bị thu hồi!');
    }

    // Thu hồi token hiện tại
    await this.prisma.auth_refresh_tokens.update({
      where: { id: tokenRecord.id },
      data: { is_revoked: true },
    });

    // Cấp token con mới trong cùng family_id
    const newRawRefreshToken = crypto.randomBytes(40).toString('hex');
    const newTokenHash = this.hashToken(newRawRefreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.prisma.auth_refresh_tokens.create({
      data: {
        user_id: tokenRecord.user_id,
        token_hash: newTokenHash,
        family_id: tokenRecord.family_id,
        expires_at: expiresAt,
      },
    });

    return { newRefreshToken: newRawRefreshToken, userId: tokenRecord.user_id };
  }

  // 3. Đăng xuất hoặc thu hồi tài khoản
  async revokeSession(rawToken: string) {
    const tokenHash = this.hashToken(rawToken);
    await this.prisma.auth_refresh_tokens.updateMany({
      where: { token_hash: tokenHash },
      data: { is_revoked: true },
    });
  }
}
```

---

## 3. CHI TIẾT CẤU HÌNH DEPLOY NESTJS LÊN RENDER.COM

### 3.1. Cấu hình Scripts trong `package.json`
Đảm bảo NestJS build sạch và xuất thư mục `dist`:
```json
{
  "scripts": {
    "build": "nest build",
    "start": "node dist/main",
    "start:prod": "node dist/main",
    "render-postbuild": "npx prisma generate"
  }
}
```

### 3.2. Entry Point `src/main.ts` chuẩn mực
```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  app.setGlobalPrefix('api/v1');
  app.enableCors({
    origin: '*', // Điều chỉnh whitelist domain trong Production
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });
  
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Render tự động inject biến PORT (thường là 10000)
  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`Application is running on port: ${port}`);
}
bootstrap();
```

### 3.3. File khai báo hạ tầng `render.yaml` (Infrastructure as Code)
Đặt file `render.yaml` tại thư mục gốc của repository:
```yaml
services:
  - type: web
    name: sports-center-backend
    env: node
    plan: free
    region: singapore # Chọn khu vực gần Việt Nam để tối ưu Ping (~30-40ms)
    buildCommand: npm install && npx prisma generate && npm run build
    startCommand: npm run start:prod
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 10000
      - key: DATABASE_URL
        sync: false # Nhập chuỗi kết nối Supabase Port 5432 trên Dashboard Render
      - key: JWT_SECRET
        sync: false
      - key: GEMINI_API_KEY
        sync: false
```

---

## 4. CHIẾN LƯỢC KẾT NỐI DATABASE & TOÀN VẸN CRON JOB

### 4.1. Chuỗi kết nối Database với Prisma Client
Vì Render chạy container liên tục (không bị rớt connection bất chợt như Serverless), bạn kết nối thẳng vào Supabase qua cổng **5432 Direct Connection**:
```env
DATABASE_URL="postgresql://postgres.[project-ref]:[db-password]@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres?connection_limit=10&pool_timeout=20"
```
* `connection_limit=10`: Thiết lập tối đa 10 connection mở đồng thời cho 1 instance Render, hoàn toàn an toàn và nằm gọn dưới hạn mức của Supabase Free Tier (~60 connections).

### 4.2. Vận hành Cron Job tự nhiên bằng `@nestjs/schedule`
Bỏ qua sự phức tạp của Vercel Webhook Cron hay `pg_cron` cấu hình tay. Sử dụng trực tiếp module lịch trình có sẵn của NestJS:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(private readonly prisma: PrismaService) {}

  // 1. Quét hết hạn thẻ tập lúc 00:05 mỗi ngày (Độ trễ 0 giây)
  @Cron('5 0 * * *')
  async handleSubscriptionExpiry() {
    this.logger.log('Bắt đầu quét kiểm tra thẻ hội viên hết hạn...');
    const result = await this.prisma.user_subscriptions.updateMany({
      where: {
        end_date: { lt: new Date() },
        status: 'ACTIVE',
      },
      data: { status: 'EXPIRED' },
    });
    this.logger.log(`Hoàn tất. Đã chuyển trạng thái ${result.count} gói cước.`);
  }

  // 2. Quét thông báo nhắc lịch trước 2 tiếng (Chạy mỗi 10 phút)
  @Cron('*/10 * * * *')
  async handleClassReminders() {
    const now = new Date();
    const reminderWindowStart = new Date(now.getTime() + 110 * 60 * 1000); // 1h50m
    const reminderWindowEnd = new Date(now.getTime() + 120 * 60 * 1000);   // 2h00m

    // Quét các lịch tập nhóm sắp diễn ra trong khoảng 2 tiếng tới
    const upcomingBookings = await this.prisma.bookings.findMany({
      where: {
        status: 'CONFIRMED',
        schedule: {
          start_time: {
            gte: reminderWindowStart,
            lte: reminderWindowEnd,
          },
        },
      },
      include: { member: true, schedule: { include: { class: true } } },
    });

    for (const b of upcomingBookings) {
      // Gửi Push Notification / SMS nhắc lịch tập
      this.logger.log(`Gửi nhắc nhở cho học viên ${b.member.full_name} lớp ${b.schedule.class.name}`);
    }
  }

  // 3. Dọn dẹp token hết hạn hoặc đã thu hồi lúc 03:00 sáng
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupRevokedTokens() {
    await this.prisma.auth_refresh_tokens.deleteMany({
      where: {
        OR: [
          { expires_at: { lt: new Date() } },
          { is_revoked: true },
        ],
      },
    });
  }
}
```

---

## 5. ĐẶC ĐIỂM RENDER FREE TIER & GIẢI PHÁP GIỮ WARM

* **Cơ chế Sleep:** Dịch vụ Web Service miễn phí trên Render sẽ chuyển sang trạng thái ngủ (Sleep) nếu không có HTTP request nào trong vòng 15 phút. Request đầu tiên để "đánh thức" container sẽ mất khoảng 30 - 45 giây.
* **Biện pháp duy trì hoạt động trong quá trình Dev/Testing:**
  * Thiết lập một endpoint Health Check: `GET /api/v1/health` trả về `{ status: 'ok' }`.
  * Dùng dịch vụ giám sát miễn phí (như UptimeRobot hoặc Cron-job.org) ping vào endpoint `/api/v1/health` mỗi 10 phút một lần. Hành động này giữ cho container luôn "ấm" (Warm), triệt tiêu hoàn toàn thời gian chờ đánh thức.