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
  const capped = Math.min(candidatesExamined, RULES.EXAMINER_MAX_PER_SESSION);
  const calculated = capped * RULES.EXAMINER_RATE_PER_CANDIDATE;
  return Math.max(calculated, RULES.EXAMINER_MIN_REMUNERATION);
}

export function calculateAIE(role: ExaminerRole): number {
  if (role === 'external') {
    return RULES.AIE_PER_SESSION;
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
  if (role !== 'skilled_assistant' && candidatesExamined > RULES.EXAMINER_MAX_PER_SESSION) {
    errors.push(`Max ${RULES.EXAMINER_MAX_PER_SESSION} candidates per session for examiners`);
  }

  return { valid: errors.length === 0, errors };
}
