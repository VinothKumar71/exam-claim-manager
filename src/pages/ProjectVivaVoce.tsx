import React, { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { ProjectVivaTable } from '@/components/ProjectVivaTable';
import { PaymentSection } from '@/components/PaymentSection';
import { 
  ProjectClaimEntry, 
  ProjectType, 
  SubjectInfo, 
  CollegeInfo, 
  ExaminerInfo, 
  PaymentMode, 
  BankDetails,
  SubjectCategory
} from '@/types/claim';
import { format } from 'date-fns';
import { 
  DEFAULT_CENTRE, 
  DEFAULT_CENTRE_CODE, 
  INITIAL_SUBJECTS, 
  INITIAL_COLLEGES, 
  INITIAL_EXAMINERS,
  DEPARTMENTS,
  SESSIONS,
  YEARS 
} from '@/data/defaults';
import { supabase } from '@/lib/supabase';
import { Loader2, FileText, Download } from 'lucide-react';

import { useSearchParams } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { generateProjectClaimPDF } from '@/utils/pdfGenerator';
import { calculateTotalAIEForDay } from '@/utils/calculations';

const ProjectVivaVoce = () => {
  const [projectType, setProjectType] = useState<ProjectType>('ug_regular');
  const [subjects, setSubjects] = useState<SubjectInfo[]>([]);
  const [colleges, setColleges] = useState<CollegeInfo[]>([]);
  const [examiners, setExaminers] = useState<ExaminerInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [subjectCategory, setSubjectCategory] = useState<SubjectCategory>('regular');
  const [entries, setEntries] = useState<ProjectClaimEntry[]>([]);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('cash');
  const [bankDetails, setBankDetails] = useState<BankDetails>({
    accountNumber: '',
    accountType: '',
    bankName: '',
    branch: '',
    ifscCode: '',
    amount: 0,
  });
  const [examSession, setExamSession] = useState('APRIL - MAY');
  const [examYear, setExamYear] = useState('2026');
  const [departmentName, setDepartmentName] = useState(DEPARTMENTS[0]);
  const [selectedExaminer, setSelectedExaminer] = useState<ExaminerInfo | undefined>();

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

            setProjectType(fd.projectType || 'ug_regular');
            setEntries(fd.entries);
            setPaymentMode(fd.paymentMode);
            setBankDetails(fd.bankDetails || bankDetails);
            
            if (fd.periodOfExamination) {
              const parts = fd.periodOfExamination.split(' ');
              const yearP = parts.pop();
              const sessionP = parts.join(' ');
              setExamSession(sessionP);
              setExamYear(yearP || '2026');
            }
            setDepartmentName(fd.departmentName || DEPARTMENTS[0]);
            setSubjectCategory(fd.subjectCategory || 'regular');
          }
        } else {
          // Attempt to load auto-saved draft
          const draft = localStorage.getItem('project_claim_draft');
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
      localStorage.setItem('project_claim_draft', JSON.stringify(entries));
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

  const handleSelectExaminer = (examiner: ExaminerInfo | undefined) => {
    setSelectedExaminer(examiner);
    if (paymentMode === 'net_banking' || examiner?.bankDetails) {
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
      if (activeBankDetails.accountNumber) {
        setPaymentMode('net_banking');
      }
    }
  };

  const handleProjectTypeChange = (val: ProjectType) => {
    setProjectType(val);
    setEntries([]); // Clear entries when type changes to avoid mismatch
  };

  // Group entries by date for AIE capping
  const entriesByDate: Record<string, ProjectClaimEntry[]> = {};
  entries.forEach(e => {
    if (e.date) {
      const d = format(e.date, 'yyyy-MM-dd');
      if (!entriesByDate[d]) entriesByDate[d] = [];
      entriesByDate[d].push(e);
    }
  });

  const totalAIE = entries.reduce((sum, e) => sum + (e.aie || 0), 0);

  const subTotal = entries.reduce((sum, e) => {
    const remunerationOnly = e.rows.reduce((s, r) => s + r.remuneration, 0);
    return sum + remunerationOnly;
  }, 0);

  const grandTotal = entries.reduce((sum, e) => sum + e.total, 0);

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50/50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm font-medium text-slate-600 animate-pulse">Loading dynamic data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Project Viva-Voce Claim</h1>
          <p className="text-sm text-slate-500">Generate remuneration claims for Project Examinations.</p>
        </div>
        <div className="flex items-center gap-3">
          <Label className="text-sm font-medium">Project Category:</Label>
          <Select value={projectType} onValueChange={handleProjectTypeChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ug_regular">UG Regular</SelectItem>
              <SelectItem value="pg_mca">PG (MCA/MBA/M.Sc)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 bg-card p-4 border rounded-lg shadow-sm">
        <div className="space-y-1.5">
          <Label className="text-xs uppercase text-muted-foreground font-semibold">Examination Centre</Label>
          <Input value={DEFAULT_CENTRE} disabled className="h-9 bg-muted/50" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs uppercase text-muted-foreground font-semibold">Centre Code</Label>
          <Input value={DEFAULT_CENTRE_CODE} disabled className="h-9 w-24 bg-muted/50" />
        </div>
        <div className="space-y-1.5 col-span-1 md:col-span-1">
          <Label className="text-xs uppercase text-muted-foreground font-semibold">Session</Label>
          <Select value={examSession} onValueChange={setExamSession}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Session" />
            </SelectTrigger>
            <SelectContent>
              {SESSIONS.map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs uppercase text-muted-foreground font-semibold">Year</Label>
          <Select value={examYear} onValueChange={setExamYear}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              {YEARS.map(y => (
                <SelectItem key={y} value={y}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs uppercase text-muted-foreground font-semibold">Department</Label>
          <Select value={departmentName} onValueChange={setDepartmentName}>
            <SelectTrigger className="h-9">
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

      <div className="bg-card border rounded-lg shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50 border-b">
          <h2 className="font-bold text-slate-800">Claim Details</h2>
        </div>
        <div className="p-4">
          <ProjectVivaTable 
            entries={entries}
            setEntries={setEntries}
            subjects={subjects}
            colleges={colleges}
            examiners={examiners}
            projectType={projectType}
            subjectCategory={subjectCategory}
            onAddSubject={() => {}}
            onDeleteSubject={() => {}}
            onAddCollege={() => {}}
            onDeleteCollege={() => {}}
            onSelectExaminer={handleSelectExaminer}
            centreCode={DEFAULT_CENTRE_CODE}
          />
        </div>
      </div>

      <div className="bg-card border rounded-lg p-4 shadow-sm">
        <Label className="text-xs uppercase text-muted-foreground font-semibold">Subject Category (Global)</Label>
        <div className="flex gap-6 mt-2">
          {(['regular', 'barch_theory', 'barch_studio'] as SubjectCategory[]).map((cat) => (
            <label key={cat} className="flex items-center gap-2 cursor-pointer">
              <input 
                type="radio" 
                name="category" 
                checked={subjectCategory === cat} 
                onChange={() => setSubjectCategory(cat)}
                className="w-4 h-4 text-primary focus:ring-primary"
              />
              <span className="text-xs capitalize">{cat.replace(/_/g, ' ')}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <PaymentSection 
          paymentMode={paymentMode}
          onPaymentModeChange={setPaymentMode}
          bankDetails={bankDetails}
          onBankDetailsChange={setBankDetails}
        />
        
        <div className="space-y-4">
          <div className="bg-card border rounded-lg p-6 flex flex-col justify-between h-full">
            <div className="space-y-4">
              <div className="flex justify-between items-end border-b pb-4">
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground font-semibold uppercase">Project Subtotal</span>
                  <div className="text-xl font-bold text-slate-700">₹{subTotal}/-</div>
                </div>
                <div className="space-y-1 text-right">
                  <span className="text-xs text-muted-foreground font-semibold uppercase">Daily Capped AIE</span>
                  <div className="text-xl font-bold text-slate-700">₹{totalAIE}/-</div>
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-sm text-muted-foreground font-medium">Grand Total Remuneration</span>
                <div className="text-4xl font-black text-primary tracking-tighter">₹{grandTotal}/-</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 mt-6">
              <Button 
                className="flex-1 gap-2 h-11" 
                onClick={async () => {
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
                        .eq('type', 'project')
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

                    const formData = {
                      examinationCentre: DEFAULT_CENTRE,
                      centreCode: DEFAULT_CENTRE_CODE,
                      periodOfExamination,
                      departmentName,
                      projectType,
                      subjectCategory,
                      entries,
                      paymentMode,
                      bankDetails,
                    };

                    const { error } = await supabase.from('claims').upsert({
                      id: claimId || undefined,
                      type: 'project',
                      centre_code: DEFAULT_CENTRE_CODE,
                      department: departmentName,
                      period: periodOfExamination,
                      grand_total: grandTotal,
                      form_data: formData
                    });

                    if (error) throw error;

                    generateProjectClaimPDF(formData, examiners);
                    if (!claimId) {
                      localStorage.removeItem('project_claim_draft');
                    }
                    toast({ title: "Success", description: "Claim saved and PDF generated." });
                  } catch (error: any) {
                    toast({ title: "Save Failed", description: error.message, variant: "destructive" });
                  }
                }}
              >
                <FileText className="w-4 h-4" /> Generate PDF
              </Button>
              <Button variant="outline" className="flex-1 gap-2 h-11" onClick={() => toast({ title: "Export", description: "Excel export started." })}>
                <Download className="w-4 h-4" /> Export Excel
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectVivaVoce;
