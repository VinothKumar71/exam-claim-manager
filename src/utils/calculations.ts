import { ExaminerRole, ProjectType, SubjectCategory } from '@/types/claim';

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
  AIE_PER_SESSION_CSICE: 400,
  AIE_MAX_PER_DAY_CSICE: 450,
  OTHER_EXPENSES_RATE: 5,
  OTHER_EXPENSES_MIN: 75,
  // Project Viva Rules
  PROJECT_UG_RATE_PER_GROUP: 40,
  PROJECT_UG_MIN_REMUNERATION: 100,
  PROJECT_UG_MAX_GROUPS_PER_SESSION: 10,
  PROJECT_UG_MAX_GROUPS_PER_DAY: 20,
  PROJECT_PG_VIVA_RATE_PER_CANDIDATE: 50,
  PROJECT_PG_THESIS_ME_RATE: 100,
  PROJECT_PG_THESIS_MCA_RATE: 50,
};

export function calculateRemuneration(
  role: ExaminerRole,
  candidatesExamined: number
): number {
  if (role === 'skilled_assistant') {
    const calculated = candidatesExamined * RULES.SKILLED_RATE_PER_CANDIDATE;
    return Math.max(calculated, RULES.SKILLED_MIN_REMUNERATION);
  }
  
  // Rule 1: Internal Examiner min only if candidates turn up. External gets min ₹75 regardless.
  if (role === 'internal' && candidatesExamined === 0) {
    return 0;
  }

  // Internal or External examiner
  const calculated = candidatesExamined * RULES.EXAMINER_RATE_PER_CANDIDATE;
  return Math.max(calculated, RULES.EXAMINER_MIN_REMUNERATION);
}

export function calculateAIE(role: ExaminerRole, candtsReg: number, collegeCode?: string): number {
  const code = collegeCode?.trim()?.toUpperCase();
  const isCSICE = code === '7106' || code === 'CSICE' || code === 'CSISE';
  const perSession = isCSICE ? RULES.AIE_PER_SESSION_CSICE : RULES.AIE_PER_SESSION;
  const perDay = isCSICE ? RULES.AIE_MAX_PER_DAY_CSICE : RULES.AIE_MAX_PER_DAY;

  if (role === 'external' && candtsReg <= 35) {
    return perSession;
  }
  else if (role === 'external' && candtsReg > 35 && candtsReg <= 70) {
    return perDay;
  }
  return 0;
}

export function calculateOtherExpenses(
  candidatesRegistered: number,
  category: SubjectCategory = 'regular'
): number {
  let rate = 5;
  let min = 75;

  if (category === 'barch_theory') {
    rate = 20;
    min = 100;
  } else if (category === 'barch_studio') {
    rate = 50;
    min = 100;
  }

  const calculated = candidatesRegistered * rate;
  return Math.max(calculated, min);
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateEntry(
  candidatesExamined: number,
  candidatesRegistered: number,
  role: ExaminerRole,
  projectType?: ProjectType
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

  // Practical Exams limits
  if (!projectType) {
    if (candidatesRegistered > RULES.EXAMINER_MAX_PER_DAY) {
      errors.push(`Max ${RULES.EXAMINER_MAX_PER_DAY} candidates per day for practicals`);
    }
  } 
  // Project Viva limits
  else {
    if (projectType === 'ug_regular' && candidatesExamined > RULES.PROJECT_UG_MAX_GROUPS_PER_DAY) {
      errors.push(`Max ${RULES.PROJECT_UG_MAX_GROUPS_PER_DAY} groups per day for UG Projects`);
    }
    if (projectType === 'pg_me' && candidatesExamined > 15) {
      errors.push('Max 15 candidates per day for ME/M.Tech Projects');
    }
    if (projectType === 'pg_mca' && candidatesExamined > 20) {
      errors.push('Max 20 candidates per day for MCA/MBA Projects');
    }
  }

  return { valid: errors.length === 0, errors };
}

export function calculateProjectRemuneration(
  role: ExaminerRole,
  projectType: ProjectType,
  count: number, // groups for ug_groups, candidates for others
  numThesis: number = 0
): number {
  if (projectType === 'ug_regular') {
    if (role === 'skilled_assistant') return 0; // Not mentioned typically
    const calculated = count * RULES.PROJECT_UG_RATE_PER_GROUP;
    return Math.max(calculated, RULES.PROJECT_UG_MIN_REMUNERATION);
  }

  if (projectType === 'ug_barch') {
    const calculated = count * RULES.PROJECT_UG_RATE_PER_GROUP; // Rate is same per candidate
    return Math.max(calculated, RULES.PROJECT_UG_MIN_REMUNERATION);
  }

  if (projectType.startsWith('pg')) {
    let total = 0;
    // Viva remuneration
    if (role === 'external' || role === 'internal' || role === 'supervisor') {
      total += count * RULES.PROJECT_PG_VIVA_RATE_PER_CANDIDATE;
    }
    // Thesis Evaluation (External only)
    if (role === 'external' && numThesis > 0) {
      const rate = projectType === 'pg_me' ? RULES.PROJECT_PG_THESIS_ME_RATE : RULES.PROJECT_PG_THESIS_MCA_RATE;
      total += numThesis * rate;
    }
    return total;
  }

  return 0;
}
export function calculateProjectAIE(
  role: ExaminerRole,
  isDayFull: boolean, // if > max per day
  collegeCode?: string
): number {
  if (role !== 'external') return 0;
  const code = collegeCode?.trim()?.toUpperCase();
  const isCSICE = code === '7106' || code === 'CSICE' || code === 'CSISE';
  const perSession = isCSICE ? RULES.AIE_PER_SESSION_CSICE : RULES.AIE_PER_SESSION;
  const perDay = isCSICE ? RULES.AIE_MAX_PER_DAY_CSICE : RULES.AIE_MAX_PER_DAY;
  
  return isDayFull ? perDay : perSession;
}

/**
 * Calculates total AIE for a specific date across multiple entries
 * Rule: ₹300 per session, ₹350 per day max per external examiner
 */
export function calculateTotalAIEForDay(
  entriesOnDay: { candidatesRegistered?: number; numGroups?: number; numCandidates?: number }[], 
  collegeCode?: string,
  projectType?: ProjectType
): number {
  if (entriesOnDay.length === 0) return 0;
  
  const totalReg = entriesOnDay.reduce((s, e) => s + (e.candidatesRegistered || e.numGroups || e.numCandidates || 0), 0);
  
  const code = collegeCode?.trim()?.toUpperCase();
  const isCSICE = code === '7106' || code === 'CSICE' || code === 'CSISE';
  const perSession = isCSICE ? RULES.AIE_PER_SESSION_CSICE : RULES.AIE_PER_SESSION;
  const perDay = isCSICE ? RULES.AIE_MAX_PER_DAY_CSICE : RULES.AIE_MAX_PER_DAY;

  // Determine threshold for daily max AIE
  let threshold = 35; // Default for Practical Exams
  if (projectType === 'ug_regular') threshold = 10; // 10 groups per session
  if (projectType === 'pg_mca') threshold = 10;    // 10 candidates per session
  if (projectType === 'pg_me') threshold = 8;      // 8 candidates per session

  if (totalReg > threshold) {
    return perDay; // Max daily AIE if more than one session worth of candidates
  }
  return perSession; // One session AIE
}
