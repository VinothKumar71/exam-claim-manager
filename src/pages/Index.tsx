import React, { useState, useCallback } from 'react';
import { format } from 'date-fns';
import { FileText, Award, Download } from 'lucide-react';
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
} from '@/types/claim';
import {
  DEFAULT_CENTRE,
  DEFAULT_CENTRE_CODE,
  INITIAL_SUBJECTS,
  INITIAL_COLLEGES,
  INITIAL_EXAMINERS,
} from '@/data/defaults';
import {
  generateClaimPDF,
  generateExternalClaimPDF,
  generateAttendanceCertificatePDF,
} from '@/utils/pdfGenerator';
import { calculateRemuneration, calculateAIE, calculateOtherExpenses } from '@/utils/calculations';
import { toast } from '@/hooks/use-toast';

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

const Index = () => {
  const [subjects, setSubjects] = useState<SubjectInfo[]>(INITIAL_SUBJECTS);
  const [colleges, setColleges] = useState<CollegeInfo[]>(INITIAL_COLLEGES);
  const [examiners, setExaminer] = useState<ExaminerInfo[]>(INITIAL_EXAMINERS);
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
  const [periodOfExamination, setPeriodOfExamination] = useState('NOVEMBER - DECEMBER 2025');
  const [departmentName, setDepartmentName] = useState('');
  const [selectedExaminer, setSelectedExaminer] = useState<ExaminerInfo | undefined>();

  const handleAddSubject = (code: string) => {
    if (!subjects.find((s) => s.code === code)) {
      setSubjects((prev) => [...prev, { code, name: code }]);
    }
  };

  const handleAddExaminer = (code: string) => {
    if (!examiners.find((s) => s.name === code)) {
      setExaminer((prev) => [...prev, { name: code }]);
    }
  };
  const handleDeleteExaminer = (name: string) => {
    setExaminer((prev) => prev.filter((s) => s.name !== name));
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
    if (examiner?.bankDetails && paymentMode === 'net_banking') {
      setBankDetails(examiner.bankDetails);
    }
  };

  const getFormData = (): ClaimFormData => ({
    examinationCentre: DEFAULT_CENTRE,
    centreCode: DEFAULT_CENTRE_CODE,
    periodOfExamination,
    departmentName,
    entries,
    paymentMode,
    bankDetails,
  });

  const handleGenerateClaimPDF = () => {
    const hasEntries = entries.some((e) => e.date && e.subjectCode);
    if (!hasEntries) {
      toast({ title: 'Error', description: 'Please fill at least one entry', variant: 'destructive' });
      return;
    }
    generateClaimPDF(getFormData(), examiners);
    toast({ title: 'Success', description: 'Claim PDF generated and downloaded' });
  };

  const handleGenerateExternalClaim = () => {
    if (!selectedExaminer || selectedExaminer.role !== 'external') {
      toast({ title: 'Error', description: 'Please select an external examiner first', variant: 'destructive' });
      return;
    }
    const firstEntry = entries.find((e) => e.subjectCode);
    const subject = subjects.find((s) => s.code === firstEntry?.subjectCode);
    const bd = selectedExaminer.bankDetails || bankDetails;
    const totalAmount = entries.reduce(
      (s, e) => s + e.rows.filter((r) => r.examinerRole === 'external').reduce((t, r) => t + r.total, 0),
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
    const dates = entries.filter((e) => e.date).map((e) => e.date!).sort((a, b) => a.getTime() - b.getTime());
    if (dates.length === 0) {
      toast({ title: 'Error', description: 'Please add entries with dates', variant: 'destructive' });
      return;
    }
    const fromDate = dates[0];
    const toDate = dates[dates.length - 1];
    const numDays = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    generateAttendanceCertificatePDF(
      selectedExaminer.name,
      selectedExaminer.collegeName,
      fromDate,
      toDate,
      numDays
    );
    toast({ title: 'Success', description: 'Attendance certificate PDF generated' });
  };

  const grandTotal = entries.reduce((sum, e) => {
    const rowTotals = e.rows.reduce((s, r) => s + r.total, 0);
    return sum + rowTotals + e.otherExpenses;
  }, 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="govt-header">
        <h1 className="text-xl md:text-2xl font-bold tracking-wide">ANNA UNIVERSITY, CHENNAI - 25</h1>
        <p className="text-xs md:text-sm mt-1 opacity-90">OFFICE OF THE CONTROLLER OF EXAMINATIONS</p>
        <p className="text-[10px] md:text-xs mt-0.5 opacity-75">
          Syndicate approval as per Res.195.6.3 w.e.f. 5 May 2009
        </p>
      </header>

      <main className="max-w-[1400px] mx-auto px-3 md:px-6 py-4">
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
          <div>
            <Label className="text-xs text-muted-foreground">Period of Examinations</Label>
            <Input
              value={periodOfExamination}
              onChange={(e) => setPeriodOfExamination(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Name of the Department</Label>
            <Input
              value={departmentName}
              onChange={(e) => setDepartmentName(e.target.value)}
              placeholder="e.g. Computer Science and Engineering"
              className="h-8 text-sm"
            />
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
        </div>

        {/* Grand Total Summary */}
        <div className="bg-card border border-border rounded-sm p-3 mb-6">
          <div className="flex justify-between items-center">
            <span className="text-sm font-semibold text-foreground">Grand Total</span>
            <span className="text-lg font-bold text-foreground">₹{grandTotal}/-</span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="govt-header py-2">
        <p className="text-[10px] opacity-75">
          Anna University Regional Campus Coimbatore — Practical/Project Examination Claim Management System
        </p>
      </footer>
    </div>
  );
};

export default Index;
