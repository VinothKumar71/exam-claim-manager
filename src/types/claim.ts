export type ExaminerRole = 'external' | 'internal' | 'skilled_assistant';
export type PaymentMode = 'cash' | 'net_banking';

export interface BankDetails {
  accountNumber: string;
  accountType: string;
  bankName: string;
  branch: string;
  ifscCode: string;
  amount: number;
}

export interface ExaminerInfo {
  id?: string;
  name: string;
  designation?: string;
  role?: ExaminerRole;
  collegeCode?: string;
  collegeName?: string;
  contactNumber?: string;
  bankDetails?: BankDetails;
}

export interface SubjectInfo {
  code: string;
  name: string;
  department?: string;
}

export interface CollegeInfo {
  code: string;
  name: string;
  abbreviated: string;
}

export interface ClaimRow {
  id: string;
  slNo: number;
  date: Date | null;
  subjectCode: string;
  candidatesRegistered: number;
  candidatesExamined: number;
  examinerName: string;
  examinerRole: ExaminerRole;
  collegeCode: string;
  remuneration: number;
  lumpsumAIE: number;
  otherExpenses: number;
  total: number;
  signature: string;
}

export interface ClaimEntry {
  id: string;
  date: Date | null;
  subjectCode: string;
  candidatesRegistered: number;
  candidatesExamined: number;
  rows: ClaimEntryRow[];
  otherExpenses: number;
  otherExpensesTotal: number;
}

export interface ClaimEntryRow {
  examinerName: string;
  examinerRole: ExaminerRole;
  collegeCode: string;
  remuneration: number;
  lumpsumAIE: number;
  total: number;
}

export interface ClaimFormData {
  examinationCentre: string;
  centreCode: string;
  periodOfExamination: string;
  departmentName: string;
  entries: ClaimEntry[];
  paymentMode: PaymentMode;
  bankDetails?: BankDetails;
}

export interface ValidationError {
  field: string;
  message: string;
  entryId?: string;
  rowIndex?: number;
}
