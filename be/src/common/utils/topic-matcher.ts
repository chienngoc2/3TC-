export enum CourseSpecialtyCode {
  // Yoga (3 chuyên đề khớp 1-1 với 3 gói khóa học Yoga)
  SPEC_YOGA_THERAPY = 'SPEC_YOGA_THERAPY',
  SPEC_YOGA_MEDITATION = 'SPEC_YOGA_MEDITATION',
  SPEC_YOGA_STRENGTH = 'SPEC_YOGA_STRENGTH',
  // Boxing (3 chuyên đề khớp 1-1 với 3 gói khóa học Boxing)
  SPEC_BOXING_BASIC = 'SPEC_BOXING_BASIC',
  SPEC_BOXING_FITNESS = 'SPEC_BOXING_FITNESS',
  SPEC_BOXING_SPARRING = 'SPEC_BOXING_SPARRING',
  // Gym (Chuyên môn PT 1:1)
  SPEC_GYM_STRENGTH = 'SPEC_GYM_STRENGTH',
  SPEC_GYM_WEIGHTLOSS = 'SPEC_GYM_WEIGHTLOSS',
}

export const SPECIALTY_NAME_MAP: Record<string, string> = {
  SPEC_YOGA_THERAPY: 'Khóa Học Yoga Trị Liệu & Phục Hồi Cột Sống',
  SPEC_YOGA_MEDITATION: 'Khóa Học Yoga Dưỡng Sinh & Thiền Khí Công',
  SPEC_YOGA_STRENGTH: 'Khóa Học Yoga Thể Lực & Thi Đấu Nâng Cao',
  SPEC_BOXING_BASIC: 'Khóa Học Boxing Căn Bản Cho Người Mới',
  SPEC_BOXING_FITNESS: 'Khóa Học Cardio Boxing Thể Lực & Đốt Mỡ Chuyên Sâu',
  SPEC_BOXING_SPARRING: 'Khóa Học Kickboxing Đối Kháng & Tự Vệ Thực Chiến',
  SPEC_GYM_STRENGTH: 'Huấn Luyện Thể Lực & Tăng Cơ (PT Gym 1:1)',
  SPEC_GYM_WEIGHTLOSS: 'Huấn Luyện Giảm Mỡ & Định Hình Cơ Thể (PT Gym 1:1)',
  // Fallbacks for backward compatibility
  SPEC_BOX_KB: 'Khóa Học Boxing Căn Bản Cho Người Mới',
  SPEC_YOG_AS: 'Khóa Học Yoga Trị Liệu & Phục Hồi Cột Sống',
  SPEC_GYM_BB: 'Huấn Luyện Thể Lực & Tăng Cơ (PT Gym 1:1)',
};

/**
 * Determine the Course Specialty Code of a Membership Plan based on its title/topics.
 */
export function getPlanSpecialtyCode(planName: string, disciplineCode?: string): string | null {
  const name = (planName || '').toLowerCase();
  const disc = (disciplineCode || '').toUpperCase();

  if (name.includes('trị liệu') || name.includes('phục hồi') || name.includes('cột sống')) {
    return CourseSpecialtyCode.SPEC_YOGA_THERAPY;
  }
  if (name.includes('dưỡng sinh') || name.includes('thiền') || name.includes('khí công')) {
    return CourseSpecialtyCode.SPEC_YOGA_MEDITATION;
  }
  if (
    (disc === 'YOGA' || name.includes('yoga')) &&
    (name.includes('thể lực') || name.includes('thi đấu') || name.includes('nâng cao') || name.includes('power') || name.includes('sức bền'))
  ) {
    return CourseSpecialtyCode.SPEC_YOGA_STRENGTH;
  }
  if (name.includes('căn bản') || name.includes('người mới') || name.includes('bộ pháp') || name.includes('đòn tay')) {
    return CourseSpecialtyCode.SPEC_BOXING_BASIC;
  }
  if (name.includes('đốt mỡ') || name.includes('cardio boxing') || name.includes('phản xạ') || (name.includes('boxing') && name.includes('thể lực'))) {
    return CourseSpecialtyCode.SPEC_BOXING_FITNESS;
  }
  if (name.includes('sparring') || name.includes('đối kháng') || name.includes('kickboxing') || name.includes('tự vệ') || name.includes('thực chiến')) {
    return CourseSpecialtyCode.SPEC_BOXING_SPARRING;
  }
  if (name.includes('tăng cơ') || name.includes('hypertrophy') || name.includes('strength')) {
    return CourseSpecialtyCode.SPEC_GYM_STRENGTH;
  }
  if (name.includes('giảm mỡ') || name.includes('định hình') || name.includes('weight loss')) {
    return CourseSpecialtyCode.SPEC_GYM_WEIGHTLOSS;
  }

  return null;
}

/**
 * Determine the Course Specialty Code of a Class based on its name.
 */
export function getClassSpecialtyCode(className: string, disciplineCode?: string): string | null {
  const name = (className || '').toLowerCase();

  if (
    name.includes('trị liệu') ||
    name.includes('cột sống') ||
    name.includes('cổ vai gáy') ||
    name.includes('deep stretch') ||
    name.includes('giãn cơ')
  ) {
    return CourseSpecialtyCode.SPEC_YOGA_THERAPY;
  }

  if (
    name.includes('dưỡng sinh') ||
    name.includes('thiền') ||
    name.includes('pranayama') ||
    name.includes('yin yoga') ||
    name.includes('khai mạc')
  ) {
    return CourseSpecialtyCode.SPEC_YOGA_MEDITATION;
  }

  if (
    name.includes('thể lực') ||
    name.includes('thi đấu') ||
    name.includes('nâng cao') ||
    name.includes('power') ||
    name.includes('sức bền') ||
    name.includes('core') ||
    name.includes('vinyasa flow')
  ) {
    return CourseSpecialtyCode.SPEC_YOGA_STRENGTH;
  }

  if (name.includes('căn bản') || name.includes('người mới') || name.includes('bộ pháp') || name.includes('đòn tay')) {
    return CourseSpecialtyCode.SPEC_BOXING_BASIC;
  }

  if (name.includes('đốt mỡ') || name.includes('cardio') || name.includes('phản xạ')) {
    return CourseSpecialtyCode.SPEC_BOXING_FITNESS;
  }

  if (name.includes('sparring') || name.includes('đối kháng') || name.includes('kickboxing') || name.includes('tự vệ') || name.includes('thực chiến')) {
    return CourseSpecialtyCode.SPEC_BOXING_SPARRING;
  }

  return null;
}

/**
 * Checks whether a class is compatible with a member's group plan.
 */
export function isClassCompatibleWithPlan(
  className: string,
  planName: string,
  disciplineCode?: string,
): { isCompatible: boolean; planSpecialtyName?: string; classSpecialtyName?: string } {
  const planSpec = getPlanSpecialtyCode(planName, disciplineCode);
  const classSpec = getClassSpecialtyCode(className, disciplineCode);

  // If the plan has no specialized constraint (e.g. generic drop-in or VIP), it is compatible
  if (!planSpec) {
    return { isCompatible: true };
  }

  // If the class has a specific specialty, it must match the plan's specialty
  if (classSpec) {
    const isCompatible = planSpec === classSpec;
    return {
      isCompatible,
      planSpecialtyName: SPECIALTY_NAME_MAP[planSpec] || planSpec,
      classSpecialtyName: SPECIALTY_NAME_MAP[classSpec] || classSpec,
    };
  }

  // For general weekly classes that don't specify a topic, allow if same discipline
  return { isCompatible: true };
}

/**
 * Checks whether a coach is certified/authorized to teach a class specialty.
 */
export function isCoachQualifiedForSpecialty(
  coachSpecialtyCodes: string[],
  targetSpecialtyCode: string | null,
  disciplineCode?: string,
): boolean {
  if (!targetSpecialtyCode) return true;
  if (!coachSpecialtyCodes || coachSpecialtyCodes.length === 0) return false;

  // Direct specialty match
  if (coachSpecialtyCodes.includes(targetSpecialtyCode)) return true;

  return false;
}

/**
 * Returns the single dedicated room name for a course specialty or class name.
 * Each course type has strictly 1 dedicated room with capacity 5.
 */
export function getSpecialtyDedicatedRoomName(
  classNameOrSpecCode: string,
  _disciplineCode?: string,
): string {
  const code = (classNameOrSpecCode || '').toUpperCase();
  const name = (classNameOrSpecCode || '').toLowerCase();

  if (
    code === 'SPEC_YOGA_THERAPY' ||
    name.includes('trị liệu') ||
    name.includes('cột sống') ||
    name.includes('cổ vai gáy') ||
    name.includes('giãn cơ') ||
    name.includes('deep stretch')
  ) {
    return 'Phòng Yoga Trị Liệu & Phục Hồi';
  }

  if (
    code === 'SPEC_YOGA_MEDITATION' ||
    name.includes('dưỡng sinh') ||
    name.includes('thiền') ||
    name.includes('pranayama') ||
    name.includes('yin yoga') ||
    name.includes('khai mạc')
  ) {
    return 'Phòng Yoga Dưỡng Sinh & Thiền';
  }

  if (
    code === 'SPEC_YOGA_STRENGTH' ||
    name.includes('thể lực') ||
    name.includes('thi đấu') ||
    name.includes('power') ||
    name.includes('sức bền') ||
    name.includes('core') ||
    name.includes('năng động')
  ) {
    return 'Phòng Yoga Thể Lực & Thi Đấu';
  }

  if (
    code === 'SPEC_YOGA_FOUNDATION' ||
    name.includes('hatha') ||
    name.includes('nền tảng') ||
    name.includes('yoga căn bản')
  ) {
    return 'Phòng Hatha Yoga Căn Bản';
  }

  if (
    code === 'SPEC_BOXING_BASIC' ||
    code === 'SPEC_BOX_KB' ||
    name.includes('boxing căn bản') ||
    name.includes('người mới') ||
    name.includes('bộ pháp') ||
    name.includes('đòn tay') ||
    name.includes('weekly group class')
  ) {
    return 'Phòng Boxing Căn Bản';
  }

  if (
    code === 'SPEC_BOXING_SPARRING' ||
    name.includes('sparring') ||
    name.includes('đối kháng') ||
    name.includes('thi đấu')
  ) {
    return 'Phòng Boxing Sparring & Đối Kháng';
  }

  if (
    code === 'SPEC_BOXING_FITNESS' ||
    name.includes('đốt mỡ') ||
    name.includes('kickboxing') ||
    name.includes('cardio') ||
    name.includes('phản xạ')
  ) {
    return 'Phòng Cardio Boxing & Đốt Mỡ';
  }

  if (
    code === 'SPEC_GYM_STRENGTH' ||
    code === 'SPEC_GYM_WEIGHTLOSS' ||
    name.includes('pt') ||
    name.includes('kèm riêng')
  ) {
    return 'Khu Vực PT Gym Kèm Riêng 1-1';
  }

  return 'Khu Tập Gym Tự Do';
}
