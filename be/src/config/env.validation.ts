import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  Min,
  Max,
  IsNotEmpty,
  IsOptional,
  IsString,
  validateSync,
} from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export class EnvironmentVariables {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

  @IsInt()
  @Min(1)
  @Max(65535)
  @IsOptional()
  PORT: number = 3000;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL: string;

  @IsString()
  @IsOptional()
  DIRECT_URL: string;

  @IsString()
  @IsNotEmpty()
  JWT_ACCESS_SECRET: string;

  @IsString()
  @IsOptional()
  JWT_ACCESS_EXPIRES_IN: string = '15m';

  @IsString()
  @IsNotEmpty()
  JWT_REFRESH_SECRET: string;

  @IsString()
  @IsOptional()
  JWT_REFRESH_EXPIRES_IN: string = '7d';

  @IsString()
  @IsOptional()
  MOCK_PAYMENT_ENABLED: string = 'false';

  @IsString()
  @IsOptional()
  MOCK_WEBHOOK_SECRET?: string;

  @IsString()
  @IsOptional()
  PAYOS_CLIENT_ID?: string;

  @IsString()
  @IsOptional()
  PAYOS_API_KEY?: string;

  @IsString()
  @IsOptional()
  PAYOS_CHECKSUM_KEY?: string;

  @IsString()
  @IsOptional()
  PAYOS_RETURN_URL?: string;

  @IsString()
  @IsOptional()
  PAYOS_CANCEL_URL?: string;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(
      `Config validation error: ${errors.map((error) => `${error.property}: ${Object.values(error.constraints ?? {}).join(', ')}`).join('; ')}`,
    );
  }
  return validatedConfig;
}
