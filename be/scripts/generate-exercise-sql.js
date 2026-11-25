const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function seedId(...parts) {
  const hex = crypto
    .createHash('sha256')
    .update('sportscenter-seed:' + parts.join(':'))
    .digest('hex');
  return (
    hex.slice(0, 8) +
    '-' +
    hex.slice(8, 12) +
    '-4' +
    hex.slice(13, 16) +
    '-a' +
    hex.slice(17, 20) +
    '-' +
    hex.slice(20, 32)
  );
}

const catalogPath = path.join(__dirname, '../prisma/data/exercise_catalog.json');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

let sql = '-- SEED DATA FOR EXERCISE_KNOWLEDGE (SUPABASE)\n';
sql += '-- Generated for 84 exercises in Gym, Boxing, Yoga\n\n';

for (const item of catalog) {
  const id = seedId('exercise', item.exercise_id);
  const title = `${item.name_vi} (${item.name_en})`.replace(/'/g, "''");
  const cat = item.category.replace(/'/g, "''");
  const inst = `[Code: ${item.exercise_id}] [Môn: ${item.discipline}] [Nhóm cơ: ${item.primary_muscle}] [Thiết bị: ${item.equipment}] [Đơn vị: ${item.unit}]`.replace(/'/g, "''");

  sql += `INSERT INTO exercise_knowledge (id, title, category, instructions)\n`;
  sql += `VALUES ('${id}', '${title}', '${cat}', '${inst}')\n`;
  sql += `ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, instructions = EXCLUDED.instructions;\n\n`;
}

const outPath = path.join(__dirname, '../prisma/data/seed_exercise_catalog.sql');
fs.writeFileSync(outPath, sql, 'utf8');
console.log('SQL generated successfully! Items:', catalog.length);
