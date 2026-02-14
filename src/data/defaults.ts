import { SubjectInfo, CollegeInfo, ExaminerInfo } from '@/types/claim';

export const DEFAULT_CENTRE = 'Anna University Regional Campus Coimbatore';
export const DEFAULT_CENTRE_CODE = '7100';

export const INITIAL_SUBJECTS: SubjectInfo[] = [
  { code: 'CCS342', name: 'DevOps', department: 'CSE' },
  { code: 'CCS354', name: 'Machine Learning', department: 'CSE' },
  { code: 'CCW332', name: 'Web Technologies Lab', department: 'CSE' },
  { code: 'CEC362', name: 'VLSI Design Lab', department: 'ECE' },
  { code: 'CME382', name: 'CAD/CAM Lab', department: 'MECH' },
];

export const INITIAL_COLLEGES: CollegeInfo[] = [
  { code: '7100', name: 'Anna University Regional Campus Coimbatore', abbreviated: 'AURCC' },
  { code: '7104', name: 'Christ The King Engineering College', abbreviated: 'CKEC' },
  { code: '7106', name: 'Sri Eshwar College of Engineering', abbreviated: 'SECE' },
  { code: '7108', name: 'Karpagam College of Engineering', abbreviated: 'KCE' },
  { code: '7110', name: 'Sri Krishna College of Engineering', abbreviated: 'SKCE' },
];

export const INITIAL_EXAMINERS: ExaminerInfo[] = [
  {
    id: '1',
    name: 'Dr. R. Rajamon Singh',
    designation: 'Assistant Professor',
    role: 'external',
    collegeCode: '7104',
    collegeName: 'Christ The King Engineering College',
    contactNumber: '8870267456',
    bankDetails: {
      accountNumber: '0304053000016767',
      accountType: 'SB',
      bankName: 'South Indian Bank',
      branch: 'Bettadi',
      ifscCode: 'SIBL0000304',
      amount: 0,
    },
  },
  {
    id: '2',
    name: 'Dr. S. Kumar',
    designation: 'Associate Professor',
    role: 'internal',
    collegeCode: '7100',
    collegeName: 'Anna University Regional Campus Coimbatore',
  },
  {
    id: '3',
    name: 'Mr. P. Rajan',
    designation: 'Lab Assistant',
    role: 'skilled_assistant',
    collegeCode: '7100',
    collegeName: 'Anna University Regional Campus Coimbatore',
  },
];

export const ROLE_LABELS: Record<string, string> = {
  external: 'External Examiner',
  internal: 'Internal Examiner',
  skilled_assistant: 'Skilled Assistant',
};
