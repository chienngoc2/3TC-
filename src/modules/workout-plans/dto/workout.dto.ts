import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PartialType, OmitType } from '@nestjs/swagger';
export class ExerciseDto {
  @IsUUID() exerciseId: string;
  @IsOptional() @IsInt() @Min(1) @Max(100) sets?: number;
  @IsOptional() @IsInt() @Min(1) @Max(1000) reps?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(999) weightKg?: number;
  @IsOptional() @IsInt() @Min(0) @Max(3600) restSeconds?: number;
  @IsOptional() @IsString() @MaxLength(4000) coachFeedback?: string;
}
export class WorkoutDto {
  @IsUUID() memberId: string;
  @IsString() @MinLength(2) @MaxLength(150) title: string;
  @IsOptional() @IsString() @MaxLength(4000) notes?: string;
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ExerciseDto)
  exercises: ExerciseDto[];
}
export class UpdateWorkoutDto extends PartialType(
  OmitType(WorkoutDto, ['memberId'] as const),
  { skipNullProperties: false },
) {}
export class KnowledgeDto {
  @IsString() @MinLength(2) @MaxLength(150) title: string;
  @IsString() @MinLength(2) @MaxLength(50) category: string;
  @IsString() @MinLength(10) @MaxLength(10000) instructions: string;
}

export class WorkoutTemplatesQueryDto {
  @IsOptional()
  @IsString()
  discipline?: string;
}

export class AssignTemplateDto {
  @IsUUID()
  bookingId: string;

  @IsOptional()
  @IsString()
  templateCode?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  sessionOrder?: number;
}
