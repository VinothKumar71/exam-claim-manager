import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ClaimEntry, ClaimFormData, BankDetails, ExaminerInfo } from '@/types/claim';
import { ROLE_LABELS } from '@/data/defaults';
import { format } from 'date-fns';

export function generateClaimPDF(formData: ClaimFormData, examiners: ExaminerInfo[]) {
  const doc = new jsPDF('landscape', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();

  // Watermark
  doc.setFontSize(60);
  doc.setTextColor(230, 230, 230);
  doc.text('ANNA UNIVERSITY', pageWidth / 2, 100, { align: 'center', angle: 30 });
  doc.setTextColor(0, 0, 0);

  // Header
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('ANNA UNIVERSITY, Chennai - 25', pageWidth / 2, 15, { align: 'center' });
  doc.setFontSize(9);
  doc.text('OFFICE OF THE CONTROLLER OF EXAMINATIONS', pageWidth / 2, 20, { align: 'center' });
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('ABSTRACT', pageWidth / 2, 25, { align: 'center' });
  doc.setFontSize(7);
  doc.text('CLAIM FORM FOR EXTERNAL / INTERNAL EXAMINERS / SKILLED ASST. & OTHER EXPENSES', pageWidth / 2, 29, { align: 'center' });
  doc.text('LABORATORY WISE STATEMENT FOR PRACTICAL EXAMINATIONS', pageWidth / 2, 33, { align: 'center' });

  // Centre info
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Name of the Examination Centre : ${formData.examinationCentre}`, 14, 40);
  doc.text(`Code : ${formData.centreCode}`, 14, 45);
  doc.text(`Syndicate approval as per Res.195.6.3 w.e.f. 5 May 2009`, pageWidth - 14, 15, { align: 'right' });

  // Build table data
  const tableBody: any[] = [];

  formData.entries.forEach((entry, idx) => {
    const dateStr = entry.date ? format(entry.date, 'dd/MM/yyyy') : '';

    entry.rows.forEach((row, rowIdx) => {
      const rowData: any[] = [];
      if (rowIdx === 0) {
        rowData.push({ content: `${idx + 1}.`, rowSpan: 3, styles: { valign: 'middle', halign: 'center' } });
        rowData.push({ content: dateStr, rowSpan: 3, styles: { valign: 'middle' } });
        rowData.push({ content: entry.subjectCode, rowSpan: 3, styles: { valign: 'middle' } });
        rowData.push({ content: entry.candidatesRegistered.toString(), rowSpan: 3, styles: { valign: 'middle', halign: 'center' } });
        rowData.push({ content: entry.candidatesExamined.toString(), rowSpan: 3, styles: { valign: 'middle', halign: 'center' } });
      }
      rowData.push(`${row.examinerName}\\\\n(${ROLE_LABELS[row.examinerRole]})`);
      rowData.push(row.collegeCode);
      rowData.push(`₹${row.remuneration}`);
      rowData.push(row.lumpsumAIE > 0 ? `₹${row.lumpsumAIE}` : '-');
      if (rowIdx === 0) {
        rowData.push({ content: `₹${entry.otherExpenses}`, rowSpan: 3, styles: { valign: 'middle', halign: 'right' } });
      }
      rowData.push(`₹${row.total + (rowIdx === 0 ? entry.otherExpenses : 0)}`);
      rowData.push('');
      tableBody.push(rowData);
    });

    // OTHER EXPENSES row
    tableBody.push([
      { content: 'OTHER EXPENSES', colSpan: 5, styles: { halign: 'right', fontStyle: 'bold' } },
      '', '',
      '-', '-',
      `₹${entry.otherExpenses}`,
      `₹${entry.otherExpenses}`,
      'Receipt enclosed',
    ]);
  });

  // Grand total
  const grandRemuneration = formData.entries.reduce((s, e) => s + e.rows.reduce((r, row) => r + row.remuneration, 0), 0);
  const grandAIE = formData.entries.reduce((s, e) => s + e.rows.reduce((r, row) => r + row.lumpsumAIE, 0), 0);
  const grandOther = formData.entries.reduce((s, e) => s + e.otherExpenses, 0);
  const grandTotal = grandRemuneration + grandAIE + grandOther;

  tableBody.push([
    { content: 'Total (C/o) =', colSpan: 7, styles: { halign: 'right', fontStyle: 'bold' } },
    `₹${grandRemuneration}`,
    `₹${grandAIE}`,
    `₹${grandOther}`,
    `₹${grandTotal}`,
    '',
  ]);

  autoTable(doc, {
    startY: 50,
    head: [[
      'Sl.\\\nNo.', 'Date', 'Subject\\\nCode', 'No. of\\\nCands.\\\nRegd.', 'No. of\\\nCands.\\\nExamined',
      'Name & Designation\\\nExternal / Internal\\\nSkilled Asst.', 'Code No.\\\nCollege Name',
      'Rem.\\\n(₹)', 'Lumpsum\\\nAIE*\\\n(₹)', 'Other Exp.\\\n(₹)', 'Total\\\n(₹)', 'Signature\\\nin full',
    ]],
    body: tableBody,
    theme: 'grid',
    styles: { fontSize: 6, cellPadding: 1.5 },
    headStyles: { fillColor: [220, 230, 240], textColor: [20, 20, 20], fontStyle: 'bold', halign: 'center' },
    columnStyles: {
      0: { cellWidth: 10 },
      7: { halign: 'right' },
      8: { halign: 'right' },
      9: { halign: 'right' },
      10: { halign: 'right' },
    },
  });

  doc.setFontSize(6);
  doc.text('* AIE - Allowance to Incidental Expenses', 14, doc.internal.pageSize.getHeight() - 10);
  doc.text('Cumulative columnwise total should be arrived and the grand total to be taken to the main abstract', 14, doc.internal.pageSize.getHeight() - 7);

  doc.save('claim-form.pdf');
}

export function generateExternalClaimPDF(
  formData: ClaimFormData,
  examiner: ExaminerInfo,
  subjectCode: string,
  subjectName: string,
  bankDetails: BankDetails
) {
  const doc = new jsPDF('portrait', 'mm', 'a4');
  const pw = doc.internal.pageSize.getWidth();

  // Header
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('ANNA UNIVERSITY', pw / 2, 20, { align: 'center' });
  doc.setFontSize(10);
  doc.text('REGIONAL CAMPUS COIMBATORE', pw / 2, 26, { align: 'center' });
  doc.text('UNIVERSITY EXAMINATIONS', pw / 2, 32, { align: 'center' });

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bolditalic');
  doc.text('PRATICAL / PROJECT EXTERNAL CLAIM FORM', pw / 2, 42, { align: 'center' });

  // Info table
  const infoData = [
    ['PERIOD OF EXAMINATIONS', formData.periodOfExamination || 'NOVEMBER - DECEMBER 2025'],
    ['NAME OF THE DEPARTMENT', formData.departmentName || ''],
    ['SUBJECT CODE', subjectCode],
    ['SUBJECT NAME', subjectName],
  ];

  autoTable(doc, {
    startY: 48,
    body: infoData,
    theme: 'grid',
    styles: { fontSize: 9 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 60 } },
  });

  // Staff Details header
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('STAFF DETAILS', pw / 2, 82, { align: 'center' });

  const staffData = [
    ['Faculty Code & Name', `${examiner.id} - ${examiner.name}`],
    ['Designation', examiner.designation],
    ['College Code & Name', `${examiner.collegeCode} - ${examiner.collegeName}`],
    ['Contact Number', examiner.contactNumber || ''],
  ];

  autoTable(doc, {
    startY: 86,
    body: staffData,
    theme: 'grid',
    styles: { fontSize: 9 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 } },
  });

  // Account Details
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('ACCOUNT DETAILS', pw / 2, 124, { align: 'center' });

  const acctData = [
    ['Account Number', bankDetails.accountNumber],
    ['Account Type', bankDetails.accountType],
    ['Name of the Bank', bankDetails.bankName],
    ['Branch', bankDetails.branch],
    ['IFSC Code', bankDetails.ifscCode],
    ['Amount in Rs.', `₹${bankDetails.amount}/-`],
  ];

  autoTable(doc, {
    startY: 128,
    body: acctData,
    theme: 'grid',
    styles: { fontSize: 9 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 } },
  });

  // Signature line
  doc.setFontSize(9);
  doc.text('Signature of the Faculty', pw - 50, 190);
  doc.line(pw - 70, 185, pw - 20, 185);

  doc.save('external-claim-form.pdf');
}

export function generateAttendanceCertificatePDF(
  examinerName: string,
  collegeName: string,
  fromDate: Date,
  toDate: Date,
  numDays: number
) {
  const doc = new jsPDF('portrait', 'mm', 'a4');
  const pw = doc.internal.pageSize.getWidth();

  // Header
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('ANNA UNIVERSITY', pw / 2, 30, { align: 'center' });
  doc.setFontSize(11);
  doc.text('Chennai - 600 025', pw / 2, 37, { align: 'center' });

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('ATTENDANCE CERTIFICATE', pw / 2, 52, { align: 'center' });
  doc.line(pw / 2 - 45, 54, pw / 2 + 45, 54);

  // Body
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');

  const y = 75;
  doc.text('This is to certify that', 30, y);
  doc.line(100, y, 185, y);
  doc.setFont('helvetica', 'bold');
  doc.text(examinerName, 105, y - 1);
  doc.setFont('helvetica', 'normal');

  doc.text('has attended', 30, y + 15);

  doc.text('at', 30, y + 30);
  doc.line(40, y + 30, 185, y + 30);
  doc.setFont('helvetica', 'bold');
  doc.text(collegeName, 45, y + 29);
  doc.setFont('helvetica', 'normal');

  doc.text('on', 30, y + 45);

  doc.text('from', 30, y + 60);
  doc.line(50, y + 60, 100, y + 60);
  doc.text(format(fromDate, 'dd/MM/yyyy'), 55, y + 59);

  doc.text('to', 110, y + 60);
  doc.line(120, y + 60, 170, y + 60);
  doc.text(format(toDate, 'dd/MM/yyyy'), 125, y + 59);

  doc.text(`both days / ${numDays} day(s)`, 30, y + 75);

  doc.text('inclusive.', 30, y + 90);

  // Footer
  doc.setFontSize(10);
  doc.text('Principal / Chief Superintendent', 30, y + 120);
  doc.line(30, y + 117, 100, y + 117);

  doc.save('attendance-certificate.pdf');
}
