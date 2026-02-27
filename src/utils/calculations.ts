import { ExaminerRole } from '@/types/claim';

// Anna University remuneration rules
export const RULES = {
  EXAMINER_RATE_PER_CANDIDATE: 10,
  EXAMINER_MIN_REMUNERATION: 75,
  EXAMINER_MAX_PER_SESSION: 35,
  EXAMINER_MAX_PER_DAY: 70,
  SKILLED_RATE_PER_CANDIDATE: 6,
  SKILLED_MIN_REMUNERATION: 50,
  AIE_PER_SESSION: 300,
  AIE_MAX_PER_DAY: 350,
  OTHER_EXPENSES_RATE: 5,
  OTHER_EXPENSES_MIN: 75,
};

export function calculateRemuneration(
  role: ExaminerRole,
  candidatesExamined: number
): number {
  if (role === 'skilled_assistant') {
    const calculated = candidatesExamined * RULES.SKILLED_RATE_PER_CANDIDATE;
    return Math.max(calculated, RULES.SKILLED_MIN_REMUNERATION);
  }
  // Internal or External examiner
  const calculated = candidatesExamined * RULES.EXAMINER_RATE_PER_CANDIDATE;
  return Math.max(calculated, RULES.EXAMINER_MIN_REMUNERATION);
}

export function calculateAIE(role: ExaminerRole, candtsReg: number): number {
  if (role === 'external' && candtsReg <= 35 ) {
    return RULES.AIE_PER_SESSION;
  }
  else if(role === 'external' && candtsReg > 35 && candtsReg <= 70){
    return RULES.AIE_MAX_PER_DAY;
  }
  return 0;
}

export function calculateOtherExpenses(candidatesRegistered: number): number {
  const calculated = candidatesRegistered * RULES.OTHER_EXPENSES_RATE;
  return Math.max(calculated, RULES.OTHER_EXPENSES_MIN);
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateEntry(
  candidatesExamined: number,
  candidatesRegistered: number,
  role: ExaminerRole
): ValidationResult {
  const errors: string[] = [];

  if (candidatesExamined < 0) {
    errors.push('Candidates examined cannot be negative');
  }
  if (candidatesRegistered < 0) {
    errors.push('Candidates registered cannot be negative');
  }
  if (candidatesExamined > candidatesRegistered) {
    errors.push('Candidates examined cannot exceed registered');
  }
  if (candidatesRegistered > 70){
    errors.push('Candidates registered cannot exceed 70 per day')
  }
  if (role !== 'skilled_assistant' && candidatesExamined > RULES.EXAMINER_MAX_PER_DAY) {
    errors.push(`Max ${RULES.EXAMINER_MAX_PER_DAY} candidates per day for examiners`);
  }

  return { valid: errors.length === 0, errors };
}
