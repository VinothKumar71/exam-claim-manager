import React, { useState, useCallback } from 'react';
import { format, isValid } from 'date-fns';
import { FileText, Award, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ClaimTable } from '@/components/ClaimTable';
import { PaymentSection } from '@/components/PaymentSection';
import {
  ClaimEntry,
  ClaimFormData,
  PaymentMode,
  BankDetails,
  ExaminerInfo,
  SubjectInfo,
  CollegeInfo,
  ExaminerRole,
  SubjectCategory,
} from '@/types/claim';
import {
  DEFAULT_CENTRE,
  DEFAULT_CENTRE_CODE,
  INITIAL_SUBJECTS,
  INITIAL_COLLEGES,
  INITIAL_EXAMINERS,
  DEPARTMENTS,
  SESSIONS,
  YEARS,
} from '@/data/defaults';
import { cn } from '@/lib/utils';
import {
  generateClaimPDF,
  generateExternalClaimPDF,
  generateAttendanceCertificatePDF,
} from '@/utils/pdfGenerator';
import { calculateRemuneration, calculateAIE, calculateOtherExpenses, calculateTotalAIEForDay } from '@/utils/calculations';
import { exportPracticalToExcel } from '@/utils/excelGenerator';
import { toast } from '@/hooks/use-toast';

import { supabase } from '@/lib/supabase';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { useNavigate, useSearchParams } from 'react-router-dom';

const ROLES: ExaminerRole[] = ['external', 'internal', 'skilled_assistant'];

function createEmptyEntry(): ClaimEntry {
  return {
    id: crypto.randomUUID(),
    date: null,
    subjectCode: '',
    candidatesRegistered: 0,
    candidatesExamined: 0,
    rows: ROLES.map((role) => ({
      examinerName: '',
      examinerRole: role,
      collegeCode: '',
      remuneration: 0,
      lumpsumAIE: 0,
      total: 0,
    })),
    otherExpenses: 0,
    otherExpensesTotal: 0,
  };
}

const PracticalClaim = () => {
  const [subjects, setSubjects] = useState<SubjectInfo[]>([]);
  const [colleges, setColleges] = useState<CollegeInfo[]>([]);
  const [examiners, setExaminers] = useState<ExaminerInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [entries, setEntries] = useState<ClaimEntry[]>([createEmptyEntry()]);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('cash');
  const [bankDetails, setBankDetails] = useState<BankDetails>({
    accountNumber: '',
    accountType: '',
    bankName: '',
    branch: '',
    ifscCode: '',
    amount: 0,
  });
  const [examSession, setExamSession] = useState('NOVEMBER - DECEMBER');
  const [examYear, setExamYear] = useState('2025');
  const [departmentName, setDepartmentName] = useState(DEPARTMENTS[0]);
  const [selectedExaminer, setSelectedExaminer] = useState<ExaminerInfo | undefined>();
  const [exportDateFrom, setExportDateFrom] = useState('');
  const [exportDateTo, setExportDateTo] = useState('');
  
  const [searchParams] = useSearchParams();
  const claimId = searchParams.get('id');

  const periodOfExamination = `${examSession} ${examYear}`;

  React.useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const { data: subData } = await supabase.from('subjects').select('*').order('code');
        const { data: colData } = await supabase.from('colleges').select('*').order('code');
        const { data: exData } = await supabase.from('examiners').select('*').order('name');
        
        setSubjects(subData || []);
        setColleges(colData || []);
        
        const mappedExaminers = (exData || []).map(e => ({
          ...e,
          collegeCode: e.college_code,
          collegeName: colData?.find(c => c.code === e.college_code)?.name || '',
          contactNumber: e.contact_number,
          bankDetails: e.bank_details
        }));
        setExaminers(mappedExaminers);

        // Load existing claim if ID is present
        if (claimId) {
          const { data: claimData, error: claimErr } = await supabase
            .from('claims')
            .select('*')
            .eq('id', claimId)
            .single();
          
          if (claimErr) throw claimErr;
          
          if (claimData) {
            const fd = JSON.parse(JSON.stringify(claimData.form_data), (key, value) => {
              if (key === 'date' && value) return new Date(value);
              return value;
            });
            
            setEntries(fd.entries);
            setPaymentMode(fd.paymentMode);
            setBankDetails(fd.bankDetails || bankDetails);
            
            if (fd.periodOfExamination) {
              const parts = fd.periodOfExamination.split(' ');
              const yearP = parts.pop();
              const sessionP = parts.join(' ');
              setExamSession(sessionP);
              setExamYear(yearP || '2025');
            }
            setDepartmentName(fd.departmentName || DEPARTMENTS[0]);
          }
        } else {
          // Attempt to load auto-saved draft
          const draft = localStorage.getItem('practical_claim_draft');
          if (draft) {
            try {
              const parsed = JSON.parse(draft, (key, value) => {
                if (key === 'date' && value) return new Date(value);
                return value;
              });
              if (parsed && Array.isArray(parsed) && parsed.length > 0) {
                setEntries(parsed);
              }
            } catch (e) {
              console.error('Failed to parse draft', e);
            }
          }
        }
      } catch (error: any) {
        toast({ title: 'Error', description: 'Failed to fetch data: ' + error.message, variant: 'destructive' });
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [claimId]);

  // Auto-save entries to draft
  React.useEffect(() => {
    if (!claimId && entries.length > 0) {
      localStorage.setItem('practical_claim_draft', JSON.stringify(entries));
    }
  }, [entries, claimId]);

  // Sync bank amount when entries or selected examiner changes
  React.useEffect(() => {
    if (paymentMode === 'net_banking' && selectedExaminer) {
      const totalAmount = entries.reduce(
        (s, e) => s + e.rows.filter((r) => 
          r.examinerRole === 'external' && r.examinerName === selectedExaminer.name
        ).reduce((t, r) => t + r.total, 0),
        0
      );
      setBankDetails(prev => ({ ...prev, amount: totalAmount }));
    }
  }, [entries, selectedExaminer, paymentMode]);

  const handleAddSubject = (code: string) => {
    if (!subjects.find((s) => s.code === code)) {
      setSubjects((prev) => [...prev, { code, name: code, department: '' }]);
    }
  };

  const handleAddExaminer = (code: string) => {
    if (!examiners.find((s) => s.name === code)) {
      setExaminers((prev) => [...prev, { name: code }]);
    }
  };
  const handleDeleteExaminer = (name: string) => {
    setExaminers((prev) => prev.filter((s) => s.name !== name));
  };
    

  const handleDeleteSubject = (code: string) => {
    setSubjects((prev) => prev.filter((s) => s.code !== code));
  };

  const handleAddCollege = (code: string) => {
    if (!colleges.find((c) => c.code === code)) {
      setColleges((prev) => [...prev, { code, name: code, abbreviated: code }]);
    }
  };

  const handleDeleteCollege = (code: string) => {
    setColleges((prev) => prev.filter((c) => c.code !== code));
  };

  const handleSelectExaminer = (examiner: ExaminerInfo | undefined) => {
    setSelectedExaminer(examiner);
    if (paymentMode === 'net_banking') {
      const activeBankDetails = examiner?.bankDetails || {
        accountNumber: '',
        accountType: '',
        bankName: '',
        branch: '',
        ifscCode: '',
        amount: 0,
      };

      // Calculate current claim total for this examiner
      const totalAmount = entries.reduce(
        (s, e) => s + e.rows.filter((r) => 
          r.examinerRole === 'external' && 
          (examiner ? r.examinerName === examiner.name : false)
        ).reduce((t, r) => t + r.total, 0),
        0
      );

      setBankDetails({ ...activeBankDetails, amount: totalAmount });
    }
  };

  const getFormData = (): ClaimFormData => ({
    examinationCentre: DEFAULT_CENTRE,
    centreCode: DEFAULT_CENTRE_CODE,
    periodOfExamination,
    departmentName,
    entries,
    paymentMode,
    subjectCategory: 'regular',
    bankDetails,
  });

  const handleGenerateClaimPDF = async () => {
    const hasEntries = entries.some((e) => e.date && e.subjectCode);
    if (!hasEntries) {
      toast({ title: 'Error', description: 'Please fill at least one entry', variant: 'destructive' });
      return;
    }

    try {
      // Check for duplicates
      if (!claimId) {
        const { data: existingClaims } = await supabase.from('claims')
          .select('form_data')
          .eq('type', 'practical')
          .eq('period', periodOfExamination);
          
        if (existingClaims) {
          const isDuplicate = existingClaims.some(claim => {
            const fd = claim.form_data as any;
            if (!fd || !fd.entries) return false;
            return fd.entries.some((e: any) => 
              entries.some(current => 
                current.subjectCode === e.subjectCode && 
                current.date && e.date && 
                new Date(current.date).getTime() === new Date(e.date).getTime()
              )
            );
          });
          
          if (isDuplicate) {
            if (!confirm('A claim for this Subject and Date already exists. Are you sure you want to save a duplicate?')) {
              return;
            }
          }
        }
      }

      // Auto-save to Supabase
      const formData = getFormData();
      const { error } = await supabase.from('claims').upsert({
        id: claimId || undefined,
        type: 'practical',
        centre_code: DEFAULT_CENTRE_CODE,
        department: departmentName,
        period: periodOfExamination,
        grand_total: grandTotal,
        form_data: formData
      });

      if (error) throw error;
      
      generateClaimPDF(formData, examiners);
      if (!claimId) {
        localStorage.removeItem('practical_claim_draft');
      }
      toast({ title: 'Success', description: 'Claim saved and PDF generated' });
    } catch (error: any) {
      toast({ title: 'Save Failed', description: error.message, variant: 'destructive' });
    }
  };

  const handleGenerateExternalClaim = () => {
    if (!selectedExaminer || selectedExaminer.role !== 'external') {
      toast({ title: 'Error', description: 'Please select an external examiner first', variant: 'destructive' });
      return;
    }
    const examinerEntries = entries.filter(e => e.rows.some(r => r.examinerRole === 'external' && r.examinerName === selectedExaminer.name));
    if (examinerEntries.length === 0) {
      toast({ title: 'Error', description: 'Selected examiner has no entries', variant: 'destructive' });
      return;
    }
    const firstEntry = examinerEntries.find((e) => e.subjectCode);
    const subject = subjects.find((s) => s.code === firstEntry?.subjectCode);
    const bd = selectedExaminer.bankDetails || bankDetails;
    const totalAmount = examinerEntries.reduce(
      (s, e) => s + e.rows.filter((r) => r.examinerRole === 'external' && r.examinerName === selectedExaminer.name).reduce((t, r) => t + r.total, 0),
      0
    );

    generateExternalClaimPDF(
      getFormData(),
      selectedExaminer,
      firstEntry?.subjectCode || '',
      subject?.name || '',
      { ...bd, amount: totalAmount }
    );
    toast({ title: 'Success', description: 'External claim form PDF generated' });
  };

  const handleGenerateAttendance = () => {
    if (!selectedExaminer || selectedExaminer.role !== 'external') {
      toast({ title: 'Error', description: 'Attendance certificate is only for external examiners', variant: 'destructive' });
      return;
    }
    const examinerEntries = entries.filter((e) => e.date && e.rows.some(r => r.examinerRole === 'external' && r.examinerName === selectedExaminer.name));
    const dates = examinerEntries.map((e) => e.date!).sort((a, b) => a.getTime() - b.getTime());
    if (dates.length === 0) {
      toast({ title: 'Error', description: 'Selected examiner has no entries with dates', variant: 'destructive' });
      return;
    }
    const fromDate = dates[0];
    const toDate = dates[dates.length - 1];
    const numDays = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    generateAttendanceCertificatePDF(
      selectedExaminer.name,
      selectedExaminer.designation || '',
      selectedExaminer.collegeName || '',
      fromDate,
      toDate,
      numDays
    );
    toast({ title: 'Success', description: 'Attendance certificate PDF generated' });
  };

  // Group entries by date for AIE capping
  const entriesByDate: Record<string, ClaimEntry[]> = {};
  entries.forEach(e => {
    if (e.date) {
      const d = format(e.date, 'yyyy-MM-dd');
      if (!entriesByDate[d]) entriesByDate[d] = [];
      entriesByDate[d].push(e);
    }
  });

  // Calculate AIE per day
  const totalAIE = Object.values(entriesByDate).reduce((sum, dayEntries) => {
    // Determine the external examiner's college code for this day
    const externalRow = dayEntries.find(e => e.rows.some(r => r.examinerRole === 'external'))
      ?.rows.find(r => r.examinerRole === 'external');
    return sum + calculateTotalAIEForDay(dayEntries, externalRow?.collegeCode);
  }, 0);

  // Calculate regular remuneration and other expenses
  const baseTotal = entries.reduce((sum, e) => {
    const remunerationTotal = e.rows.reduce((s, r) => s + r.remuneration, 0);
    const otherExp = calculateOtherExpenses(e.candidatesRegistered, 'regular');
    return sum + remunerationTotal + otherExp;
  }, 0);

  const grandTotal = baseTotal + totalAIE;

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground italic">Fetching data from Supabase...</p>
        </div>
      </div>
    );
  }

  return (
      <main className="max-w-[1400px] mx-auto px-3 md:px-6 py-4">
        {/* Header */}
        <header className="govt-header mb-6">
          <h1 className="text-xl md:text-2xl font-bold tracking-wide">ANNA UNIVERSITY, CHENNAI - 25</h1>
          <p className="text-xs md:text-sm mt-1 opacity-90">OFFICE OF THE CONTROLLER OF EXAMINATIONS</p>
          <p className="text-[10px] md:text-xs mt-0.5 opacity-75">
            Syndicate approval as per Res.195.6.3 w.e.f. 5 May 2009
          </p>
        </header>
        {/* Title */}
        <div className="text-center mb-4">
          <h2 className="text-base md:text-lg font-bold text-foreground">ABSTRACT</h2>
          <p className="text-xs md:text-sm font-semibold text-foreground underline">
            CLAIM FORM FOR EXTERNAL / INTERNAL EXAMINERS / SKILLED ASST. & OTHER EXPENSES
          </p>
          <p className="text-xs md:text-sm font-semibold text-foreground underline">
            LABORATORY WISE STATEMENT FOR PRACTICAL EXAMINATIONS
          </p>
        </div>

        {/* Centre Info */}
        <div className="bg-card border border-border rounded-sm p-3 mb-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground">Name of the Examination Centre</Label>
            <Input value={DEFAULT_CENTRE} disabled className="h-8 text-sm bg-muted" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Code</Label>
            <Input value={DEFAULT_CENTRE_CODE} disabled className="h-8 text-sm bg-muted w-24" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs text-muted-foreground">Session</Label>
              <Select value={examSession} onValueChange={setExamSession}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Session" />
                </SelectTrigger>
                <SelectContent>
                  {SESSIONS.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Year</Label>
              <Select value={examYear} onValueChange={setExamYear}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  {YEARS.map(y => (
                    <SelectItem key={y} value={y}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Name of the Department</Label>
            <Select value={departmentName} onValueChange={setDepartmentName}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Select Department" />
              </SelectTrigger>
              <SelectContent>
                {DEPARTMENTS.map(d => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Main Table */}
        <ClaimTable
          entries={entries}
          setEntries={setEntries}
          subjects={subjects}
          colleges={colleges}
          examiners={examiners}
          onAddSubject={handleAddSubject}
          onDeleteSubject={handleDeleteSubject}
          onAddExaminer={handleAddExaminer}
          onDeleteExaminer={handleDeleteExaminer}
          onAddCollege={handleAddCollege}
          onDeleteCollege={handleDeleteCollege}
          onSelectExaminer={handleSelectExaminer}
          subjectCategory="regular"
          centreCode={DEFAULT_CENTRE_CODE}
        />

        {/* Payment Mode */}
        <PaymentSection
          paymentMode={paymentMode}
          onPaymentModeChange={(mode) => {
            setPaymentMode(mode);
            if (mode === 'net_banking' && selectedExaminer?.bankDetails) {
              setBankDetails(selectedExaminer.bankDetails);
            }
          }}
          bankDetails={bankDetails}
          onBankDetailsChange={setBankDetails}
        />

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 mt-6 mb-8">
          <Button onClick={handleGenerateClaimPDF} className="gap-2">
            <FileText className="w-4 h-4" />
            Generate Claim PDF
          </Button>
          <Button onClick={handleGenerateExternalClaim} variant="outline" className="gap-2">
            <Download className="w-4 h-4" />
            Generate External Claim Form
          </Button>
          <Button
            onClick={handleGenerateAttendance}
            variant="outline"
            className="gap-2"
            disabled={!selectedExaminer || selectedExaminer.role !== 'external'}
          >
            <Award className="w-4 h-4" />
            Generate Attendance Certificate
          </Button>
          {/* Export Excel with date filter */}
          <div className="flex flex-wrap items-end gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold text-green-700 uppercase">From Date</label>
              <input
                type="date"
                value={exportDateFrom}
                onChange={e => setExportDateFrom(e.target.value)}
                className="h-8 text-xs border border-green-200 rounded-md px-2 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-green-400"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold text-green-700 uppercase">To Date</label>
              <input
                type="date"
                value={exportDateTo}
                onChange={e => setExportDateTo(e.target.value)}
                className="h-8 text-xs border border-green-200 rounded-md px-2 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-green-400"
              />
            </div>
            <Button
              onClick={() => {
                if (!entries.some(e => e.date && e.subjectCode)) {
                  toast({ title: 'Error', description: 'No data to export', variant: 'destructive' });
                  return;
                }
                const fromDate = exportDateFrom ? new Date(exportDateFrom) : null;
                const toDate   = exportDateTo   ? new Date(exportDateTo)   : null;
                const ok = exportPracticalToExcel(entries, periodOfExamination, fromDate, toDate);
                if (ok === false) {
                  toast({ title: 'No entries', description: 'No entries found in the selected date range', variant: 'destructive' });
                } else {
                  toast({ title: 'Success', description: 'Excel abstract downloaded' });
                }
              }}
              className="gap-2 bg-green-600 hover:bg-green-700 text-white h-8 text-xs px-3"
            >
              <Download className="w-3.5 h-3.5" />
              Export Excel
            </Button>
            {(exportDateFrom || exportDateTo) && (
              <button
                onClick={() => { setExportDateFrom(''); setExportDateTo(''); }}
                className="text-xs text-green-600 hover:text-green-800 underline h-8 self-end"
              >
                Clear filter
              </button>
            )}
          </div>
        </div>

        {/* Grand Total Summary */}
        <div className="bg-card border border-border rounded-sm p-3 mb-6">
          <div className="flex justify-between items-center">
            <span className="text-sm font-semibold text-foreground">Grand Total</span>
            <span className="text-lg font-bold text-foreground">₹{grandTotal}/-</span>
          </div>
        </div>
      </main>
  );
};

export default PracticalClaim;
