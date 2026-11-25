import { PrismaClient } from '@prisma/client';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

const prisma = new PrismaClient();

export function seedId(...parts: string[]) {
  const hex = createHash('sha256')
    .update(`sportscenter-seed:${parts.join(':')}`)
    .digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export interface ExerciseItem {
  exercise_id: string;
  name_vi: string;
  name_en: string;
  category: string;
  primary_muscle: string;
  equipment: string;
  unit: string;
  discipline: string;
}

async function main() {
  const filePath = path.join(__dirname, '../prisma/data/exercise_catalog.json');
  const raw = fs.readFileSync(filePath, 'utf-8');
  const catalog: ExerciseItem[] = JSON.parse(raw);

  console.log(`Bắt đầu nạp ${catalog.length} bài tập vào bảng exercise_knowledge...`);

  let count = 0;
  for (const item of catalog) {
    const id = seedId('exercise', item.exercise_id);
    const title = `${item.name_vi} (${item.name_en})`;
    const instructions = `[Code: ${item.exercise_id}] [Môn: ${item.discipline}] [Nhóm cơ: ${item.primary_muscle}] [Thiết bị: ${item.equipment}] [Đơn vị: ${item.unit}]`;

    await prisma.exerciseKnowledge.upsert({
      where: { id },
      update: {
        title,
        category: item.category,
        instructions,
      },
      create: {
        id,
        title,
        category: item.category,
        instructions,
      },
    });
    count++;
  }

  console.log(`Đã nạp/cập nhật thành công ${count} bài tập vào Supabase (exercise_knowledge)!`);
}

if (require.main === module) {
  main()
    .catch((e) => {
      console.error('Lỗi khi nạp bài tập:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
