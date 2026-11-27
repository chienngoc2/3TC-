import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private readonly config: ConfigService) {
    this.initTransporter();
  }

  private initTransporter() {
    const host = this.config.get<string>('SMTP_HOST')?.trim();
    const user = this.config.get<string>('SMTP_USER')?.trim();
    const rawPass = this.config.get<string>('SMTP_PASS')?.trim();
    const pass = rawPass ? rawPass.replace(/\s+/g, '') : undefined;
    const port = Number(this.config.get<number>('SMTP_PORT', 587)) || 587;

    if (host && user && pass) {
      try {
        this.transporter = nodemailer.createTransport({
          host,
          port,
          secure: port === 465,
          auth: { user, pass },
          connectionTimeout: 10000,
          greetingTimeout: 10000,
          socketTimeout: 15000,
        });
        this.logger.log(`SMTP configured with host: ${host}:${port} (user: ${user})`);
      } catch (err) {
        this.logger.error('Failed to initialize SMTP transporter', err);
      }
    } else {
      const missing = [
        !host && 'SMTP_HOST',
        !user && 'SMTP_USER',
        !pass && 'SMTP_PASS',
      ].filter(Boolean);
      this.logger.warn(
        `SMTP credentials not fully provided (missing: ${missing.join(', ')}). Emails will only be logged in preview mode.`,
      );
    }
  }

  private getFromAddress(): string {
    const configuredFrom = this.config.get<string>('SMTP_FROM')?.trim();
    if (configuredFrom) return configuredFrom;
    const user = this.config.get<string>('SMTP_USER')?.trim();
    if (user) return `"3TC Fitness Center" <${user}>`;
    return '"3TC Fitness Center" <noreply@3tcfitness.com>';
  }

  private parseFromParts(): { name: string; email: string } {
    const raw = this.getFromAddress();
    const match = raw.match(/^(?:"?([^"<]*)"?\s*)?<([^>]+)>$/);
    if (match) {
      return {
        name: (match[1] || '3TC Fitness Center').trim(),
        email: match[2].trim(),
      };
    }
    return { name: '3TC Fitness Center', email: raw.replace(/["<>]/g, '').trim() };
  }

  private async deliverEmail(
    toEmail: string,
    subject: string,
    htmlContent: string,
  ): Promise<{ sent: boolean; error?: string }> {
    const brevoKey = this.config.get<string>('BREVO_API_KEY')?.trim();
    if (brevoKey) {
      try {
        const sender = this.parseFromParts();
        const res = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'api-key': brevoKey,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            sender,
            to: [{ email: toEmail }],
            subject,
            htmlContent,
          }),
          signal: AbortSignal.timeout(12000),
        });
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          const errMsg = `Brevo API ${res.status}: ${text || res.statusText}`;
          this.logger.error(errMsg);
          return { sent: false, error: errMsg };
        }
        this.logger.log(`Email sent via Brevo HTTPS API to ${toEmail}`);
        return { sent: true };
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Brevo API error';
        this.logger.error(`Brevo HTTPS error sending to ${toEmail}:`, err);
        return { sent: false, error: errMsg };
      }
    }

    const resendKey = this.config.get<string>('RESEND_API_KEY')?.trim();
    if (resendKey) {
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: this.getFromAddress(),
            to: [toEmail],
            subject,
            html: htmlContent,
          }),
          signal: AbortSignal.timeout(12000),
        });
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          const errMsg = `Resend API ${res.status}: ${text || res.statusText}`;
          this.logger.error(errMsg);
          return { sent: false, error: errMsg };
        }
        this.logger.log(`Email sent via Resend HTTPS API to ${toEmail}`);
        return { sent: true };
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Resend API error';
        this.logger.error(`Resend HTTPS error sending to ${toEmail}:`, err);
        return { sent: false, error: errMsg };
      }
    }

    const webhookUrl = this.config.get<string>('EMAIL_WEBHOOK_URL')?.trim();
    if (webhookUrl) {
      try {
        const res = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: toEmail,
            subject,
            html: htmlContent,
            from: this.getFromAddress(),
          }),
          signal: AbortSignal.timeout(12000),
        });
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          const errMsg = `Email webhook ${res.status}: ${text || res.statusText}`;
          this.logger.error(errMsg);
          return { sent: false, error: errMsg };
        }
        this.logger.log(`Email sent via EMAIL_WEBHOOK_URL to ${toEmail}`);
        return { sent: true };
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Email webhook error';
        this.logger.error(`Email webhook error sending to ${toEmail}:`, err);
        return { sent: false, error: errMsg };
      }
    }

    if (!this.transporter) {
      return {
        sent: false,
        error:
          'Máy chủ chưa cấu hình kênh gửi mail (BREVO_API_KEY / RESEND_API_KEY / EMAIL_WEBHOOK_URL hoặc SMTP).',
      };
    }

    try {
      const info = await this.transporter.sendMail({
        from: this.getFromAddress(),
        to: toEmail,
        subject,
        html: htmlContent,
      });
      this.logger.log(
        `Email sent via SMTP to ${toEmail} (messageId: ${info.messageId})`,
      );
      return { sent: true };
    } catch (error) {
      const errMsg =
        error instanceof Error ? error.message : 'Lỗi kết nối SMTP';
      this.logger.error(`SMTP error sending email to ${toEmail}:`, error);
      return { sent: false, error: errMsg };
    }
  }

  async sendOtpEmail(toEmail: string, otpCode: string, fullName?: string): Promise<boolean> {
    const subject = 'Mã xác thực OTP đăng nhập Google - 3TC Fitness Center';
    const recipientName = fullName || toEmail.split('@')[0];
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 550px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="color: #0284c7; margin: 0; font-size: 24px;">3TC FITNESS CENTER</h2>
          <p style="color: #64748b; font-size: 14px; margin-top: 4px;">Hệ thống Quản lý Trung tâm Thể thao Cao cấp</p>
        </div>
        <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 16px 0;" />
        <p style="color: #334155; font-size: 15px;">Xin chào <strong>${recipientName}</strong>,</p>
        <p style="color: #475569; font-size: 14px; line-height: 1.6;">
          Bạn vừa yêu cầu đăng nhập bằng tài khoản Google. Vui lòng sử dụng mã xác thực OTP dưới đây để hoàn tất đăng nhập:
        </p>
        <div style="margin: 24px 0; text-align: center;">
          <span style="display: inline-block; padding: 12px 32px; font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #0284c7; background-color: #e0f2fe; border-radius: 8px; border: 1px dashed #38bdf8;">
            ${otpCode}
          </span>
        </div>
        <p style="color: #e11d48; font-size: 13px; text-align: center; margin-top: -8px;">
          * Mã này có hiệu lực trong vòng <strong>5 phút</strong>. Tuyệt đối không chia sẻ mã này cho bất kỳ ai!
        </p>
        <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 20px 0;" />
        <p style="color: #94a3b8; font-size: 12px; text-align: center;">
          Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email hoặc liên hệ hỗ trợ.
        </p>
      </div>
    `;

    this.logger.log(`\n============================================================\n[EMAIL OUTBOX: OTP]\nTo: ${toEmail}\nSubject: ${subject}\nOTP CODE: [ ${otpCode} ] (expires in 5 mins)\n============================================================`);

    const result = await this.deliverEmail(toEmail, subject, htmlContent);
    return result.sent;
  }

  async sendDefaultAccountEmail(
    toEmail: string,
    defaultPassword: string,
    fullName?: string,
  ): Promise<boolean> {
    const subject = 'Thông tin tài khoản mặc định - 3TC Fitness Center';
    const recipientName = fullName || toEmail.split('@')[0];
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 550px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="color: #0284c7; margin: 0; font-size: 24px;">3TC FITNESS CENTER</h2>
          <p style="color: #64748b; font-size: 14px; margin-top: 4px;">Chào mừng bạn đến với cộng đồng 3TC Fitness!</p>
        </div>
        <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 16px 0;" />
        <p style="color: #334155; font-size: 15px;">Xin chào <strong>${recipientName}</strong>,</p>
        <p style="color: #475569; font-size: 14px; line-height: 1.6;">
          Bạn đã đăng nhập thành công vào hệ thống qua tài khoản Google. Dưới đây là thông tin tài khoản đăng nhập mặc định của bạn:
        </p>
        <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <div style="margin-bottom: 8px;">
            <strong style="color: #334155;">Tên đăng nhập (Email):</strong>
            <span style="color: #0284c7; font-family: monospace; font-size: 15px; margin-left: 8px;">${toEmail}</span>
          </div>
          <div>
            <strong style="color: #334155;">Mật khẩu mặc định:</strong>
            <span style="color: #0f172a; font-family: monospace; font-size: 15px; font-weight: bold; background: #e2e8f0; padding: 2px 8px; border-radius: 4px; margin-left: 8px;">${defaultPassword}</span>
          </div>
        </div>
        <div style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 12px; margin: 16px 0; border-radius: 0 6px 6px 0;">
          <p style="margin: 0; color: #065f46; font-size: 13px; line-height: 1.5;">
            <strong>Mẹo:</strong> Bạn có thể sử dụng mật khẩu này để đăng nhập trực tiếp mà không cần Google, hoặc thay đổi mật khẩu trong trang Hồ sơ cá nhân của mình.
          </p>
        </div>
        <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 20px 0;" />
        <p style="color: #94a3b8; font-size: 12px; text-align: center;">
          3TC Fitness Center Management System — Mọi thắc mắc xin liên hệ quản lý trung tâm.
        </p>
      </div>
    `;

    this.logger.log(`\n============================================================\n[EMAIL OUTBOX: DEFAULT ACCOUNT CREDENTIALS]\nTo: ${toEmail}\nSubject: ${subject}\nUsername: ${toEmail}\nDefault Password: [ ${defaultPassword} ]\n============================================================`);

    const result = await this.deliverEmail(toEmail, subject, htmlContent);
    return result.sent;
  }

  async sendStaffAccountCredentialsEmail(
    toEmail: string,
    credentials: {
      fullName: string;
      systemEmail: string;
      password: string;
      role: string;
    },
  ): Promise<boolean> {
    const result = await this.sendStaffAccountCredentialsEmailWithStatus(
      toEmail,
      credentials,
    );
    return result.sent;
  }

  async sendStaffAccountCredentialsEmailWithStatus(
    toEmail: string,
    credentials: {
      fullName: string;
      systemEmail: string;
      password: string;
      role: string;
    },
  ): Promise<{ sent: boolean; error?: string }> {
    const roleLabel =
      credentials.role === 'COACH'
        ? 'Huấn luyện viên'
        : credentials.role === 'CENTER_MANAGER'
          ? 'Quản lý trung tâm'
          : credentials.role === 'RECEPTIONIST'
            ? 'Lễ tân'
            : 'Nhân viên';

    const subject = `Thông tin tài khoản ${roleLabel} - 3TC Fitness Center`;
    const recipientName = credentials.fullName || toEmail.split('@')[0];
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="color: #008b74; margin: 0; font-size: 24px; text-transform: uppercase;">3TC FITNESS CENTER</h2>
          <p style="color: #64748b; font-size: 14px; margin-top: 4px;">Thông báo cấp tài khoản ${roleLabel} mới</p>
        </div>
        <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 16px 0;" />
        <p style="color: #334155; font-size: 15px;">Xin chào <strong>${recipientName}</strong>,</p>
        <p style="color: #475569; font-size: 14px; line-height: 1.6;">
          Ban Quản Lý 3TC Fitness Center đã khởi tạo tài khoản công việc cho bạn với vai trò <strong>${roleLabel}</strong>. Dưới đây là thông tin đăng nhập hệ thống:
        </p>
        <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 18px; margin: 20px 0;">
          <div style="margin-bottom: 12px;">
            <strong style="color: #334155;">Tài khoản đăng nhập (Email hệ thống):</strong>
            <div style="color: #008b74; font-family: monospace; font-size: 16px; font-weight: bold; margin-top: 4px; background: #e6f4f1; padding: 6px 12px; border-radius: 6px; display: inline-block;">
              ${credentials.systemEmail}
            </div>
          </div>
          <div>
            <strong style="color: #334155;">Mật khẩu ban đầu:</strong>
            <div style="color: #0f172a; font-family: monospace; font-size: 16px; font-weight: bold; background: #e2e8f0; padding: 6px 12px; border-radius: 6px; margin-top: 4px; display: inline-block; letter-spacing: 2px;">
              ${credentials.password}
            </div>
          </div>
        </div>
        <div style="background-color: #ecfdf5; border-left: 4px solid #008b74; padding: 12px; margin: 16px 0; border-radius: 0 6px 6px 0;">
          <p style="margin: 0; color: #065f46; font-size: 13px; line-height: 1.5;">
            <strong>Lưu ý bảo mật:</strong> Vui lòng sử dụng thông tin trên để đăng nhập vào ứng dụng và đổi mật khẩu trong mục <em>Hồ sơ cá nhân</em> ngay ở lần đầu tiên.
          </p>
        </div>
        <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 20px 0;" />
        <p style="color: #94a3b8; font-size: 12px; text-align: center;">
          3TC Fitness Center Management System — Email được gửi tự động, vui lòng không trả lời thư này.
        </p>
      </div>
    `;

    this.logger.log(
      `\n============================================================\n` +
      `[EMAIL OUTBOX: COACH/STAFF ACCOUNT CREDENTIALS]\n` +
      `To: ${toEmail}\n` +
      `Subject: ${subject}\n` +
      `System Account: ${credentials.systemEmail}\n` +
      `Password: [ ${credentials.password} ]\n` +
      `Role: ${credentials.role}\n` +
      `============================================================`,
    );

    return this.deliverEmail(toEmail, subject, htmlContent);
  }

  async sendClassAutoCancelledMemberEmail(
    toEmail: string,
    memberName: string,
    classInfo: {
      className: string;
      startTime: string;
      endTime: string;
      roomName?: string;
      coachName?: string;
    },
  ): Promise<boolean> {
    const subject = `[3TC Fitness] Thông báo hủy lớp học & hoàn trả lượt tập (token)`;
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="color: #008b74; margin: 0; font-size: 22px; text-transform: uppercase;">3TC FITNESS CENTER</h2>
          <p style="color: #64748b; font-size: 13px; margin-top: 4px;">Thông báo tự động về lịch tập lớp nhóm</p>
        </div>
        <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 16px 0;" />
        <p style="color: #334155; font-size: 15px;">Xin chào <strong>${memberName}</strong>,</p>
        <p style="color: #475569; font-size: 14px; line-height: 1.6;">
          Hệ thống 3TC Fitness xin thông báo lớp học nhóm bạn đã đăng ký dưới đây đã được <strong>tự động hủy</strong> do trước 2 ngày chưa đạt đủ 60% sĩ số tối thiểu theo quy định trung tâm:
        </p>
        <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 16px; margin: 18px 0; font-size: 13.5px; line-height: 1.6;">
          <div><strong style="color: #334155;">Lớp học:</strong> <span style="color: #0f172a; font-weight: bold;">${classInfo.className}</span></div>
          <div><strong style="color: #334155;">Thời gian:</strong> <span style="color: #008b74; font-weight: bold;">${classInfo.startTime} – ${classInfo.endTime}</span></div>
          ${classInfo.roomName ? `<div><strong style="color: #334155;">Phòng tập:</strong> ${classInfo.roomName}</div>` : ''}
          ${classInfo.coachName ? `<div><strong style="color: #334155;">Huấn luyện viên:</strong> ${classInfo.coachName}</div>` : ''}
        </div>
        <div style="background-color: #ecfdf5; border-left: 4px solid #008b74; padding: 14px; margin: 16px 0; border-radius: 0 6px 6px 0;">
          <p style="margin: 0; color: #065f46; font-size: 13.5px; font-weight: bold;">
            ✓ Hoàn trả lượt tập thành công
          </p>
          <p style="margin: 4px 0 0; color: #047857; font-size: 13px; line-height: 1.5;">
            Hệ thống đã tự động hoàn trả <strong>1 lượt tập (token)</strong> của gói tập tương ứng vào tài khoản của bạn. Bạn có thể sử dụng lượt này để đặt lịch cho các ca tập khác.
          </p>
        </div>
        <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 20px 0;" />
        <p style="color: #94a3b8; font-size: 12px; text-align: center;">
          3TC Fitness Center Management System — Thư gửi tự động từ hệ thống.
        </p>
      </div>
    `;

    this.logger.log(
      `\n============================================================\n` +
      `[EMAIL OUTBOX: CLASS AUTO-CANCELLED (MEMBER)]\n` +
      `To: ${toEmail}\n` +
      `Subject: ${subject}\n` +
      `Class: ${classInfo.className} (${classInfo.startTime} - ${classInfo.endTime})\n` +
      `Refund: 1 token restored to member subscription\n` +
      `============================================================`,
    );

    if (this.transporter) {
      try {
        const from = this.config.get<string>('SMTP_FROM', '"3TC Fitness Center" <noreply@3tcfitness.com>');
        await this.transporter.sendMail({ from, to: toEmail, subject, html: htmlContent });
        return true;
      } catch (error) {
        this.logger.error(`Error sending class cancelled email to member ${toEmail}:`, error);
        return false;
      }
    }
    return true;
  }

  async sendClassCancelledApologyMemberEmail(
    toEmail: string,
    memberName: string,
    classInfo: {
      className: string;
      startTime: string;
      endTime: string;
      roomName?: string;
      coachName?: string;
      reason?: string;
    },
  ): Promise<boolean> {
    const subject = `[3TC Fitness] Cáo lỗi hủy lịch ca học & Đã hoàn trả 100% lượt tập (token)`;
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="color: #17664e; margin: 0; font-size: 22px; text-transform: uppercase;">3TC FITNESS CENTER</h2>
          <p style="color: #64748b; font-size: 13px; margin-top: 4px;">Thông báo điều phối lịch tập & Thành thật cáo lỗi</p>
        </div>
        <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 16px 0;" />
        <p style="color: #334155; font-size: 15px;">Xin chào <strong>${memberName}</strong>,</p>
        <p style="color: #475569; font-size: 14px; line-height: 1.6;">
          Trung tâm 3TC Fitness thành thật cáo lỗi cùng bạn: Ca học bạn đã đăng ký dưới đây buộc phải <strong>hủy bỏ</strong> do Huấn luyện viên có sự cố bất khả kháng và trung tâm chưa thể sắp xếp Huấn luyện viên thay thế có chuyên môn tương đương:
        </p>
        <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 16px; margin: 18px 0; font-size: 13.5px; line-height: 1.6;">
          <div><strong style="color: #334155;">Lớp học:</strong> <span style="color: #0f172a; font-weight: bold;">${classInfo.className}</span></div>
          <div><strong style="color: #334155;">Thời gian:</strong> <span style="color: #17664e; font-weight: bold;">${classInfo.startTime} – ${classInfo.endTime}</span></div>
          ${classInfo.roomName ? `<div><strong style="color: #334155;">Phòng tập:</strong> ${classInfo.roomName}</div>` : ''}
          ${classInfo.coachName ? `<div><strong style="color: #334155;">Huấn luyện viên:</strong> ${classInfo.coachName}</div>` : ''}
          ${classInfo.reason ? `<div><strong style="color: #334155;">Lý do báo bận:</strong> <span style="color: #e11d48; font-style: italic;">${classInfo.reason}</span></div>` : ''}
        </div>
        <div style="background-color: #ecfdf5; border-left: 4px solid #17664e; padding: 14px; margin: 16px 0; border-radius: 0 6px 6px 0;">
          <p style="margin: 0; color: #17664e; font-size: 13.5px; font-weight: bold;">
            ✓ Đã hoàn trả 100% lượt tập (token) vào tài khoản
          </p>
          <p style="margin: 4px 0 0; color: #047857; font-size: 13px; line-height: 1.5;">
            Hệ thống đã tự động hoàn trả <strong>1 lượt tập</strong> của gói tập tương ứng về tài khoản của bạn. Bạn có thể sử dụng ngay để đăng ký buổi tập khác phù hợp.
          </p>
        </div>
        <p style="color: #475569; font-size: 13.5px; line-height: 1.6;">
          3TC Fitness rất mong nhận được sự thông cảm từ bạn vì sự bất tiện này.
        </p>
        <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 20px 0;" />
        <p style="color: #94a3b8; font-size: 12px; text-align: center;">
          3TC Fitness Center Management System — Thư gửi tự động từ hệ thống.
        </p>
      </div>
    `;

    this.logger.log(
      `\n============================================================\n` +
      `[EMAIL OUTBOX: CLASS CANCELLED APOLOGY (MEMBER)]\n` +
      `To: ${toEmail}\n` +
      `Subject: ${subject}\n` +
      `Class: ${classInfo.className} (${classInfo.startTime} - ${classInfo.endTime})\n` +
      `Refund: 1 token restored to member subscription\n` +
      `============================================================`,
    );

    if (this.transporter) {
      try {
        const from = this.config.get<string>('SMTP_FROM', '"3TC Fitness Center" <noreply@3tcfitness.com>');
        await this.transporter.sendMail({ from, to: toEmail, subject, html: htmlContent });
        return true;
      } catch (error) {
        this.logger.error(`Error sending class cancelled apology email to member ${toEmail}:`, error);
        return false;
      }
    }
    return true;
  }

  async sendClassAutoCancelledCoachEmail(
    toEmail: string,
    coachName: string,
    classInfo: {
      className: string;
      startTime: string;
      endTime: string;
      roomName?: string;
      enrolledCount: number;
      capacity: number;
    },
  ): Promise<boolean> {
    const subject = `[3TC Fitness] Thông báo hủy lịch lớp nhóm do không đủ sĩ số tối thiểu`;
    const minRequired = Math.ceil(classInfo.capacity * 0.6);
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="color: #008b74; margin: 0; font-size: 22px; text-transform: uppercase;">3TC FITNESS CENTER</h2>
          <p style="color: #64748b; font-size: 13px; margin-top: 4px;">Thông báo điều phối lịch giảng dạy HLV</p>
        </div>
        <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 16px 0;" />
        <p style="color: #334155; font-size: 15px;">Xin chào HLV <strong>${coachName}</strong>,</p>
        <p style="color: #475569; font-size: 14px; line-height: 1.6;">
          Hệ thống 3TC Fitness xin thông báo ca dạy lớp nhóm của bạn đã được <strong>tự động hủy</strong> do trước 2 ngày số lượng học viên đăng ký (${classInfo.enrolledCount}/${classInfo.capacity}) chưa đạt mức tối thiểu 60% (${minRequired} học viên) theo quy chế trung tâm:
        </p>
        <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 16px; margin: 18px 0; font-size: 13.5px; line-height: 1.6;">
          <div><strong style="color: #334155;">Lớp học:</strong> <span style="color: #0f172a; font-weight: bold;">${classInfo.className}</span></div>
          <div><strong style="color: #334155;">Thời gian:</strong> <span style="color: #008b74; font-weight: bold;">${classInfo.startTime} – ${classInfo.endTime}</span></div>
          <div><strong style="color: #334155;">Sĩ số đăng ký:</strong> <span style="color: #dc2626; font-weight: bold;">${classInfo.enrolledCount} / ${classInfo.capacity}</span> (Tối thiểu cần: ${minRequired})</div>
          ${classInfo.roomName ? `<div><strong style="color: #334155;">Phòng tập:</strong> ${classInfo.roomName}</div>` : ''}
        </div>
        <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 14px; margin: 16px 0; border-radius: 0 6px 6px 0;">
          <p style="margin: 0; color: #1e40af; font-size: 13.5px; font-weight: bold;">
            ✓ Quy chế tính thù lao & kỷ luật
          </p>
          <p style="margin: 4px 0 0; color: #1d4ed8; font-size: 13px; line-height: 1.5;">
            Đây là quy tắc tự động của hệ thống khi không đủ người học: <strong>HLV không bị kỷ luật, không bị phạt và không ảnh hưởng đến đánh giá chuyên môn</strong>. Ca dạy bị hủy sẽ không tính lương buổi dạy này.
          </p>
        </div>
        <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 20px 0;" />
        <p style="color: #94a3b8; font-size: 12px; text-align: center;">
          3TC Fitness Center Management System — Thư gửi tự động từ hệ thống.
        </p>
      </div>
    `;

    this.logger.log(
      `\n============================================================\n` +
      `[EMAIL OUTBOX: CLASS AUTO-CANCELLED (COACH)]\n` +
      `To: ${toEmail}\n` +
      `Subject: ${subject}\n` +
      `Coach: ${coachName}\n` +
      `Class: ${classInfo.className} (${classInfo.startTime} - ${classInfo.endTime})\n` +
      `Enrolled: ${classInfo.enrolledCount}/${classInfo.capacity} (min ${minRequired})\n` +
      `Policy: No penalty applied to coach\n` +
      `============================================================`,
    );

    if (this.transporter) {
      try {
        const from = this.config.get<string>('SMTP_FROM', '"3TC Fitness Center" <noreply@3tcfitness.com>');
        await this.transporter.sendMail({ from, to: toEmail, subject, html: htmlContent });
        return true;
      } catch (error) {
        this.logger.error(`Error sending class cancelled email to coach ${toEmail}:`, error);
        return false;
      }
    }
    return true;
  }

  async sendClassManagerOverrideEmail(
    toEmail: string,
    recipientName: string,
    classInfo: {
      className: string;
      startTime: string;
      endTime: string;
      roomName?: string;
      action: 'FORCE_OPEN' | 'FORCE_CLOSE';
      reason: string;
    },
  ): Promise<boolean> {
    const isOpen = classInfo.action === 'FORCE_OPEN';
    const subject = `[3TC Fitness] Thông báo cập nhật lịch lớp học: ${isOpen ? 'Vẫn diễn ra' : 'Đã đóng lớp'} theo quyết định Quản lý`;
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="color: #008b74; margin: 0; font-size: 22px; text-transform: uppercase;">3TC FITNESS CENTER</h2>
          <p style="color: #64748b; font-size: 13px; margin-top: 4px;">Quyết định ngoại lệ từ Ban Quản Lý</p>
        </div>
        <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 16px 0;" />
        <p style="color: #334155; font-size: 15px;">Kính gửi <strong>${recipientName}</strong>,</p>
        <p style="color: #475569; font-size: 14px; line-height: 1.6;">
          Ban Quản Lý 3TC Fitness Center vừa áp dụng quyết định ngoại lệ cho lớp học sau:
        </p>
        <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 16px; margin: 18px 0; font-size: 13.5px; line-height: 1.6;">
          <div><strong style="color: #334155;">Lớp học:</strong> <span style="color: #0f172a; font-weight: bold;">${classInfo.className}</span></div>
          <div><strong style="color: #334155;">Thời gian:</strong> <span style="color: #008b74; font-weight: bold;">${classInfo.startTime} – ${classInfo.endTime}</span></div>
          ${classInfo.roomName ? `<div><strong style="color: #334155;">Phòng tập:</strong> ${classInfo.roomName}</div>` : ''}
          <div><strong style="color: #334155;">Quyết định Quản lý:</strong> <span style="color: ${isOpen ? '#059669' : '#dc2626'}; font-weight: bold;">${isOpen ? 'Cho phép mở lớp ngoại lệ' : 'Đóng lớp ngoại lệ'}</span></div>
          <div><strong style="color: #334155;">Lý do ghi nhận:</strong> <em>"${classInfo.reason}"</em></div>
        </div>
        <div style="background-color: ${isOpen ? '#ecfdf5' : '#fef2f2'}; border-left: 4px solid ${isOpen ? '#008b74' : '#ef4444'}; padding: 14px; margin: 16px 0; border-radius: 0 6px 6px 0;">
          <p style="margin: 0; color: ${isOpen ? '#065f46' : '#991b1b'}; font-size: 13.5px; font-weight: bold;">
            ${isOpen ? 'Lớp học vẫn diễn ra bình thường theo lịch' : 'Lớp học không diễn ra. Lượt tập đã được hoàn trả.'}
          </p>
        </div>
        <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 20px 0;" />
        <p style="color: #94a3b8; font-size: 12px; text-align: center;">
          3TC Fitness Center Management System — Thư gửi tự động từ hệ thống.
        </p>
      </div>
    `;

    this.logger.log(
      `\n============================================================\n` +
      `[EMAIL OUTBOX: MANAGER OVERRIDE SCHEDULE]\n` +
      `To: ${toEmail}\n` +
      `Subject: ${subject}\n` +
      `Recipient: ${recipientName}\n` +
      `Action: ${classInfo.action}\n` +
      `Reason: ${classInfo.reason}\n` +
      `============================================================`,
    );

    if (this.transporter) {
      try {
        const from = this.config.get<string>('SMTP_FROM', '"3TC Fitness Center" <noreply@3tcfitness.com>');
        await this.transporter.sendMail({ from, to: toEmail, subject, html: htmlContent });
        return true;
      } catch (error) {
        this.logger.error(`Error sending manager override email to ${toEmail}:`, error);
        return false;
      }
    }
    return true;
  }

  async sendBookingCancelledMemberEmail(
    toEmail: string,
    recipientName: string,
    bookingInfo: {
      sessionTitle: string;
      startTime: string;
      endTime: string;
      coachName?: string;
      isLateCancellation: boolean;
      refunded: boolean;
      cancellationReason?: string;
    },
  ): Promise<boolean> {
    const subject = `[3TC Fitness] Xác nhận hủy lịch ca tập: ${bookingInfo.sessionTitle}`;
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="color: #008b74; margin: 0; font-size: 22px; text-transform: uppercase;">3TC FITNESS CENTER</h2>
          <p style="color: #64748b; font-size: 13px; margin-top: 4px;">Xác nhận hủy đặt chỗ ca tập</p>
        </div>
        <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 16px 0;" />
        <p style="color: #334155; font-size: 15px;">Xin chào <strong>${recipientName}</strong>,</p>
        <p style="color: #475569; font-size: 14px; line-height: 1.6;">
          Hệ thống đã ghi nhận yêu cầu hủy lịch ca tập của bạn với thông tin chi tiết như sau:
        </p>
        <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 16px; margin: 18px 0; font-size: 13.5px; line-height: 1.6;">
          <div><strong style="color: #334155;">Buổi tập:</strong> <span style="color: #0f172a; font-weight: bold;">${bookingInfo.sessionTitle}</span></div>
          <div><strong style="color: #334155;">Thời gian:</strong> <span style="color: #008b74; font-weight: bold;">${bookingInfo.startTime} – ${bookingInfo.endTime}</span></div>
          ${bookingInfo.coachName ? `<div><strong style="color: #334155;">Huấn luyện viên:</strong> ${bookingInfo.coachName}</div>` : ''}
          ${bookingInfo.cancellationReason ? `<div><strong style="color: #334155;">Lý do hủy:</strong> <em>"${bookingInfo.cancellationReason}"</em></div>` : ''}
        </div>
        <div style="background-color: ${bookingInfo.refunded ? '#ecfdf5' : '#fff1f2'}; border-left: 4px solid ${bookingInfo.refunded ? '#059669' : '#e11d48'}; padding: 14px; margin: 16px 0; border-radius: 0 6px 6px 0;">
          <p style="margin: 0; color: ${bookingInfo.refunded ? '#065f46' : '#9f1239'}; font-size: 13.5px; font-weight: bold;">
            ${bookingInfo.refunded 
              ? '✓ Hủy hợp lệ (trước >= 2 tiếng): 01 lượt tập (token) đã được hoàn trả lại vào tài khoản gói tập của bạn.' 
              : '⚠ Hủy sát giờ (< 2 tiếng): Theo quy định của trung tâm, lượt tập này không được hoàn trả.'}
          </p>
        </div>
        <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 20px 0;" />
        <p style="color: #94a3b8; font-size: 12px; text-align: center;">
          3TC Fitness Center Management System — Thư gửi tự động từ hệ thống.
        </p>
      </div>
    `;

    this.logger.log(
      `\n============================================================\n` +
      `[EMAIL OUTBOX: MEMBER CANCELLED BOOKING]\n` +
      `To: ${toEmail}\n` +
      `Subject: ${subject}\n` +
      `Session: ${bookingInfo.sessionTitle} (${bookingInfo.startTime})\n` +
      `Refunded: ${bookingInfo.refunded}\n` +
      `============================================================`,
    );

    if (this.transporter) {
      try {
        const from = this.config.get<string>('SMTP_FROM', '"3TC Fitness Center" <noreply@3tcfitness.com>');
        await this.transporter.sendMail({ from, to: toEmail, subject, html: htmlContent });
        return true;
      } catch (error) {
        this.logger.error(`Error sending booking cancelled email to member ${toEmail}:`, error);
        return false;
      }
    }
    return true;
  }

  async sendBookingCancelledCoachEmail(
    toEmail: string,
    coachName: string,
    bookingInfo: {
      memberName: string;
      sessionTitle: string;
      startTime: string;
      endTime: string;
      isLateCancellation: boolean;
      cancellationReason?: string;
    },
  ): Promise<boolean> {
    const subject = `[3TC Fitness] Học viên hủy lịch: ${bookingInfo.memberName} - ${bookingInfo.sessionTitle}`;
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="color: #008b74; margin: 0; font-size: 22px; text-transform: uppercase;">3TC FITNESS CENTER</h2>
          <p style="color: #64748b; font-size: 13px; margin-top: 4px;">Thông báo cập nhật lịch học viên</p>
        </div>
        <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 16px 0;" />
        <p style="color: #334155; font-size: 15px;">Xin chào HLV <strong>${coachName}</strong>,</p>
        <p style="color: #475569; font-size: 14px; line-height: 1.6;">
          Học viên <strong>${bookingInfo.memberName}</strong> vừa thực hiện hủy lịch ca tập với bạn:
        </p>
        <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 16px; margin: 18px 0; font-size: 13.5px; line-height: 1.6;">
          <div><strong style="color: #334155;">Buổi tập:</strong> <span style="color: #0f172a; font-weight: bold;">${bookingInfo.sessionTitle}</span></div>
          <div><strong style="color: #334155;">Thời gian:</strong> <span style="color: #008b74; font-weight: bold;">${bookingInfo.startTime} – ${bookingInfo.endTime}</span></div>
          <div><strong style="color: #334155;">Học viên:</strong> ${bookingInfo.memberName}</div>
          ${bookingInfo.cancellationReason ? `<div><strong style="color: #334155;">Lý do hủy:</strong> <em>"${bookingInfo.cancellationReason}"</em></div>` : ''}
          <div><strong style="color: #334155;">Thời điểm hủy:</strong> ${bookingInfo.isLateCancellation ? '<span style="color: #e11d48; font-weight: bold;">Hủy sát giờ (&lt; 2 tiếng)</span>' : '<span style="color: #059669; font-weight: bold;">Hủy trước giờ quy định</span>'}</div>
        </div>
        <div style="background-color: #f0fdf4; border-left: 4px solid #16a34a; padding: 14px; margin: 16px 0; border-radius: 0 6px 6px 0;">
          <p style="margin: 0; color: #166534; font-size: 13.5px; font-weight: bold;">
            ${bookingInfo.isLateCancellation
              ? '✓ Do học viên hủy sát giờ, ca này vẫn tính là một ca hoàn thành và bạn vẫn được tính thù lao theo chính sách.'
              : '✓ Khung giờ của bạn đã được giải phóng để học viên khác có thể đăng ký.'}
          </p>
        </div>
        <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 20px 0;" />
        <p style="color: #94a3b8; font-size: 12px; text-align: center;">
          3TC Fitness Center Management System — Thư gửi tự động từ hệ thống.
        </p>
      </div>
    `;

    this.logger.log(
      `\n============================================================\n` +
      `[EMAIL OUTBOX: COACH NOTIFIED OF MEMBER CANCELLATION]\n` +
      `To: ${toEmail}\n` +
      `Subject: ${subject}\n` +
      `Coach: ${coachName}\n` +
      `Member: ${bookingInfo.memberName}\n` +
      `Late: ${bookingInfo.isLateCancellation}\n` +
      `============================================================`,
    );

    if (this.transporter) {
      try {
        const from = this.config.get<string>('SMTP_FROM', '"3TC Fitness Center" <noreply@3tcfitness.com>');
        await this.transporter.sendMail({ from, to: toEmail, subject, html: htmlContent });
        return true;
      } catch (error) {
        this.logger.error(`Error sending booking cancelled notification to coach ${toEmail}:`, error);
        return false;
      }
    }
    return true;
  }
}
