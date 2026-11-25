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
import { PartialType, OmitType, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export class WorkoutPlanListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filter by member ID' })
  @IsOptional()
  @IsUUID()
  memberId?: string;

  @ApiPropertyOptional({ description: 'Filter by coach ID' })
  @IsOptional()
  @IsUUID()
  coachId?: string;
}

export class ExerciseKnowledgeQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Number of items per page', default: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  override limit?: number = 200;

  @ApiPropertyOptional({ description: 'Search title or instructions' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ description: 'Filter by muscle category' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Filter by discipline (GYM, BOXING, YOGA)' })
  @IsOptional()
  @IsString()
  discipline?: string;
}
export class ExerciseDto {
  @IsUUID() exerciseId: string;
  @IsOptional() @IsInt() @Min(1) @Max(100) sets?: number;
  @IsOptional() @IsInt() @Min(1) @Max(1000) reps?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(999) weightKg?: number;
  @IsOptional() @IsInt() @Min(0) @Max(3600) restSeconds?: number;
  @IsOptional() @IsString() @MaxLength(4000) coachFeedback?: string;
}
export class WorkoutDto {
  @IsOptional() @IsUUID() memberId?: string;
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
