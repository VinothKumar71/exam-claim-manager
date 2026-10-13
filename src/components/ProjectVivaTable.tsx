import React, { useState, useCallback, useEffect } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SearchableDropdown } from '@/components/SearchableDropdown';
import { cn } from '@/lib/utils';
import { 
  ProjectClaimEntry, 
  ClaimEntryRow, 
  ExaminerRole, 
  SubjectInfo, 
  CollegeInfo, 
  ExaminerInfo, 
  ProjectType,
  SubjectCategory 
} from '@/types/claim';
import { calculateProjectRemuneration, calculateOtherExpenses, calculateTotalAIEForDay } from '@/utils/calculations';
import { ROLE_LABELS } from '@/data/defaults';

interface ProjectVivaTableProps {
  entries: ProjectClaimEntry[];
  setEntries: React.Dispatch<React.SetStateAction<ProjectClaimEntry[]>>;
  subjects: SubjectInfo[];
  colleges: CollegeInfo[];
  examiners: ExaminerInfo[];
  projectType: ProjectType;
  onAddSubject: (code: string) => void;
  onDeleteSubject: (code: string) => void;
  onAddCollege: (code: string) => void;
  onDeleteCollege: (code: string) => void;
  onSelectExaminer: (examiner: ExaminerInfo | undefined) => void;
  subjectCategory: SubjectCategory;
  centreCode?: string;
}

const getRolesForType = (type: ProjectType): ExaminerRole[] => {
  if (type === 'ug_regular' || type === 'ug_barch') {
    return ['external', 'internal'];
  }
  return ['external', 'internal', 'supervisor'];
};

function createEmptyProjectEntry(type: ProjectType): ProjectClaimEntry {
  const roles = getRolesForType(type);
  return {
    id: crypto.randomUUID(),
    date: null,
    subjectCode: '',
    projectType: type,
    numGroups: type === 'ug_regular' ? 0 : undefined,
    numCandidates: 0,
    numThesis: type.startsWith('pg') ? 0 : undefined,
    rows: roles.map((role) => ({
      examinerName: '',
      designation: '',
      examinerRole: role,
      collegeCode: '',
      remuneration: 0,
      lumpsumAIE: 0,
      total: 0,
    })),
    aie: 0,
    total: 0,
    includeOtherExpenses: true,
  };
}

export const ProjectVivaTable: React.FC<ProjectVivaTableProps> = (props) => {
  const {
    entries,
    setEntries,
    subjects,
    colleges,
    examiners,
    projectType,
    onAddSubject,
    onDeleteSubject,
    onAddCollege,
    onDeleteCollege,
    onSelectExaminer,
    centreCode,
    subjectCategory,
  } = props;
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const recalculateAll = useCallback(
    (allEntries: ProjectClaimEntry[]): ProjectClaimEntry[] => {
      // 1. Group entries by date
      const entriesByDate: Record<string, ProjectClaimEntry[]> = {};
      allEntries.forEach(e => {
        if (e.date) {
          const d = format(e.date, 'yyyy-MM-dd');
          if (!entriesByDate[d]) entriesByDate[d] = [];
          entriesByDate[d].push(e);
        }
      });

      // 2. Map and calculate
      return allEntries.map((entry) => {
        const dStr = entry.date ? format(entry.date, 'yyyy-MM-dd') : null;
        const dayEntries = dStr ? entriesByDate[dStr] : [];
        
        // Sum total registered for AIE (External only, capped per day)
        // Group by Date + SubjectCode for Other Expenses
        const subjectEntries = dayEntries.filter(e => e.subjectCode === entry.subjectCode);
        const totalRegForSubject = subjectEntries.reduce((s, e) => s + (e.numGroups || e.numCandidates || 0), 0);
        
        // Calculate total other expenses for this subject today (₹5 as per user request)
        const totalOtherExpForSubject = calculateOtherExpenses(totalRegForSubject, subjectCategory);
        
        // Share of other expenses
        let otherExpShare = 0;
        const entryCount = entry.numGroups || entry.numCandidates || 0;
        if (entry.includeOtherExpenses !== false) {
          if (totalRegForSubject > 0) {
            otherExpShare = (entryCount / totalRegForSubject) * totalOtherExpForSubject;
          } else if (subjectEntries[0]?.id === entry.id) {
            otherExpShare = totalOtherExpForSubject;
          }
        }

        // Identify which entry should show the AIE (the first one with an external examiner name)
        const aieHostEntry = dayEntries.find(e => 
          e.rows.some(r => r.examinerRole === 'external' && r.examinerName)
        );
        const isAieHost = aieHostEntry?.id === entry.id;

        const updatedRows = entry.rows.map((row) => {
          // Group by Date + SubjectCode + ExaminerName + ExaminerRole for Remuneration
          const examinerEntries = subjectEntries.filter(e => 
            e.rows.some(r => r.examinerName === row.examinerName && r.examinerRole === row.examinerRole)
          );
          
          // Handle override count across entries if present
          const totalCountForExaminer = examinerEntries.reduce((s, e) => {
            const rowInE = e.rows.find(r => r.examinerName === row.examinerName && r.examinerRole === row.examinerRole);
            const count = rowInE?.overrideCount !== undefined ? rowInE.overrideCount : (e.numGroups || e.numCandidates || 0);
            return s + count;
          }, 0);
          
          const totalThesisForExaminer = examinerEntries.reduce((s, e) => s + (e.numThesis || 0), 0);
          
          // Total remuneration
          const totalRem = calculateProjectRemuneration(
            row.examinerRole, 
            entry.projectType, 
            totalCountForExaminer,
            totalThesisForExaminer
          );
          
          // Share
          let remShare = 0;
          const rowEntryCount = row.overrideCount !== undefined ? row.overrideCount : entryCount;
          if (totalCountForExaminer > 0) {
            remShare = (rowEntryCount / totalCountForExaminer) * totalRem;
          } else if (examinerEntries[0]?.id === entry.id) {
            remShare = totalRem;
          }

          let aie = 0;
          if (row.isLumpsumManual) {
            aie = row.lumpsumAIE;
          } else if (row.examinerRole === 'external' && isAieHost && row.examinerName) {
            // Re-use practical AIE grouping for simplicity as rates/caps are identical
            aie = calculateTotalAIEForDay(dayEntries, row.collegeCode, entry.projectType);
          }
          
          return { ...row, remuneration: Math.round(remShare), lumpsumAIE: aie, total: Math.round(remShare) + aie };
        });

        const finalOtherExp = Math.round(otherExpShare);
        const finalTotal = updatedRows.reduce((sum, r) => sum + r.total, 0) + finalOtherExp;

        return { 
          ...entry, 
          rows: updatedRows, 
          aie: updatedRows.find(r => r.lumpsumAIE > 0)?.lumpsumAIE || 0,
          total: finalTotal 
        };
      });
    },
    [subjectCategory, projectType]
  );

  // Effect to recalculate all entries when category or type changes
  useEffect(() => {
    setEntries((prev) => recalculateAll(prev));
  }, [subjectCategory, projectType, setEntries, recalculateAll]);

  const updateEntry = (id: string, field: keyof ProjectClaimEntry, value: any) => {
    setEntries((prev) => {
      const next = prev.map((e) => {
        if (e.id !== id) return e;
        return { ...e, [field]: value };
      });
      return recalculateAll(next);
    });
  };

  const updateRow = (entryId: string, rowIndex: number, field: keyof ClaimEntryRow, value: any) => {
    setEntries((prev) => {
      const next = prev.map((e) => {
        if (e.id !== entryId) return e;
        const newRows = [...e.rows];
        newRows[rowIndex] = { ...newRows[rowIndex], [field]: value };
        if (field === 'lumpsumAIE') {
          if (value === null) {
            newRows[rowIndex].isLumpsumManual = false;
            newRows[rowIndex].lumpsumAIE = 0;
          } else {
            newRows[rowIndex].isLumpsumManual = true;
          }
        }
        if (field === 'examinerName') {
          const examiner = examiners.find((ex) => ex.name === value);
          if (examiner) {
            newRows[rowIndex].collegeCode = examiner.collegeCode;
            newRows[rowIndex].designation = examiner.designation;
            onSelectExaminer(examiner);
          }
        }
        return { ...e, rows: newRows };
      });
      return recalculateAll(next);
    });
  };

  const addEntry = () => {
    setEntries((prev) => [...prev, createEmptyProjectEntry(projectType)]);
  };

  const removeEntry = (id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const subjectItems = subjects.map((s) => ({ value: s.code, label: `${s.code} - ${s.name}` }));
  const collegeItems = colleges.map((c) => ({ value: c.code, label: `${c.code} - ${c.abbreviated}` }));

  return (
    <div className="overflow-x-auto">
      <table className="govt-table w-full">
        <thead>
          <tr>
            <th className="w-10" rowSpan={2}>Sl.<br />No.</th>
            <th className="w-24" rowSpan={2}>Date</th>
            <th className="w-28" rowSpan={2}>Subject<br />Code</th>
            <th className="w-16" rowSpan={2}>
              {projectType === 'ug_regular' ? 'No. of<br />Groups' : 'No. of<br />Candidates'}
            </th>
            {projectType.startsWith('pg') && <th className="w-16" rowSpan={2}>No. of<br />Thesis</th>}
            <th className="w-40" rowSpan={2}>Name & Designation<br />External / Internal /<br />Supervisor</th>
            <th className="w-32" rowSpan={2}>Code No.<br />College Name<br />(abbreviated)</th>
            <th className="w-20" rowSpan={2}>Rem.<br />(₹)</th>
            <th className="w-18" rowSpan={2}>Lumpsum<br />AIE*<br />(₹)</th>
            <th className="w-18" rowSpan={2}>Other<br />Exp.<br />(₹)</th>
            <th className="w-20" rowSpan={2}>Total<br />(₹)</th>
            <th className="w-24" rowSpan={2}>Signature<br />in full</th>
            <th className="w-8" rowSpan={2}></th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, entryIdx) => (
            <React.Fragment key={entry.id}>
              {entry.rows.map((row, rowIdx) => (
                <tr key={`${entry.id}-${rowIdx}`}>
                  <td className="text-center font-medium text-xs">
                    {rowIdx === 0 ? `${entryIdx + 1}.` : ''}
                  </td>
                  <td className="p-0.5">
                    {rowIdx === 0 ? (
                      <Popover>
                        <PopoverTrigger asChild>
                          <button className="w-full flex items-center justify-between px-1 py-1 text-xs rounded-sm hover:bg-accent">
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
                          />
                        </PopoverContent>
                      </Popover>
                    ) : ''}
                  </td>
                  <td className="p-0.5">
                    {rowIdx === 0 ? (
                      <SearchableDropdown
                        items={subjectItems}
                        value={entry.subjectCode}
                        onChange={(v) => updateEntry(entry.id, 'subjectCode', v)}
                        placeholder="Subject"
                      />
                    ) : ''}
                  </td>
                  <td className="p-0.5">
                    {rowIdx === 0 ? (
                      <Input
                        type="number"
                        min={0}
                        value={(projectType === 'ug_regular' ? entry.numGroups : entry.numCandidates) || ''}
                        onChange={(e) =>
                          updateEntry(
                            entry.id, 
                            projectType === 'ug_regular' ? 'numGroups' : 'numCandidates', 
                            Number(e.target.value)
                          )
                        }
                        className="h-7 text-xs w-full border-border bg-card"
                      />
                    ) : ''}
                  </td>
                  {projectType.startsWith('pg') && (
                    <td className="p-0.5">
                      {rowIdx === 0 ? (
                        <Input
                          type="number"
                          min={0}
                          value={entry.numThesis || ''}
                          onChange={(e) => updateEntry(entry.id, 'numThesis', Number(e.target.value))}
                          className="h-7 text-xs w-full border-border bg-card"
                        />
                      ) : ''}
                    </td>
                  )}
                  <td className="p-0.5">
                    <div className="flex items-center gap-1">
                      {/* Show per-row candidate override for all PG types */}
                      {projectType.startsWith('pg') && (
                        <div className="w-12 shrink-0">
                          <Input
                            type="number"
                            min={0}
                            placeholder="Cands"
                            value={row.overrideCount !== undefined ? row.overrideCount : ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              updateRow(entry.id, rowIdx, 'overrideCount', val === '' ? undefined : Number(val));
                            }}
                            className="h-7 text-[10px] px-1 border-border bg-card w-full"
                            title="Override candidates for this examiner"
                          />
                        </div>
                      )}
                      <span className="text-[9px] text-muted-foreground w-14 shrink-0">
                        {ROLE_LABELS[row.examinerRole]?.slice(0, 3)}:
                      </span>
                      <SearchableDropdown
                         items={examiners
                           .filter(ex => ex.role === row.examinerRole || (row.examinerRole === 'supervisor' && ex.role === 'internal') || !ex.role)
                           .map(ex => ({ value: ex.name, label: ex.designation ? `${ex.name} / ${ex.designation}` : ex.name }))}
                         value={row.examinerName}
                        onChange={(v) => updateRow(entry.id, rowIdx, 'examinerName', v)}
                        placeholder="Examiner"
                      />
                    </div>
                  </td>
                  <td className="p-0.5">
                    <SearchableDropdown
                      items={collegeItems}
                      value={row.collegeCode}
                      onChange={(v) => updateRow(entry.id, rowIdx, 'collegeCode', v)}
                      placeholder="College"
                    />
                  </td>
                  <td className="text-right text-xs px-2 font-medium">
                    {row.remuneration}
                  </td>
                  <td className="p-0.5">
                    <Input
                      type="number"
                      min={0}
                      value={row.isLumpsumManual ? row.lumpsumAIE : (row.lumpsumAIE || '')}
                      onChange={(e) => {
                        const val = e.target.value;
                        updateRow(entry.id, rowIdx, 'lumpsumAIE', val === '' ? null : Number(val));
                      }}
                      className="h-7 text-xs w-full text-right border-border bg-card px-1"
                      placeholder="-"
                    />
                  </td>
                  <td className="text-right text-xs px-2 text-muted-foreground">
                    -
                  </td>
                  <td className="text-right text-xs px-2 font-semibold">
                    {row.total}
                  </td>
                  <td className="p-0.5">
                    {rowIdx === 0 ? (
                      <Input className="h-7 text-xs border-border bg-card" placeholder="Sign" />
                    ) : ''}
                  </td>
                  <td className="text-center p-0.5">
                    {rowIdx === 0 ? (
                      <button onClick={() => removeEntry(entry.id)} className="text-destructive hover:text-destructive/80">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    ) : row.examinerRole === 'supervisor' ? (
                      <button
                        onClick={() => {
                          setEntries((prev) => {
                            const next = prev.map((e) => {
                              if (e.id !== entry.id) return e;
                              // Remove only this specific supervisor row by index
                              const newRows = e.rows.filter((_, i) => i !== rowIdx);
                              return { ...e, rows: newRows };
                            });
                            return recalculateAll(next);
                          });
                        }}
                        className="text-destructive hover:text-destructive/80"
                        title="Delete this Supervisor row"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    ) : rowIdx === entry.rows.length - 1 && getRolesForType(projectType).includes('supervisor') ? (
                      <button
                        onClick={() => {
                          setEntries((prev) => {
                            const next = prev.map((e) => {
                              if (e.id !== entry.id) return e;
                              return {
                                ...e,
                                rows: [
                                  ...e.rows,
                                  {
                                    examinerName: '',
                                    designation: '',
                                    examinerRole: 'supervisor',
                                    collegeCode: '',
                                    remuneration: 0,
                                    lumpsumAIE: 0,
                                    total: 0,
                                  },
                                ],
                              };
                            });
                            return recalculateAll(next);
                          });
                        }}
                        className="text-primary hover:text-primary/80"
                        title="Add Supervisor"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    ) : ''}
                  </td>
                </tr>
              ))}
              {/* OTHER EXPENSES row for Project (₹5 per group/cand) */}
              {entry.includeOtherExpenses !== false ? (
                <tr className="bg-muted/50">
                  <td colSpan={projectType.startsWith('pg') ? 5 : 4} className="text-right text-xs font-medium px-2">
                    OTHER EXPENSES
                  </td>
                  <td colSpan={2}></td>
                  <td className="text-right text-xs px-2">-</td>
                  <td className="text-right text-xs px-2">-</td>
                  <td className="text-right text-xs px-2 font-medium">₹{Math.round(entry.total - entry.rows.reduce((s,r) => s + r.total, 0))}</td>
                  <td className="text-right text-xs px-2 font-semibold">₹{Math.round(entry.total - entry.rows.reduce((s,r) => s + r.total, 0))}</td>
                  <td colSpan={2} className="px-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] text-muted-foreground">Separate consolidated Receipt to be enclosed</span>
                      <button onClick={() => updateEntry(entry.id, 'includeOtherExpenses', false)} className="text-destructive hover:text-destructive/80" title="Remove Other Expenses">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr className="bg-muted/30">
                  <td colSpan={projectType.startsWith('pg') ? 13 : 12} className="text-right text-xs px-2 py-1">
                    <button onClick={() => updateEntry(entry.id, 'includeOtherExpenses', true)} className="text-primary hover:text-primary/80 flex items-center gap-1 justify-end w-full">
                      <Plus className="w-3 h-3" /> Add Other Expenses
                    </button>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
        <tfoot className="bg-secondary/30">
          <tr>
            <td colSpan={projectType.startsWith('pg') ? 7 : 6} className="text-right text-xs font-bold px-2 py-2">
              {entries.length === 1 ? 'Total =' : 'Grand Total ='}
            </td>
            <td className="text-right text-xs font-bold px-2">
              {entries.reduce((sum, e) => sum + e.rows.reduce((s, r) => s + r.remuneration, 0), 0)}
            </td>
            <td className="text-right text-xs font-bold px-2">
              {entries.reduce((sum, e) => sum + e.rows.reduce((s, r) => s + r.lumpsumAIE, 0), 0)}
            </td>
            <td className="text-right text-xs font-bold px-2">
              {entries.reduce((sum, e) => {
                const rowTotals = e.rows.reduce((s,r) => s + r.total, 0);
                return sum + (e.total - rowTotals);
              }, 0)}
            </td>
            <td className="text-right text-xs font-bold px-2">
              ₹{entries.reduce((sum, e) => sum + e.total, 0)}
            </td>
            <td colSpan={2}></td>
          </tr>
        </tfoot>
      </table>
      <div className="mt-3 flex justify-start">
        <Button onClick={addEntry} variant="outline" size="sm" className="text-xs gap-1">
          <Plus className="w-3.5 h-3.5" /> Add Project Entry
        </Button>
      </div>
    </div>
  );
};
