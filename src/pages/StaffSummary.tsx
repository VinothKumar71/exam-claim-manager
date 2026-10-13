import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { BankDetails, ClaimEntryRow } from '@/types/claim';
import { Loader2, Download, Search, RefreshCw, FileText, Users, History, DatabaseBackup } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

/* ─────────────────────────────────────────────
   Types
───────────────────────────────────────────── */
interface StaffSummaryItem {
  examinerName: string;
  designation?: string;
  collegeCode?: string;
  collegeName?: string;
  bankDetails?: BankDetails;
  totalEarned: number;
}

type TabId = 'staff' | 'claims';

/* ─────────────────────────────────────────────
   Component
───────────────────────────────────────────── */
const StaffSummary = () => {
  const [activeTab, setActiveTab] = useState<TabId>('staff');
  const [isLoading, setIsLoading] = useState(true);

  // Staff tab state
  const [staffData, setStaffData] = useState<StaffSummaryItem[]>([]);
  const [staffSearch, setStaffSearch] = useState('');

  // Claims tab state
  const [claims, setClaims] = useState<any[]>([]);
  const [claimSearch, setClaimSearch] = useState('');

  /* ── Fetch ── */
  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Parallel fetch
      const [exRes, colRes, claimRes] = await Promise.all([
        supabase.from('examiners').select('*'),
        supabase.from('colleges').select('code, name'),
        supabase.from('claims').select('*').order('created_at', { ascending: false }),
      ]);

      if (exRes.error) throw exRes.error;
      if (claimRes.error) throw claimRes.error;

      // Build college lookup
      const collegeMap: Record<string, string> = {};
      (colRes.data || []).forEach(c => { collegeMap[c.code] = c.name; });

      // Aggregate earnings from all claims
      const earningsByExaminer: Record<string, number> = {};
      (claimRes.data || []).forEach(claim => {
        const entries = claim.form_data?.entries || [];
        entries.forEach((entry: any) => {
          (entry.rows || []).forEach((row: ClaimEntryRow) => {
            if (row.examinerName) {
              earningsByExaminer[row.examinerName] = (earningsByExaminer[row.examinerName] || 0) + (row.total || 0);
            }
          });
        });
      });

      const mappedStaff: StaffSummaryItem[] = (exRes.data || []).map(e => ({
        examinerName: e.name,
        designation: e.designation,
        collegeCode: e.college_code,
        collegeName: collegeMap[e.college_code] || e.college_code || '-',
        bankDetails: e.bank_details,
        totalEarned: earningsByExaminer[e.name] || 0,
      })).sort((a, b) => b.totalEarned - a.totalEarned);

      setStaffData(mappedStaff);
      setClaims(claimRes.data || []);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  /* ─────────────────────────────────────────────
     EXCEL EXPORTS
  ───────────────────────────────────────────── */

  /** Export staff account details */
  const handleExportStaff = () => {
    if (filteredStaff.length === 0) {
      toast({ title: 'No data', description: 'No staff data to export', variant: 'destructive' });
      return;
    }

    const header = [
      ['STAFF ACCOUNT DETAILS - EXAM CLAIM MANAGER'],
      [`Exported on: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`],
      [],
      ['Sl. No', 'Staff Name', 'Designation', 'College',
        'Bank Name', 'Branch', 'Account Number', 'Account Type', 'IFSC Code', 'Total Earned (₹)'],
    ];

    const rows = filteredStaff.map((s, i) => [
      i + 1, s.examinerName, s.designation || '-', s.collegeName || '-',
      s.bankDetails?.bankName || '-', s.bankDetails?.branch || '-',
      s.bankDetails?.accountNumber || '-', s.bankDetails?.accountType || '-',
      s.bankDetails?.ifscCode || '-', s.totalEarned,
    ]);

    const ws = XLSX.utils.aoa_to_sheet([...header, ...rows]);
    if (!ws['!merges']) ws['!merges'] = [];
    ws['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 9 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 9 } });
    ws['!cols'] = [
      { wch: 6 }, { wch: 30 }, { wch: 20 }, { wch: 30 },
      { wch: 20 }, { wch: 20 }, { wch: 22 }, { wch: 15 }, { wch: 15 }, { wch: 16 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Staff Account Details');
    XLSX.writeFile(wb, `Staff_Account_Details_${format(new Date(), 'yyyyMMdd')}.xlsx`);
    toast({ title: 'Success', description: 'Account details exported.' });
  };

  /** Export all claims — each claim becomes one sheet, plus a summary sheet */
  const handleExportAllClaims = () => {
    if (filteredClaims.length === 0) {
      toast({ title: 'No data', description: 'No claims to export', variant: 'destructive' });
      return;
    }

    const wb = XLSX.utils.book_new();

    // Summary sheet
    const summaryRows: any[][] = [
      ['CLAIMS EXPORT SUMMARY'],
      [`Exported on: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`],
      [],
      ['Sl.No', 'Date Created', 'Type', 'Department', 'Period', 'Grand Total (₹)'],
    ];
    filteredClaims.forEach((c, i) => {
      summaryRows.push([
        i + 1,
        format(new Date(c.created_at), 'dd/MM/yyyy'),
        c.type?.toUpperCase() || '-',
        c.department || '-',
        c.period || '-',
        c.grand_total || 0,
      ]);
    });
    // Grand total row
    summaryRows.push([
      '', '', '', '', 'GRAND TOTAL',
      filteredClaims.reduce((s, c) => s + (c.grand_total || 0), 0),
    ]);

    const summaryWs = XLSX.utils.aoa_to_sheet(summaryRows);
    if (!summaryWs['!merges']) summaryWs['!merges'] = [];
    summaryWs['!merges'].push(
      { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } },
    );
    summaryWs['!cols'] = [{ wch: 6 }, { wch: 14 }, { wch: 12 }, { wch: 30 }, { wch: 28 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');

    // Per-claim sheets (detailed line items)
    filteredClaims.forEach((claim, claimIdx) => {
      const entries: any[] = claim.form_data?.entries || [];
      const sheetName = `${claim.type === 'practical' ? 'PR' : 'PV'}_${claimIdx + 1}`.slice(0, 31);

      const headerRows: any[][] = [
        [`${claim.type === 'practical' ? 'PRACTICAL' : 'PROJECT VIVA'} CLAIM`],
        [`Department: ${claim.department || '-'} | Period: ${claim.period || '-'}`],
        [`Date: ${format(new Date(claim.created_at), 'dd/MM/yyyy')}`],
        [],
      ];

      if (claim.type === 'practical') {
        // Practical: date | subject | candidates | ext amount | lumpsum | ext total | int rem | int total | skilled | other | total
        headerRows.push([
          'Sl.No', 'Date', 'Subject Code', 'Candidates Examined',
          'Ext. Amount (₹)', 'Ext. Lumpsum (₹)', 'Ext. Total (₹)',
          'Int. Remu. (₹)', 'Int. Total (₹)', 'Skilled Asst. (₹)', 'Other Exp. (₹)', 'Total (₹)',
        ]);

        let slNo = 1;
        let tot = { ea: 0, el: 0, et: 0, ir: 0, it: 0, sa: 0, oe: 0, t: 0 };

        entries.forEach(entry => {
          if (!entry.date || !entry.subjectCode) return;
          const extRow = entry.rows?.find((r: any) => r.examinerRole === 'external');
          const intRow = entry.rows?.find((r: any) => r.examinerRole === 'internal');
          const sklRow = entry.rows?.find((r: any) => r.examinerRole === 'skilled_assistant');

          const ea = extRow?.remuneration || 0;
          const el = extRow?.lumpsumAIE || 0;
          const et = ea + el;
          const ir = intRow?.remuneration || 0;
          const it = intRow?.total || ir;
          const sa = sklRow?.remuneration || 0;
          const oe = entry.otherExpenses || 0;
          const t = et + it + sa + oe;

          tot.ea += ea; tot.el += el; tot.et += et;
          tot.ir += ir; tot.it += it; tot.sa += sa; tot.oe += oe; tot.t += t;

          headerRows.push([
            slNo++,
            format(new Date(entry.date), 'dd.MM.yy'),
            entry.subjectCode,
            entry.candidatesExamined,
            ea, el, et, ir, it, sa, oe, t,
          ]);
        });

        // Totals
        headerRows.push(['', '', '', 'TOTAL', tot.ea, tot.el, tot.et, tot.ir, tot.it, tot.sa, tot.oe, tot.t]);
      } else {
        // Project Viva
        headerRows.push([
          'Sl.No', 'Date', 'Subject Code', 'No. of Groups/Candidates',
          'Examiner Name', 'Role', 'College Code', 'Rem. (₹)', 'AIE (₹)', 'Other Exp. (₹)', 'Total (₹)',
        ]);

        let slNo = 1;
        let totRem = 0, totAIE = 0, totOther = 0, totTotal = 0;

        entries.forEach(entry => {
          if (!entry.date || !entry.subjectCode) return;
          const otherExp = entry.total - (entry.rows || []).reduce((s: number, r: any) => s + r.total, 0);

          (entry.rows || []).forEach((row: any, ri: number) => {
            totRem += row.remuneration || 0;
            totAIE += row.lumpsumAIE || 0;
            if (ri === 0) totOther += Math.round(otherExp);
            totTotal += row.total || 0;

            headerRows.push([
              ri === 0 ? slNo++ : '',
              ri === 0 ? format(new Date(entry.date), 'dd.MM.yy') : '',
              ri === 0 ? entry.subjectCode : '',
              ri === 0 ? (entry.numGroups || entry.numCandidates || 0) : '',
              row.examinerName || '-',
              row.examinerRole || '-',
              row.collegeCode || '-',
              row.remuneration || 0,
              row.lumpsumAIE || 0,
              ri === 0 ? Math.round(otherExp) : '',
              row.total || 0,
            ]);
          });
        });

        headerRows.push(['', '', '', '', '', '', 'TOTAL', totRem, totAIE, totOther, totTotal]);
      }

      const ws = XLSX.utils.aoa_to_sheet(headerRows);
      if (!ws['!merges']) ws['!merges'] = [];
      ws['!merges'].push(
        { s: { r: 0, c: 0 }, e: { r: 0, c: 11 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 11 } },
        { s: { r: 2, c: 0 }, e: { r: 2, c: 11 } },
      );
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });

    XLSX.writeFile(wb, `All_Claims_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`);
    toast({ title: 'Success', description: `${filteredClaims.length} claim(s) exported to Excel.` });
  };

  /* ─────────────────────────────────────────────
     FILTERED DATA
  ───────────────────────────────────────────── */
  const filteredStaff = staffData.filter(s =>
    s.examinerName.toLowerCase().includes(staffSearch.toLowerCase()) ||
    (s.bankDetails?.accountNumber || '').includes(staffSearch) ||
    (s.bankDetails?.bankName || '').toLowerCase().includes(staffSearch.toLowerCase())
  );

  const filteredClaims = claims.filter(c =>
    (c.department || '').toLowerCase().includes(claimSearch.toLowerCase()) ||
    (c.period || '').toLowerCase().includes(claimSearch.toLowerCase()) ||
    (c.type || '').toLowerCase().includes(claimSearch.toLowerCase())
  );

  const totalPayable = filteredStaff.reduce((s, st) => s + st.totalEarned, 0);
  const totalClaimValue = filteredClaims.reduce((s, c) => s + (c.grand_total || 0), 0);

  /* ─────────────────────────────────────────────
     RENDER
  ───────────────────────────────────────────── */
  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground italic">Loading staff and claims data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1300px] mx-auto space-y-5 animate-in fade-in duration-700">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Reports & Accounts</h1>
          <p className="text-sm text-slate-500">Download staff account details and all claim data from Supabase.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 self-start md:self-auto">
          <Button variant="outline" size="sm" onClick={() => window.open('http://localhost:3000/api/backup', '_blank')} className="gap-1.5 border-primary text-primary hover:bg-primary/10">
            <DatabaseBackup className="w-3.5 h-3.5" /> Backup Database
          </Button>
          <Button variant="outline" size="sm" onClick={fetchData} className="gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh Data
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border rounded-xl p-4 shadow-sm">
          <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wide">Total Staff</p>
          <p className="text-3xl font-black text-slate-800 mt-1">{staffData.length}</p>
        </div>
        <div className="bg-card border rounded-xl p-4 shadow-sm">
          <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wide">With Bank Details</p>
          <p className="text-3xl font-black text-slate-800 mt-1">
            {staffData.filter(s => s.bankDetails?.accountNumber).length}
          </p>
        </div>
        <div className="bg-card border rounded-xl p-4 shadow-sm">
          <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wide">Total Claims</p>
          <p className="text-3xl font-black text-slate-800 mt-1">{claims.length}</p>
        </div>
        <div className="bg-card border rounded-xl p-4 shadow-sm">
          <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wide">Total Claim Value</p>
          <p className="text-2xl font-black text-primary mt-1">₹{totalClaimValue.toLocaleString('en-IN')}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        {([
          { id: 'staff' as TabId, label: 'Staff Accounts', icon: Users },
          { id: 'claims' as TabId, label: 'All Claims Data', icon: History },
        ]).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all',
              activeTab === tab.id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── TAB: Staff Accounts ── */}
      {activeTab === 'staff' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Name, bank, account..."
                className="pl-9 bg-white"
                value={staffSearch}
                onChange={(e) => setStaffSearch(e.target.value)}
              />
            </div>
            <div className="ml-auto">
              <Button onClick={handleExportStaff} className="gap-2 bg-green-600 hover:bg-green-700 text-white">
                <Download className="w-4 h-4" />
                Export Staff to Excel
              </Button>
            </div>
          </div>

          <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 border-b text-xs uppercase text-slate-500 font-semibold">
                  <tr>
                    <th className="px-3 py-3 w-10">#</th>
                    <th className="px-3 py-3">Staff Name</th>
                    <th className="px-3 py-3">Designation</th>
                    <th className="px-3 py-3">College</th>
                    <th className="px-3 py-3">Bank Name</th>
                    <th className="px-3 py-3">Account No</th>
                    <th className="px-3 py-3">IFSC</th>
                    <th className="px-3 py-3 text-right">Total Earned</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredStaff.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                        No staff data found.
                      </td>
                    </tr>
                  ) : filteredStaff.map((staff, idx) => (
                    <tr key={staff.examinerName} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-3 py-2.5 text-slate-400">{idx + 1}</td>
                      <td className="px-3 py-2.5 font-semibold text-slate-900">{staff.examinerName}</td>
                      <td className="px-3 py-2.5 text-slate-600 text-xs">{staff.designation || '-'}</td>
                      <td className="px-3 py-2.5 text-slate-600 text-xs">{staff.collegeName || '-'}</td>
                      <td className="px-3 py-2.5 text-slate-600">{staff.bankDetails?.bankName || <span className="text-slate-300">-</span>}</td>
                      <td className="px-3 py-2.5 font-mono text-slate-700 text-xs">
                        {staff.bankDetails?.accountNumber || <span className="text-red-400 font-sans text-xs">No account</span>}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-slate-600 text-xs">{staff.bankDetails?.ifscCode || '-'}</td>
                      <td className="px-3 py-2.5 text-right font-bold text-primary">
                        {staff.totalEarned > 0 ? `₹${staff.totalEarned.toLocaleString('en-IN')}` : <span className="text-slate-400">₹0</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {filteredStaff.length > 0 && (
                  <tfoot className="bg-slate-50 border-t font-semibold">
                    <tr>
                      <td colSpan={7} className="px-3 py-2.5 text-right text-slate-600">Grand Total</td>
                      <td className="px-3 py-2.5 text-right text-primary font-black">
                        ₹{totalPayable.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: All Claims Data ── */}
      {activeTab === 'claims' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Department, period, type..."
                className="pl-9 bg-white"
                value={claimSearch}
                onChange={(e) => setClaimSearch(e.target.value)}
              />
            </div>
            <div className="ml-auto">
              <Button onClick={handleExportAllClaims} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
                <FileText className="w-4 h-4" />
                Export All Claims to Excel
              </Button>
            </div>
          </div>

          <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 border-b text-xs uppercase text-slate-500 font-semibold">
                  <tr>
                    <th className="px-3 py-3 w-10">#</th>
                    <th className="px-3 py-3">Date Saved</th>
                    <th className="px-3 py-3">Type</th>
                    <th className="px-3 py-3">Department</th>
                    <th className="px-3 py-3">Period</th>
                    <th className="px-3 py-3 text-right">Grand Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredClaims.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                        No claims found.
                      </td>
                    </tr>
                  ) : filteredClaims.map((claim, idx) => (
                    <tr key={claim.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-3 py-2.5 text-slate-400">{idx + 1}</td>
                      <td className="px-3 py-2.5 text-slate-700">
                        {format(new Date(claim.created_at), 'dd MMM yyyy')}
                        <span className="block text-[10px] text-slate-400">{format(new Date(claim.created_at), 'hh:mm a')}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={cn(
                          'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide',
                          claim.type === 'practical'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-emerald-100 text-emerald-700'
                        )}>
                          {claim.type}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-medium text-slate-800">{claim.department || '-'}</td>
                      <td className="px-3 py-2.5 text-slate-600 text-xs">{claim.period || '-'}</td>
                      <td className="px-3 py-2.5 text-right font-bold text-slate-900">
                        ₹{(claim.grand_total || 0).toLocaleString('en-IN')}/-
                      </td>
                    </tr>
                  ))}
                </tbody>
                {filteredClaims.length > 0 && (
                  <tfoot className="bg-slate-50 border-t font-semibold">
                    <tr>
                      <td colSpan={5} className="px-3 py-2.5 text-right text-slate-600">Grand Total</td>
                      <td className="px-3 py-2.5 text-right text-primary font-black">
                        ₹{totalClaimValue.toLocaleString('en-IN')}/-
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          <p className="text-xs text-center text-slate-400 italic">
            "Export All Claims to Excel" creates one sheet per claim with full line-item detail, plus a summary sheet.
          </p>
        </div>
      )}
    </div>
  );
};

export default StaffSummary;
