import type { Coach } from '@/features/coaches/types/coach.types';
import type { Plan } from '@/lib/types';

export const CourseSpecialtyCode = {
  // Yoga (3 chuyên đề khớp 1-1 với 3 gói khóa học Yoga)
  SPEC_YOGA_THERAPY: 'SPEC_YOGA_THERAPY',
  SPEC_YOGA_MEDITATION: 'SPEC_YOGA_MEDITATION',
  SPEC_YOGA_STRENGTH: 'SPEC_YOGA_STRENGTH',
  // Boxing (3 chuyên đề khớp 1-1 với 3 gói khóa học Boxing)
  SPEC_BOXING_BASIC: 'SPEC_BOXING_BASIC',
  SPEC_BOXING_FITNESS: 'SPEC_BOXING_FITNESS',
  SPEC_BOXING_SPARRING: 'SPEC_BOXING_SPARRING',
  // Gym (Chuyên môn PT 1:1 duy nhất)
  SPEC_GYM_PT: 'SPEC_GYM_PT',
  SPEC_GYM_STRENGTH: 'SPEC_GYM_STRENGTH',
  SPEC_GYM_WEIGHTLOSS: 'SPEC_GYM_WEIGHTLOSS',
} as const;

export type CourseSpecialtyCode = (typeof CourseSpecialtyCode)[keyof typeof CourseSpecialtyCode];

export const SPECIALTY_NAME_MAP: Record<string, string> = {
  SPEC_YOGA_THERAPY: 'Khóa Học Yoga Trị Liệu & Phục Hồi Cột Sống',
  SPEC_YOGA_MEDITATION: 'Khóa Học Yoga Dưỡng Sinh & Thiền Khí Công',
  SPEC_YOGA_STRENGTH: 'Khóa Học Yoga Thể Lực & Thi Đấu Nâng Cao',
  SPEC_BOXING_BASIC: 'Khóa Học Boxing Căn Bản Cho Người Mới',
  SPEC_BOXING_FITNESS: 'Khóa Học Cardio Boxing Thể Lực & Đốt Mỡ Chuyên Sâu',
  SPEC_BOXING_SPARRING: 'Khóa Học Kickboxing Đối Kháng & Tự Vệ Thực Chiến',
  SPEC_GYM_PT: 'Huấn Luyện Gym PT 1:1',
  SPEC_GYM_STRENGTH: 'Huấn Luyện Gym PT 1:1',
  SPEC_GYM_WEIGHTLOSS: 'Huấn Luyện Gym PT 1:1',
  // Fallbacks for backward compatibility
  SPEC_BOX_KB: 'Khóa Học Boxing Căn Bản Cho Người Mới',
  SPEC_YOG_AS: 'Khóa Học Yoga Trị Liệu & Phục Hồi Cột Sống',
  SPEC_GYM_BB: 'Huấn Luyện Gym PT 1:1',
};

/**
 * Identify the specialty code for a membership plan by its title/description.
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
  if (
    disc === 'GYM' ||
    name.includes('gym') ||
    name.includes('pt') ||
    name.includes('tăng cơ') ||
    name.includes('giảm mỡ') ||
    name.includes('hypertrophy') ||
    name.includes('strength') ||
    name.includes('định hình') ||
    name.includes('weight loss')
  ) {
    return CourseSpecialtyCode.SPEC_GYM_PT;
  }

  return null;
}

/**
 * Determine the Course Specialty Code of a Class based on its name.
 */
export function getClassSpecialtyCode(className: string, _disciplineCode?: string): string | null {
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
    name.includes('vinyasa')
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
  const cleanPlan = (planName || '').toLowerCase().replace(/\s*\(\s*\d+\s*buổi[^)]*\)/i, '').trim();
  const cleanClass = (className || '').toLowerCase().replace(/\s*\(\s*\d+\s*buổi[^)]*\)/i, '').trim();

  if (
    cleanPlan &&
    cleanClass &&
    (cleanPlan === cleanClass || cleanClass.includes(cleanPlan) || cleanPlan.includes(cleanClass))
  ) {
    return { isCompatible: true };
  }

  const planSpec = getPlanSpecialtyCode(planName, disciplineCode);
  const classSpec = getClassSpecialtyCode(className, disciplineCode);

  if (!planSpec) return { isCompatible: true };
  if (classSpec) {
    return {
      isCompatible: planSpec === classSpec,
      planSpecialtyName: SPECIALTY_NAME_MAP[planSpec] || planSpec,
      classSpecialtyName: SPECIALTY_NAME_MAP[classSpec] || classSpec,
    };
  }
  return { isCompatible: true };
}

/**
 * Checks if a coach is qualified for a specific plan.
 */
export function isCoachQualifiedForPlan(coach: Coach, plan: Plan): boolean {
  if (!coach || !plan) return false;

  const planDiscCode = (
    plan.discipline?.code ||
    (plan.discipline?.name?.toLowerCase().includes('yoga') ? 'YOGA' : '') ||
    (plan.discipline?.name?.toLowerCase().includes('box') ? 'BOXING' : '') ||
    (plan.discipline?.name?.toLowerCase().includes('gym') ? 'GYM' : '') ||
    ''
  ).toUpperCase();

  // Membership / self-workout packages (e.g. Gym Trial, Gym Plus, standard gym access)
  // have 0 coach quota and are never directly instructed by a coach.
  const hasGroupSessions =
    (plan.groupSessionQuota ?? 0) > 0 ||
    plan.trainingMode === 'GROUP_CLASS' ||
    (plan.packageTier === 'PLUS' && planDiscCode !== 'GYM');

  const hasPtSessions =
    (plan.ptSessionQuota ?? 0) > 0 ||
    plan.trainingMode === 'PERSONAL_TRAINING' ||
    (plan.packageTier === 'VIP' && (planDiscCode === 'GYM' || plan.name.toLowerCase().includes('gym')));

  if (!hasGroupSessions && !hasPtSessions) {
    return false;
  }

  // Collect coach's assigned specialty codes and discipline codes
  const coachSpecs = coach.coachProfile?.coachSpecialties || [];
  const coachSpecCodes = coachSpecs.map((s) => s.specialty?.code?.toUpperCase() || '');
  const coachSpecNames = coachSpecs.map((s) => (s.specialty?.name || '').toLowerCase());
  const coachDiscCodes = (coach.disciplineCodes || []).map((c) => c.toUpperCase());
  if (coach.primaryDiscipline) coachDiscCodes.push(coach.primaryDiscipline.toUpperCase());
  if (coach.coachRates?.some((r) => r.discipline?.code === 'GYM')) coachDiscCodes.push('GYM');
  if (coach.coachRates?.some((r) => r.discipline?.code === 'YOGA')) coachDiscCodes.push('YOGA');
  if (coach.coachRates?.some((r) => r.discipline?.code === 'BOXING')) coachDiscCodes.push('BOXING');

  // Strict discipline check: coach must instruct this plan's discipline
  const isDiscMatched =
    coachDiscCodes.includes(planDiscCode) ||
    coachSpecs.some((s) => s.specialty?.disciplineId === (plan.disciplineId || plan.discipline?.id)) ||
    (planDiscCode === 'YOGA' && coachDiscCodes.includes('YOGA')) ||
    (planDiscCode === 'BOXING' && coachDiscCodes.includes('BOXING')) ||
    (planDiscCode === 'GYM' && coachDiscCodes.includes('GYM'));

  if (!isDiscMatched) {
    return false;
  }

  // 1. Group Plans: Must match the specific specialty of the group course
  if (hasGroupSessions) {
    // Direct match: Coach has assigned specialty matching plan's name
    const cleanPlan = (plan.name || '').toLowerCase().replace(/\s*\(\s*\d+\s*buổi[^)]*\)/i, '').trim();
    const hasDirectSpecialty = coachSpecs.some((cs) => {
      const sName = (cs.specialty?.name || '').toLowerCase().trim();
      return sName && (sName === cleanPlan || cleanPlan.includes(sName) || sName.includes(cleanPlan));
    });
    if (hasDirectSpecialty) {
      return true;
    }

    const planSpec = getPlanSpecialtyCode(plan.name, planDiscCode);
    if (planSpec) {
      if (coachSpecCodes.includes(planSpec)) return true;
      if (planSpec === CourseSpecialtyCode.SPEC_YOGA_THERAPY && coachSpecNames.some((n) => n.includes('trị liệu') || n.includes('cột sống'))) return true;
      if (planSpec === CourseSpecialtyCode.SPEC_YOGA_MEDITATION && coachSpecNames.some((n) => n.includes('dưỡng sinh') || n.includes('thiền'))) return true;
      if (planSpec === CourseSpecialtyCode.SPEC_YOGA_STRENGTH && coachSpecNames.some((n) => n.includes('thể lực') || n.includes('thi đấu') || n.includes('nâng cao') || n.includes('power'))) return true;
      if (planSpec === CourseSpecialtyCode.SPEC_BOXING_BASIC && (coachSpecCodes.includes('SPEC_BOX_KB') || coachSpecNames.some((n) => n.includes('căn bản') || n.includes('người mới')))) return true;
      if (planSpec === CourseSpecialtyCode.SPEC_BOXING_SPARRING && coachSpecNames.some((n) => n.includes('sparring') || n.includes('đối kháng') || n.includes('tự vệ') || n.includes('thực chiến'))) return true;
      if (planSpec === CourseSpecialtyCode.SPEC_BOXING_FITNESS && coachSpecNames.some((n) => n.includes('đốt mỡ') || n.includes('cardio') || n.includes('kickboxing'))) return true;
      
      return false;
    }

    return isDiscMatched;
  }

  // 2. VIP 1:1 Plans: Coach must actually teach this discipline
  if (hasPtSessions) {
    const isGymCoach =
      coachDiscCodes.includes('GYM') ||
      coachSpecCodes.some((c) => c.includes('GYM')) ||
      coachSpecNames.some((n) => n.includes('tăng cơ') || n.includes('giảm mỡ') || n.includes('gym'));

    const hasOnlyOtherDisciplines =
      (coachDiscCodes.includes('YOGA') || coachSpecCodes.some((c) => c.includes('YOGA'))) &&
      !coachDiscCodes.includes('GYM') &&
      !coachSpecCodes.some((c) => c.includes('GYM'));

    if (hasOnlyOtherDisciplines) return false;
    return isGymCoach;
  }

  return false;
}

/**
 * Filter all coaches qualified for a given plan.
 */
export function getCoachesForPlan(plan: Plan, coaches: Coach[]): Coach[] {
  if (!plan || !Array.isArray(coaches)) return [];
  return coaches.filter((c) => isCoachQualifiedForPlan(c, plan));
}

/**
 * Get all plans that a given coach is qualified to teach.
 */
export function getPlansForCoach(coach: Coach, plans: Plan[]): Plan[] {
  if (!coach || !Array.isArray(plans)) return [];
  return plans.filter((p) => p.isActive && isCoachQualifiedForPlan(coach, p));
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
    code === 'SPEC_GYM_PT' ||
    code === 'SPEC_GYM_STRENGTH' ||
    code === 'SPEC_GYM_WEIGHTLOSS' ||
    name.includes('pt') ||
    name.includes('kèm riêng')
  ) {
    return 'Khu Vực PT Gym Kèm Riêng 1-1';
  }

  return 'Khu Tập Gym Tự Do';
}
