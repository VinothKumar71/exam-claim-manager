import React, { useState, useCallback } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SearchableDropdown } from '@/components/SearchableDropdown';
import { cn } from '@/lib/utils';
import { ClaimEntry, ClaimEntryRow, ExaminerRole, SubjectInfo, CollegeInfo, ExaminerInfo, BankDetails } from '@/types/claim';
import { calculateRemuneration, calculateAIE, calculateOtherExpenses, validateEntry } from '@/utils/calculations';
import { ROLE_LABELS } from '@/data/defaults';

interface ClaimTableProps {
  entries: ClaimEntry[];
  setEntries: React.Dispatch<React.SetStateAction<ClaimEntry[]>>;
  subjects: SubjectInfo[];
  colleges: CollegeInfo[];
  examiners: ExaminerInfo[];
  onAddSubject: (code: string) => void;
  onDeleteSubject: (code: string) => void;
  onAddCollege: (code: string) => void;
  onDeleteCollege: (code: string) => void;
  onSelectExaminer: (examiner: ExaminerInfo | undefined) => void;
}

const ROLES: ExaminerRole[] = ['external', 'internal', 'skilled_assistant'];

function createEmptyEntry(slNo: number): ClaimEntry {
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

export const ClaimTable: React.FC<ClaimTableProps> = ({
  entries,
  setEntries,
  subjects,
  colleges,
  examiners,
  onAddSubject,
  onDeleteSubject,
  onAddCollege,
  onDeleteCollege,
  onSelectExaminer,
}) => {
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const recalculate = useCallback(
    (entry: ClaimEntry): ClaimEntry => {
      const updatedRows = entry.rows.map((row) => {
        const rem = calculateRemuneration(row.examinerRole, entry.candidatesExamined);
        const aie = calculateAIE(row.examinerRole);
        return { ...row, remuneration: rem, lumpsumAIE: aie, total: rem + aie };
      });
      const otherExp = calculateOtherExpenses(entry.candidatesRegistered);
      const otherTotal = otherExp;
      return { ...entry, rows: updatedRows, otherExpenses: otherExp, otherExpensesTotal: otherTotal };
    },
    []
  );

  const updateEntry = (id: string, field: keyof ClaimEntry, value: any) => {
    setEntries((prev) =>
      prev.map((e) => {
        if (e.id !== id) return e;
        const updated = { ...e, [field]: value };
        // Validate
        if (field === 'candidatesExamined' || field === 'candidatesRegistered') {
          const validation = validateEntry(
            field === 'candidatesExamined' ? value : updated.candidatesExamined,
            field === 'candidatesRegistered' ? value : updated.candidatesRegistered,
            'external'
          );
          if (!validation.valid) {
            setErrors((prev) => ({ ...prev, [id]: validation.errors }));
          } else {
            setErrors((prev) => {
              const next = { ...prev };
              delete next[id];
              return next;
            });
          }
        }
        return recalculate(updated);
      })
    );
  };

  const updateRow = (entryId: string, rowIndex: number, field: keyof ClaimEntryRow, value: any) => {
    setEntries((prev) =>
      prev.map((e) => {
        if (e.id !== entryId) return e;
        const newRows = [...e.rows];
        newRows[rowIndex] = { ...newRows[rowIndex], [field]: value };
        // If selecting an examiner, auto-fill bank details
        if (field === 'examinerName') {
          const examiner = examiners.find((ex) => ex.name === value);
          if (examiner) {
            newRows[rowIndex].collegeCode = examiner.collegeCode;
            onSelectExaminer(examiner);
          }
        }
        return recalculate({ ...e, rows: newRows });
      })
    );
  };

  const addEntry = () => {
    setEntries((prev) => [...prev, createEmptyEntry(prev.length + 1)]);
  };

  const removeEntry = (id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const subjectItems = subjects.map((s) => ({ value: s.code, label: `${s.code} - ${s.name}` }));
  const collegeItems = colleges.map((c) => ({ value: c.code, label: `${c.code} - ${c.abbreviated}` }));

  const getExaminerItems = (role: ExaminerRole) =>
    examiners
      .filter((e) => e.role === role)
      .map((e) => ({ value: e.name, label: `${e.name} (${e.designation})` }));

  const grandTotal = entries.reduce((sum, e) => {
    const rowTotals = e.rows.reduce((s, r) => s + r.total, 0);
    return sum + rowTotals + e.otherExpenses;
  }, 0);

  return (
    <div className="overflow-x-auto">
      <table className="govt-table">
        <thead>
          <tr>
            <th className="w-10" rowSpan={2}>Sl.<br />No.</th>
            <th className="w-24" rowSpan={2}>Date</th>
            <th className="w-28" rowSpan={2}>Subject<br />Code</th>
            <th className="w-16" rowSpan={2}>No. of<br />Cands.<br />Regd.</th>
            <th className="w-16" rowSpan={2}>No. of<br />Cands.<br />Examined</th>
            <th className="w-40" rowSpan={2}>Name & Designation<br />External / Internal /<br />Skilled Asst.</th>
            <th className="w-32" rowSpan={2}>Code No.<br />College Name<br />in which working<br />(abbreviated)</th>
            <th className="w-20" rowSpan={2}>Rem.<br />(₹)</th>
            <th className="w-20" rowSpan={2}>Lumpsum<br />AIE*<br />(₹)</th>
            <th className="w-20" rowSpan={2}>Other Exp.<br />(₹)</th>
            <th className="w-20" rowSpan={2}>Total<br />(₹)</th>
            <th className="w-24" rowSpan={2}>Signature<br />in full</th>
            <th className="w-8" rowSpan={2}></th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, entryIdx) => {
            const entryErrors = errors[entry.id] || [];
            return (
              <React.Fragment key={entry.id}>
                {/* 3 rows for External, Internal, Skilled */}
                {entry.rows.map((row, rowIdx) => (
                  <tr key={`${entry.id}-${rowIdx}`} className={entryErrors.length > 0 ? 'field-error' : ''}>
                    {rowIdx === 0 && (
                      <>
                        <td rowSpan={3} className="text-center font-medium text-xs">
                          {entryIdx + 1}.
                        </td>
                        <td rowSpan={3} className="p-0.5">
                          <Popover>
                            <PopoverTrigger asChild>
                              <button
                                className={cn(
                                  'w-full flex items-center justify-between px-1 py-1 text-xs rounded-sm hover:bg-accent',
                                  !entry.date && 'text-muted-foreground'
                                )}
                              >
                                {entry.date ? format(entry.date, 'dd/MM/yy') : 'Select'}
                                <CalendarIcon className="w-3 h-3" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0 bg-popover" align="start">
                              <Calendar
                                mode="single"
                                selected={entry.date || undefined}
                                onSelect={(d) => updateEntry(entry.id, 'date', d)}
                                disabled={(date) => date > new Date()}
                                initialFocus
                                className="p-3 pointer-events-auto"
                              />
                            </PopoverContent>
                          </Popover>
                        </td>
                        <td rowSpan={3} className="p-0.5">
                          <SearchableDropdown
                            items={subjectItems}
                            value={entry.subjectCode}
                            onChange={(v) => updateEntry(entry.id, 'subjectCode', v)}
                            onAddItem={onAddSubject}
                            onDeleteItem={onDeleteSubject}
                            placeholder="Subject"
                          />
                        </td>
                        <td rowSpan={3} className="p-0.5">
                          <Input
                            type="number"
                            min={0}
                            value={entry.candidatesRegistered || ''}
                            onChange={(e) =>
                              updateEntry(entry.id, 'candidatesRegistered', Number(e.target.value))
                            }
                            className="h-7 text-xs w-14 border-border bg-card"
                          />
                        </td>
                        <td rowSpan={3} className="p-0.5">
                          <Input
                            type="number"
                            min={0}
                            value={entry.candidatesExamined || ''}
                            onChange={(e) =>
                              updateEntry(entry.id, 'candidatesExamined', Number(e.target.value))
                            }
                            className="h-7 text-xs w-14 border-border bg-card"
                          />
                        </td>
                      </>
                    )}
                    <td className="p-0.5">
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] text-muted-foreground whitespace-nowrap">
                          {ROLE_LABELS[row.examinerRole]?.slice(0, 3)}:
                        </span>
                        <SearchableDropdown
                          items={getExaminerItems(row.examinerRole)}
                          value={row.examinerName}
                          onChange={(v) => updateRow(entry.id, rowIdx, 'examinerName', v)}
                          placeholder={ROLE_LABELS[row.examinerRole]}
                        />
                      </div>
                    </td>
                    <td className="p-0.5">
                      <SearchableDropdown
                        items={collegeItems}
                        value={row.collegeCode}
                        onChange={(v) => updateRow(entry.id, rowIdx, 'collegeCode', v)}
                        onAddItem={onAddCollege}
                        onDeleteItem={onDeleteCollege}
                        placeholder="College"
                      />
                    </td>
                    <td className="text-right text-xs px-2 font-medium">
                      ₹{row.remuneration}
                    </td>
                    <td className="text-right text-xs px-2 font-medium">
                      {row.lumpsumAIE > 0 ? `₹${row.lumpsumAIE}` : '-'}
                    </td>
                    {rowIdx === 0 && (
                      <td rowSpan={3} className="text-right text-xs px-2 font-medium">
                        ₹{entry.otherExpenses}
                      </td>
                    )}
                    <td className="text-right text-xs px-2 font-semibold">
                      ₹{row.total + (rowIdx === 0 ? entry.otherExpenses : 0)}
                    </td>
                    <td className="p-0.5">
                      {rowIdx === 0 && (
                        <Input className="h-7 text-xs border-border bg-card" placeholder="Sign" />
                      )}
                    </td>
                    {rowIdx === 0 && (
                      <td rowSpan={3} className="text-center p-0.5">
                        <button
                          onClick={() => removeEntry(entry.id)}
                          className="text-destructive hover:text-destructive/80"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {/* OTHER EXPENSES row */}
                <tr className="bg-muted/50">
                  <td colSpan={5} className="text-right text-xs font-medium px-2">
                    OTHER EXPENSES
                  </td>
                  <td colSpan={2}></td>
                  <td className="text-right text-xs px-2">-</td>
                  <td className="text-right text-xs px-2">-</td>
                  <td className="text-right text-xs px-2 font-medium">₹{entry.otherExpenses}</td>
                  <td className="text-right text-xs px-2 font-semibold">₹{entry.otherExpenses}</td>
                  <td colSpan={2} className="text-[9px] text-muted-foreground px-1">
                    Separate consolidated Receipt to be enclosed
                  </td>
                </tr>
                {entryErrors.length > 0 && (
                  <tr>
                    <td colSpan={13} className="p-0">
                      <div className="field-error-text px-2 py-1">
                        {entryErrors.map((err, i) => (
                          <span key={i} className="mr-3">⚠ {err}</span>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
          {/* Grand Total */}
          <tr className="bg-secondary">
            <td colSpan={7} className="text-right text-xs font-bold px-2 py-2">
              Total (C/o) =
            </td>
            <td className="text-right text-xs font-bold px-2">
              ₹{entries.reduce((s, e) => s + e.rows.reduce((r, row) => r + row.remuneration, 0), 0)}
            </td>
            <td className="text-right text-xs font-bold px-2">
              ₹{entries.reduce((s, e) => s + e.rows.reduce((r, row) => r + row.lumpsumAIE, 0), 0)}
            </td>
            <td className="text-right text-xs font-bold px-2">
              ₹{entries.reduce((s, e) => s + e.otherExpenses, 0)}
            </td>
            <td className="text-right text-xs font-bold px-2">₹{grandTotal}</td>
            <td colSpan={2}></td>
          </tr>
        </tbody>
      </table>

      <div className="mt-3 flex justify-start">
        <Button onClick={addEntry} variant="outline" size="sm" className="text-xs gap-1">
          <Plus className="w-3.5 h-3.5" /> Add Entry
        </Button>
      </div>

      <p className="text-[10px] text-muted-foreground mt-2">
        * AIE - Allowance to Incidental Expenses. Cumulative columnwise total should be arrived and the grand total to be taken to the main abstract.
      </p>
    </div>
  );
};
