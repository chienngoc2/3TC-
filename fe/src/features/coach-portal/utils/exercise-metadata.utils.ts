export interface ParsedExerciseMetadata {
  code?: string;
  discipline?: 'GYM' | 'BOXING' | 'YOGA' | string;
  muscle?: string;
  muscleVi: string;
  equipment?: string;
  equipmentVi: string;
  unit?: string;
  unitVi: string;
  instructionsText: string;
}

export const MUSCLE_TRANSLATIONS: Record<string, string> = {
  glutes: 'Cơ mông',
  legs: 'Cơ chân / Đùi',
  quads: 'Cơ đùi trước',
  hamstrings: 'Cơ đùi sau',
  calves: 'Bắp chân',
  chest: 'Cơ ngực',
  upper_chest: 'Cơ ngực trên',
  back: 'Cơ lưng / Xô',
  lats: 'Cơ xô',
  core: 'Cơ bụng / Lõi',
  abs: 'Cơ bụng',
  arms: 'Cơ tay',
  biceps: 'Bắp tay trước',
  triceps: 'Bắp tay sau',
  shoulders: 'Cơ vai',
  full_body: 'Toàn thân',
  cardio: 'Tim mạch / Sức bền',
  hips: 'Khớp háng / Hông',
  spine: 'Cột sống',
  balance: 'Thăng bằng',
  mobility: 'Linh hoạt',
  flexibility: 'Dẻo dai',
  neck: 'Cơ cổ',
  breath: 'Điều hòa hơi thở',
  relax: 'Thư giãn / Phục hồi',
};

export const EQUIPMENT_TRANSLATIONS: Record<string, string> = {
  yoga_mat: 'Thảm Yoga',
  barbell: 'Tạ đòn (Barbell)',
  dumbbell: 'Tạ đơn (Dumbbell)',
  cable_machine: 'Máy kéo cáp',
  machine: 'Máy tập đa năng',
  assist_machine: 'Máy kéo trợ lực',
  bodyweight: 'Trọng lượng cơ thể',
  treadmill: 'Máy chạy bộ',
  boxing_gloves: 'Găng Boxing',
  punching_bag: 'Bao cát',
  heavy_bag: 'Bao cát nặng',
  focus_mitts: 'Lơ đấm (Focus Mitts)',
  gloves_headgear: 'Găng & Giáp bảo hộ',
  jump_rope: 'Dây nhảy',
  kettlebell: 'Tạ bình vôi',
  resistance_band: 'Dây kháng lực',
  medicine_ball: 'Bóng thể lực',
  bench: 'Ghế tập',
  pullup_bar: 'Xà đơn',
  pull_up_bar: 'Xà đơn',
};

export const UNIT_TRANSLATIONS: Record<string, string> = {
  seconds: 'giây',
  second: 'giây',
  sec: 'giây',
  reps: 'lần',
  rep: 'lần',
  minutes: 'phút',
  minute: 'phút',
  min: 'phút',
  rounds: 'vòng',
  round: 'vòng',
};

export const CATEGORY_TRANSLATIONS: Record<string, string> = {
  // === GYM Topics ===
  chest: 'Cơ Ngực',
  back: 'Cơ Lưng - Xô',
  legs: 'Cơ Đùi & Mông',
  shoulders: 'Cơ Vai',
  arms: 'Cơ Tay',
  core: 'Cơ Bụng & Cơ Lõi',
  cardio_warmup: 'Cardio & Khởi Động',

  // === BOXING Topics ===
  punches: 'Đòn Tay Cơ Bản & Tổ Hợp',
  footwork: 'Bộ Pháp & Di Chuyển',
  defense: 'Phòng Thủ & Phản Đòn',
  pad_bag: 'Bao Cát & Đích Đấm',
  conditioning: 'Thể Lực & Sức Bền',

  // === YOGA Topics ===
  standing_balance: 'Tư Thế Đứng & Thăng Bằng',
  backbends_seated: 'Uốn Lưng & Mở Ngực',
  core_flow: 'Cơ Lõi & Chuỗi Động Tác',
  flexibility_hips: 'Giãn Cơ & Mở Hông',
  recovery_breath: 'Phục Hồi, Hơi Thở & Thiền',

  // Legacy mappings for backwards compatibility
  warmup: 'Khởi động',
  warm_up: 'Khởi động',
  technique: 'Kỹ thuật',
  cardio: 'Cardio & Thể lực',
  strength: 'Sức mạnh',
  power: 'Bùng nổ',
  recovery: 'Phục hồi',
  cooldown: 'Thả lỏng',
  cool_down: 'Thả lỏng',
  sparring: 'Đối kháng',
  yoga_pose: 'Tư thế Yoga',
  yogapose: 'Tư thế Yoga',
  pose: 'Tư thế Yoga',
  balance: 'Thăng bằng',
  mobility: 'Linh hoạt',
  flexibility: 'Dẻo dai',
};

export function getTemplateTopic(tpl?: { title?: string; disciplineCode?: string; description?: string }): string {
  if (!tpl) return 'Chủ đề chung';
  const d = (tpl.disciplineCode || '').toUpperCase();
  const t = (tpl.title || '').toLowerCase();
  if (d === 'BOXING') {
    if (t.includes('jab') || t.includes('hook') || t.includes('uppercut') || t.includes('combo')) return 'Đòn Tay & Tổ Hợp';
    if (t.includes('phòng thủ') || t.includes('di chuyển') || t.includes('bộ pháp')) return 'Bộ Pháp & Phòng Thủ';
    if (t.includes('bao') || t.includes('pad') || t.includes('bia')) return 'Bao Cát & Đích Đấm';
    if (t.includes('thể lực') || t.includes('cardio') || t.includes('hiit') || t.includes('sức bền')) return 'Thể Lực & Sức Bền';
    if (t.includes('sparring') || t.includes('tổng hợp')) return 'Đối Kháng & Tổng Hợp';
    return 'Kỹ Thuật Boxing';
  }
  if (d === 'YOGA') {
    if (t.includes('hơi thở') || t.includes('phục hồi') || t.includes('pranayama')) return 'Phục Hồi & Thiền Thở';
    if (t.includes('mặt trời') || t.includes('flow')) return 'Chuỗi Động Tác Flow';
    if (t.includes('đứng') || t.includes('thăng bằng')) return 'Tư Thế Đứng & Thăng Bằng';
    if (t.includes('hông') || t.includes('giãn') || t.includes('linh hoạt')) return 'Giãn Cơ & Mở Hông';
    if (t.includes('core') || t.includes('lưng') || t.includes('uốn')) return 'Cơ Lõi & Uốn Lưng';
    return 'Tư Thế Yoga Chuẩn';
  }
  if (d === 'GYM') {
    if (t.includes('ngực')) return 'Cơ Ngực';
    if (t.includes('lưng') || t.includes('xô')) return 'Cơ Lưng - Xô';
    if (t.includes('chân') || t.includes('đùi') || t.includes('mông')) return 'Cơ Đùi & Mông';
    if (t.includes('vai')) return 'Cơ Vai';
    if (t.includes('tay')) return 'Cơ Tay';
    if (t.includes('bụng') || t.includes('core')) return 'Cơ Bụng & Lõi';
    return 'Thể Hình & Sức Mạnh';
  }
  return 'Giáo Án Mẫu';
}

export function translateCategory(cat?: string): string {
  if (!cat) return 'Chung';
  const lower = cat.toLowerCase().trim().replace(/[- ]+/g, '_');
  return CATEGORY_TRANSLATIONS[lower] || cat;
}

export function parseExerciseTitle(title?: string): { primary: string; secondary?: string } {
  if (!title) return { primary: 'Bài tập' };
  const trimmed = title.trim();
  const match = trimmed.match(/^(.*?)\s*\((.*?)\)$/);
  if (match) {
    const p1 = match[1].trim();
    const p2 = match[2].trim();
    if (p1.toLowerCase() === p2.toLowerCase()) {
      return { primary: p1 };
    }
    return { primary: p1, secondary: p2 };
  }
  return { primary: trimmed };
}

export function formatCleanTitle(title?: string): string {
  const { primary } = parseExerciseTitle(title);
  return primary;
}

export function parseExerciseInstructions(raw?: string): ParsedExerciseMetadata {
  if (!raw) {
    return {
      muscleVi: 'Chung',
      equipmentVi: 'Không yêu cầu',
      unitVi: 'lần',
      instructionsText: '',
    };
  }

  const codeMatch = raw.match(/\[Code:\s*([^\]]+)\]/i);
  const monMatch = raw.match(/\[Môn:\s*([^\]]+)\]/i);
  const nhomCoMatch = raw.match(/\[Nhóm cơ:\s*([^\]]+)\]/i);
  const thietBiMatch = raw.match(/\[Thiết bị:\s*([^\]]+)\]/i);
  const donViMatch = raw.match(/\[Đơn vị:\s*([^\]]+)\]/i);

  const code = codeMatch ? codeMatch[1].trim() : undefined;
  const discipline = monMatch ? monMatch[1].trim().toUpperCase() : undefined;
  const rawMuscle = nhomCoMatch ? nhomCoMatch[1].trim().toLowerCase() : undefined;
  const rawEquipment = thietBiMatch ? thietBiMatch[1].trim().toLowerCase() : undefined;
  const rawUnit = donViMatch ? donViMatch[1].trim().toLowerCase() : undefined;

  const instructionsText = raw
    .replace(/\[(Code|Môn|Nhóm cơ|Thiết bị|Đơn vị):[^\]]+\]/gi, '')
    .trim();

  const muscleVi =
    (rawMuscle && MUSCLE_TRANSLATIONS[rawMuscle]) ||
    (rawMuscle ? rawMuscle.replace(/_/g, ' ') : 'Chung');

  const equipmentVi =
    (rawEquipment && EQUIPMENT_TRANSLATIONS[rawEquipment]) ||
    (rawEquipment ? rawEquipment.replace(/_/g, ' ') : 'Không yêu cầu');

  const unitVi =
    (rawUnit && UNIT_TRANSLATIONS[rawUnit]) ||
    (rawUnit ? rawUnit.replace(/_/g, ' ') : 'lần');

  return {
    code,
    discipline,
    muscle: rawMuscle,
    muscleVi,
    equipment: rawEquipment,
    equipmentVi,
    unit: rawUnit,
    unitVi,
    instructionsText,
  };
}

export function getExerciseDiscipline(ex?: {
  instructions?: string;
  category?: string;
  title?: string;
}): 'BOXING' | 'YOGA' | 'GYM' {
  if (!ex) return 'GYM';
  const meta = parseExerciseInstructions(ex.instructions);
  if (meta.discipline) {
    const d = meta.discipline.toUpperCase();
    if (d === 'BOXING' || d === 'YOGA' || d === 'GYM') return d;
  }
  const cat = (ex.category || '').toLowerCase().trim();
  if (
    cat.includes('boxing') ||
    cat === 'sparring' ||
    ['punches', 'footwork', 'defense', 'pad_bag', 'conditioning'].includes(cat)
  ) {
    return 'BOXING';
  }
  if (
    cat.includes('yoga') ||
    cat === 'yoga_pose' ||
    ['standing_balance', 'backbends_seated', 'core_flow', 'recovery_breath', 'flexibility_hips'].includes(cat)
  ) {
    return 'YOGA';
  }
  if (['chest', 'back', 'legs', 'shoulders', 'arms', 'core', 'cardio_warmup'].includes(cat)) {
    return 'GYM';
  }
  const title = (ex.title || '').toLowerCase();
  if (
    title.includes('boxing') ||
    title.includes('đấm') ||
    title.includes('jab') ||
    title.includes('hook') ||
    title.includes('uppercut') ||
    title.includes('mitt') ||
    title.includes('găng') ||
    title.includes('bao cát')
  ) {
    return 'BOXING';
  }
  if (title.includes('yoga') || title.includes('chiến binh') || title.includes('tư thế')) {
    return 'YOGA';
  }
  return 'GYM';
}
