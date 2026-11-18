export interface SegmentalLeanInput {
  [key: string]: any;
  rightArm?: number | null;
  leftArm?: number | null;
  trunk?: number | null;
  rightLeg?: number | null;
  leftLeg?: number | null;
}

export interface InbodyCalculationInput {
  heightCm: number;
  weightKg: number;
  bodyFatPct?: number | null;
  skeletalMuscleMassKg?: number | null;
  muscleMassKg?: number | null;
  tbwLiters?: number | null;
  proteinKg?: number | null;
  mineralKg?: number | null;
  visceralFatLevel?: number | null;
  waistHipRatio?: number | null;
  inbodyScore?: number | null;
  segmentalLean?: SegmentalLeanInput | null;
  gender?: string | null;
  age?: number | null;
}

export interface ImbalanceItem {
  zone: 'ARMS' | 'LEGS';
  leftValue: number;
  rightValue: number;
  imbalancePct: number;
  weakerSide: 'LEFT' | 'RIGHT' | 'BALANCED';
  severity: 'BALANCED' | 'MILD' | 'SIGNIFICANT';
}

export interface InbodyAnalysisResult {
  bodyShape: 'TYPE_C' | 'TYPE_I' | 'TYPE_D';
  bodyShapeDescription: string;
  hasSignificantImbalance: boolean;
  imbalances: ImbalanceItem[];
}

export function calculateDerivedInbody(input: InbodyCalculationInput) {
  const heightM = input.heightCm / 100;
  const bmi = Math.round((input.weightKg / (heightM * heightM)) * 100) / 100;

  // BFM (kg)
  let bodyFatMassKg: number | null = null;
  if (input.bodyFatPct != null && input.bodyFatPct > 0) {
    bodyFatMassKg = Math.round((input.weightKg * (input.bodyFatPct / 100)) * 100) / 100;
  }

  // LBM (kg) = Weight - BFM
  let leanBodyMassKg: number | null = null;
  if (bodyFatMassKg != null) {
    leanBodyMassKg = Math.round((input.weightKg - bodyFatMassKg) * 100) / 100;
  }

  // SMM (Skeletal Muscle Mass)
  let skeletalMuscleMassKg: number | null = input.skeletalMuscleMassKg ?? input.muscleMassKg ?? null;
  if (skeletalMuscleMassKg == null && leanBodyMassKg != null) {
    // Estimator: ~58% of lean body mass is skeletal muscle
    skeletalMuscleMassKg = Math.round(leanBodyMassKg * 0.58 * 100) / 100;
  }

  // BMR (kcal) - Katch-McArdle or Mifflin-St Jeor fallback
  let bmrKcal: number;
  if (leanBodyMassKg != null && leanBodyMassKg > 0) {
    bmrKcal = Math.round(370 + 21.6 * leanBodyMassKg);
  } else {
    const age = input.age || 25;
    if (input.gender === 'FEMALE') {
      bmrKcal = Math.round(10 * input.weightKg + 6.25 * input.heightCm - 5 * age - 161);
    } else {
      bmrKcal = Math.round(10 * input.weightKg + 6.25 * input.heightCm - 5 * age + 5);
    }
  }

  // Sanitize segmental lean
  const seg: SegmentalLeanInput = {
    rightArm: input.segmentalLean?.rightArm != null ? Number(input.segmentalLean.rightArm) : null,
    leftArm: input.segmentalLean?.leftArm != null ? Number(input.segmentalLean.leftArm) : null,
    trunk: input.segmentalLean?.trunk != null ? Number(input.segmentalLean.trunk) : null,
    rightLeg: input.segmentalLean?.rightLeg != null ? Number(input.segmentalLean.rightLeg) : null,
    leftLeg: input.segmentalLean?.leftLeg != null ? Number(input.segmentalLean.leftLeg) : null,
  };

  return {
    bmi,
    bodyFatMassKg,
    leanBodyMassKg,
    skeletalMuscleMassKg,
    muscleMassKg: skeletalMuscleMassKg ?? input.muscleMassKg ?? null,
    bmrKcal,
    segmentalLean: seg,
  };
}

export function analyzeInbody(log: {
  weightKg: number | { toNumber?: () => number };
  bodyFatPct?: number | { toNumber?: () => number } | null;
  bodyFatMassKg?: number | { toNumber?: () => number } | null;
  skeletalMuscleMassKg?: number | { toNumber?: () => number } | null;
  muscleMassKg?: number | { toNumber?: () => number } | null;
  segmentalLean?: any;
}): InbodyAnalysisResult {
  const toNum = (val: any): number | null => {
    if (val == null) return null;
    if (typeof val === 'number') return val;
    if (typeof val.toNumber === 'function') return val.toNumber();
    const n = Number(val);
    return isNaN(n) ? null : n;
  };

  const weight = toNum(log.weightKg) || 60;
  const fatPct = toNum(log.bodyFatPct);
  const smm = toNum(log.skeletalMuscleMassKg) || toNum(log.muscleMassKg);
  const bfm = toNum(log.bodyFatMassKg) ?? (fatPct != null ? (weight * fatPct) / 100 : null);

  // 1. Determine C - D - I shape
  let bodyShape: 'TYPE_C' | 'TYPE_I' | 'TYPE_D' = 'TYPE_I';
  let bodyShapeDescription = 'Thể trạng cân đối (Dáng chữ I)';

  if (smm != null && bfm != null) {
    const smmPctOfWeight = (smm / weight) * 100;
    const bfmPctOfWeight = (bfm / weight) * 100;

    // Standard ranges: SMM is usually 40-50% for men, 35-45% for women
    // Fat is usually 15-20% for men, 20-28% for women
    if (smmPctOfWeight < 40 && bfmPctOfWeight > 23) {
      bodyShape = 'TYPE_C';
      bodyShapeDescription = 'Dáng chữ C: Cơ thấp, mỡ cao (Nguy cơ béo phì / Skinny Fat)';
    } else if (smmPctOfWeight >= 45 && bfmPctOfWeight <= 18) {
      bodyShape = 'TYPE_D';
      bodyShapeDescription = 'Dáng chữ D: Cơ cao, mỡ thấp (Thể hình thể thao săn chắc)';
    }
  }

  // 2. Imbalance analysis
  const seg = log.segmentalLean || {};
  const rightArm = toNum(seg.rightArm);
  const leftArm = toNum(seg.leftArm);
  const rightLeg = toNum(seg.rightLeg);
  const leftLeg = toNum(seg.leftLeg);

  const imbalances: ImbalanceItem[] = [];

  // Arm imbalance
  if (rightArm != null && leftArm != null && rightArm > 0 && leftArm > 0) {
    const avg = (rightArm + leftArm) / 2;
    const diff = Math.abs(rightArm - leftArm);
    const pct = Math.round((diff / avg) * 1000) / 10;
    const weakerSide = rightArm < leftArm ? 'RIGHT' : leftArm < rightArm ? 'LEFT' : 'BALANCED';
    const severity = pct > 8 ? 'SIGNIFICANT' : pct > 5 ? 'MILD' : 'BALANCED';

    imbalances.push({
      zone: 'ARMS',
      leftValue: leftArm,
      rightValue: rightArm,
      imbalancePct: pct,
      weakerSide,
      severity,
    });
  }

  // Leg imbalance
  if (rightLeg != null && leftLeg != null && rightLeg > 0 && leftLeg > 0) {
    const avg = (rightLeg + leftLeg) / 2;
    const diff = Math.abs(rightLeg - leftLeg);
    const pct = Math.round((diff / avg) * 1000) / 10;
    const weakerSide = rightLeg < leftLeg ? 'RIGHT' : leftLeg < rightLeg ? 'LEFT' : 'BALANCED';
    const severity = pct > 8 ? 'SIGNIFICANT' : pct > 5 ? 'MILD' : 'BALANCED';

    imbalances.push({
      zone: 'LEGS',
      leftValue: leftLeg,
      rightValue: rightLeg,
      imbalancePct: pct,
      weakerSide,
      severity,
    });
  }

  const hasSignificantImbalance = imbalances.some((i) => i.severity === 'SIGNIFICANT');

  return {
    bodyShape,
    bodyShapeDescription,
    hasSignificantImbalance,
    imbalances,
  };
}
