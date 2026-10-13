import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { ClaimEntry } from '@/types/claim';
import { calculateOtherExpenses, calculateTotalAIEForDay } from './calculations';

/**
 * Export practical claim entries to an Excel sheet matching the official
 * "DAY WISE ABSTRACT" format exactly.
 *
 * @param entries     All ClaimEntry objects (will be filtered/sorted internally)
 * @param period      e.g. "NOVEMBER - DECEMBER 2025"
 * @param filterFrom  Optional: include only entries on or after this date
 * @param filterTo    Optional: include only entries on or before this date
 */
export function exportPracticalToExcel(
  entries: ClaimEntry[],
  period: string,
  filterFrom?: Date | null,
  filterTo?: Date | null,
) {
  // 1. Filter & sort
  let valid = entries.filter(e => e.date && e.subjectCode);

  if (filterFrom) {
    const from = new Date(filterFrom); from.setHours(0, 0, 0, 0);
    valid = valid.filter(e => e.date! >= from);
  }
  if (filterTo) {
    const to = new Date(filterTo); to.setHours(23, 59, 59, 999);
    valid = valid.filter(e => e.date! <= to);
  }

  valid.sort((a, b) => a.date!.getTime() - b.date!.getTime());

  if (valid.length === 0) return false;

  // 2. Build data rows
  const dataAOA: any[][] = [];

  let totExtAmt = 0, totLump = 0, totExtTot = 0;
  let totIntRem = 0, totIntTot = 0;
  let totSkilled = 0, totOther = 0, totGrand = 0;

  // Group entries by date for AIE capping (same as PracticalClaim.tsx)
  const entriesByDate: Record<string, ClaimEntry[]> = {};
  valid.forEach(e => {
    const dk = format(e.date!, 'yyyy-MM-dd');
    if (!entriesByDate[dk]) entriesByDate[dk] = [];
    entriesByDate[dk].push(e);
  });

  valid.forEach((entry, idx) => {
    const extRow = entry.rows.find(r => r.examinerRole === 'external');
    const intRow = entry.rows.find(r => r.examinerRole === 'internal');
    const sklRow = entry.rows.find(r => r.examinerRole === 'skilled_assistant');

    const extAmt  = extRow?.remuneration ?? 0;
    const lump    = extRow?.lumpsumAIE   ?? 0;
    const extTot  = extAmt + lump;
    const intRem  = intRow?.remuneration ?? 0;
    const intTot  = intRow?.total        ?? intRem;
    const skilled = sklRow?.remuneration ?? 0;

    // Other expenses
    const dk = format(entry.date!, 'yyyy-MM-dd');
    const dayGroup = entriesByDate[dk] || [entry];
    const otherExp = entry.otherExpenses
      ?? calculateOtherExpenses(entry.candidatesRegistered, 'regular');

    const rowTotal = extTot + intTot + skilled + otherExp;

    totExtAmt += extAmt; totLump   += lump;   totExtTot += extTot;
    totIntRem += intRem; totIntTot += intTot;
    totSkilled += skilled; totOther += otherExp; totGrand += rowTotal;

    dataAOA.push([
      idx + 1,                              // (1)  Sl. No
      format(entry.date!, 'dd.MM.yy'),     // (2)  Date
      entry.subjectCode,                    // (3)  Subject Code
      entry.candidatesExamined,            // (4)  No.of Candidates Examined
      extAmt,                               // (5)  External Amount
      lump,                                 // (6)  External Lumpsum
      extTot,                               // (7)  External Total
      intRem,                               // (8)  Internal Remu.
      intTot,                               // (9)  Internal Total
      skilled,                              // (10) Skilled Asst.
      otherExp,                             // (11) Other Expenses
      rowTotal,                             // (12) Total
    ]);
  });

  // Balance C/o (totals) row
  const balRow: any[] = [
    '', '', '', 'Balance C/o',
    totExtAmt, totLump, totExtTot,
    totIntRem, totIntTot,
    totSkilled, totOther, totGrand,
  ];

  // ── Title rows ──────────────────────────────────────────────
  const titleAOA: any[][] = [
    ['PRACTICAL'],
    [`DAY WISE ABSTRACT - PRACTICAL EXAMINATIONS ${period.toUpperCase()}`],
    ['*Please follow the instruction No.1 of this communications'],
    ['(Days total should be filled herein)'],
    // Header row 1 (row index 4)
    [
      'Sl.\nNo',
      'Date',
      'Subject\nCode',
      'No.of\nCandida\nte\nExamine\nd',
      'External\nRemuneration', '',
      'Tot\nal\nin\nRs.',
      'Interna\nl\nRemu.\nin Rs.',
      'Total\nin\nRs.',
      'Skill\ned\nAsst.\nRs.',
      'Other\nExpens\nes\nRs.',
      'Total\nin\nRs.',
    ],
    // Header row 2 (row index 5)
    [
      '(1)', '(2)', '(3)', '(4)',
      'Amount\nin Rs.', 'Lumpsu\nm\nin Rs.', '(7)',
      '(8)', '(9)',
      '(10)', '(11)', '(12)',
    ],
  ];

  const allRows = [...titleAOA, ...dataAOA, balRow];
  const ws = XLSX.utils.aoa_to_sheet(allRows);

  // ── Merges ───────────────────────────────────────────────────
  // Rows 0-3: full-width title merges (12 columns = A-L = 0-11)
  // Row 4: column header spans
  // Row 5: sub-header (no additional merges needed)
  ws['!merges'] = [
    // Title rows — span all 12 columns
    { s: { r: 0, c: 0 }, e: { r: 0, c: 11 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 11 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 11 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: 11 } },
    // Header row 1 — individual column spans across two header rows
    { s: { r: 4, c: 0 }, e: { r: 5, c: 0 } },   // Sl. No
    { s: { r: 4, c: 1 }, e: { r: 5, c: 1 } },   // Date
    { s: { r: 4, c: 2 }, e: { r: 5, c: 2 } },   // Subject Code
    { s: { r: 4, c: 3 }, e: { r: 5, c: 3 } },   // No.of Candidates
    { s: { r: 4, c: 4 }, e: { r: 4, c: 5 } },   // External Remuneration (spans cols 4-5)
    { s: { r: 4, c: 6 }, e: { r: 5, c: 6 } },   // Total col 7
    { s: { r: 4, c: 7 }, e: { r: 5, c: 7 } },   // Internal Remu.
    { s: { r: 4, c: 8 }, e: { r: 5, c: 8 } },   // Internal Total
    { s: { r: 4, c: 9 }, e: { r: 5, c: 9 } },   // Skilled Asst.
    { s: { r: 4, c: 10 }, e: { r: 5, c: 10 } }, // Other Expenses
    { s: { r: 4, c: 11 }, e: { r: 5, c: 11 } }, // Total col 12
  ];

  // ── Column widths ─────────────────────────────────────────────
  ws['!cols'] = [
    { wch: 5  },  // Sl.No
    { wch: 9  },  // Date
    { wch: 9  },  // Subject Code
    { wch: 10 },  // No.of Candidates
    { wch: 9  },  // Ext Amount
    { wch: 9  },  // Lumpsum
    { wch: 7  },  // Ext Total
    { wch: 9  },  // Int Remu.
    { wch: 7  },  // Int Total
    { wch: 7  },  // Skilled
    { wch: 9  },  // Other Exp
    { wch: 7  },  // Grand Total
  ];

  // ── Row heights ───────────────────────────────────────────────
  ws['!rows'] = [
    { hpt: 16 }, // PRACTICAL
    { hpt: 20 }, // DAY WISE ABSTRACT
    { hpt: 14 }, // Instruction
    { hpt: 14 }, // Days total
    { hpt: 56 }, // Header row 1 (multi-line)
    { hpt: 28 }, // Header row 2
  ];

  // ── Write file ────────────────────────────────────────────────
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Practical Abstract');

  const dateTag = filterFrom && filterTo
    ? `${format(filterFrom, 'ddMMMyy')}_to_${format(filterTo, 'ddMMMyy')}`
    : format(new Date(), 'yyyyMMdd');

  XLSX.writeFile(wb, `Practical_Abstract_${dateTag}.xlsx`);
  return true;
}
