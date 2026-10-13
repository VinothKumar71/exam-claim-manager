import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  ClaimEntry,
  ClaimFormData,
  BankDetails,
  ExaminerInfo,
  ProjectClaimEntry,
  ProjectClaimFormData
} from '@/types/claim';
import { ROLE_LABELS, INITIAL_COLLEGES } from '@/data/defaults';
import { format } from 'date-fns';

import { robotoBase64 } from './robotoFont';
import { calculateTotalAIEForDay } from './calculations';

export function generateClaimPDF(formData: ClaimFormData, examiners: ExaminerInfo[]) {
  const doc = new jsPDF('landscape', 'mm', 'a4');
  doc.addFileToVFS('Roboto-Regular.ttf', robotoBase64);

  doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');

  doc.addFont('Roboto-Regular.ttf', 'Roboto', 'bold');

  doc.setFont('Roboto');

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Watermark
  //doc.setFontSize(60);
  //doc.setTextColor(230, 230, 230);
  //doc.text('ANNA UNIVERSITY', pageWidth / 2, 100, { align: 'center', angle: 30 });
  //doc.setTextColor(0, 0, 0);

  // Header
  doc.setFont('times', 'bold');
  doc.setFontSize(20);
  doc.text('ANNA UNIVERSITY, CHENNAI - 25', pageWidth / 2, 15, {
    align: 'center',
    charSpace: -0.2
  });

  doc.setFontSize(18);
  doc.text('OFFICE OF THE CONTROLLER OF EXAMINATIONS', pageWidth / 2, 22, { align: 'center' });

  doc.setFontSize(14);
  doc.text('ABSTRACT', pageWidth / 2, 30, { align: 'center' });

  doc.setFontSize(12);
  doc.text('CLAIM FORM FOR EXTERNAL / INTERNAL EXAMINERS / SKILLED ASST. & OTHER EXPENSES', pageWidth / 2, 37, { align: 'center' });
  doc.text('LABORATORY WISE STATEMENT FOR PRACTICAL EXAMINATIONS', pageWidth / 2, 42, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('Roboto', 'bold');
  doc.text(`Period of Examinations : ${formData.periodOfExamination}`, pageWidth - 14, 7, { align: 'right' });
  doc.setFontSize(6);
  doc.setFont('Roboto', 'normal');
  doc.text('Syndicate approval as per Res. 195.6.3 w.e.f. 15 Apr 2009', pageWidth - 14, 10, { align: 'right' });
  doc.text('Approved in the 14th Executive Committee meeting w.e.f. 1-4-2014', pageWidth - 14, 13, { align: 'right' });

  // Center info
  doc.setFontSize(10);
  doc.setFont('Roboto', 'normal');
  doc.text(`Code and Name of the Examination Center : ${formData.centreCode} - ${formData.examinationCentre.toUpperCase()}`, 14, 48);
  // Build table data
  const tableBody: any[] = [];

  formData.entries.forEach((entry, idx) => {
    const dateStr = entry.date ? format(entry.date, 'dd/MM/yyyy') : '';

    entry.rows.forEach((row, rowIdx) => {
      const rowData: any[] = [];
      rowData.push({ content: rowIdx === 0 ? `${idx + 1}.` : '', styles: { halign: 'center' } });
      rowData.push({ content: rowIdx === 0 ? dateStr : '' });
      rowData.push({ content: rowIdx === 0 ? entry.subjectCode : '' });
      rowData.push({ content: rowIdx === 0 ? entry.candidatesRegistered.toString() : '', styles: { halign: 'center' } });
      rowData.push({ content: rowIdx === 0 ? entry.candidatesExamined.toString() : '', styles: { halign: 'center' } });

      // 1. Find the college abbreviation using the row's college code
      const matchingCollege = INITIAL_COLLEGES.find(c => c.code === row.collegeCode);
      const collegeAbbrev = matchingCollege ? matchingCollege.abbreviated : '';

      // 2. Push the data into the row
      const roleLabel = row.examinerRole === 'skilled_assistant' ? 'Skilled Assistant' : (row.examinerRole === 'supervisor' ? 'Supervisor' : row.examinerRole.charAt(0).toUpperCase() + row.examinerRole.slice(1));

      // Lookup designation if missing
      let designation = row.designation;
      if (!designation) {
        const examiner = examiners.find(ex => ex.name === row.examinerName);
        if (examiner) designation = examiner.designation;
      }

      // Ensure shorthand (for legacy data)
      if (designation) {
        designation = designation
          .replace(/Assistant Professor/gi, 'AP')
          .replace(/Associate Professor/gi, 'ASP');
      }

      const desigAndRole = designation ? `${designation} / ${roleLabel}` : roleLabel;
      rowData.push(`${row.examinerName}\n${desigAndRole}`);
      rowData.push(`${row.collegeCode}\n${collegeAbbrev}`);
      rowData.push(`${row.remuneration}`);
      rowData.push(row.lumpsumAIE > 0 ? `${row.lumpsumAIE}` : '-');
      rowData.push(rowIdx === 0 ? '-' : '-'); // Manual entries for column 10
      rowData.push(`${row.total}`);
      rowData.push('');
      tableBody.push(rowData);
    });

    // OTHER EXPENSES row
    tableBody.push([
      { content: 'OTHER EXPENSES', colSpan: 5, styles: { halign: 'right', fontStyle: 'bold' } },
      '', '',
      '-', '-',
      `${entry.otherExpenses}`,
      `${entry.otherExpenses}`,
      'Receipt to be enclosed',
    ]);
  });

  // Grand total
  const grandRemuneration = formData.entries.reduce((s, e) => s + e.rows.reduce((r, row) => r + row.remuneration, 0), 0);
  const grandAIE = formData.entries.reduce((s, e) => s + e.rows.reduce((r, row) => r + row.lumpsumAIE, 0), 0);
  const grandOther = formData.entries.reduce((s, e) => s + e.otherExpenses, 0);
  const grandTotal = grandRemuneration + grandAIE + grandOther;

  tableBody.push([
    { content: formData.entries.length === 1 ? 'Total =' : 'Grand Total =', colSpan: 7, styles: { halign: 'right', fontStyle: 'bold' } },
    `${grandRemuneration}`,
    `${grandAIE}`,
    `${grandOther}`,
    `${grandTotal}`,
    { content: '', styles: { fontSize: 7, halign: 'center' } },
  ]);

  autoTable(doc, {
    startY: 52,
    head: [
      [
        'sl.\nNo.', 'Date', 'Subject\nCode', 'No. of\nCands.\nRegd.', 'No. of\nCands.\nExamined',
        'Name & Designation\nExternal / Internal\nSkilled Asst.', 'Code No.\nCollege Name in which working\n(abbreviated)',
        'Rem.\n(₹)', 'Lumpsum\nAIE*\n(₹)', 'Other Exp.\n(₹)', 'Total\n(₹)', 'Signature\nin full',
      ],
      ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '']
    ],
    body: tableBody,
    theme: 'grid',
    styles: {
      font: 'Roboto',
      fontSize: 10,
      cellPadding: 1.5,
      lineWidth: 0.4,
      lineColor: [0, 0, 0],
      textColor: [0, 0, 0],
      halign: 'center',
      valign: 'middle'
    },
    headStyles: {
      font: 'Roboto',
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      halign: 'center'
    },
    columnStyles: {
      5: { halign: 'left' },
      6: { halign: 'left' }
    }
  });

  const finalY = (doc as any).lastAutoTable.finalY + 10;

  // Disclaimer and Footer
  doc.setFontSize(7);
  doc.text('Cumulative columnwise total should be arrived and the grand total to be taken to the main abstract', 14, pageHeight - 12);
  doc.text('* AIE - Allowance to Incidental Expenses (only to the external examiners)', 14, pageHeight - 8);

  doc.save('practical-claim-statement.pdf');
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

  doc.addFileToVFS('Roboto-Regular.ttf', robotoBase64);
  doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');

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
    ['Faculty Name', `${examiner.name}`],
    ['Designation', (examiner.designation || '')
      .replace(/Assistant Professor/gi, 'AP')
      .replace(/Associate Professor/gi, 'ASP')],
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
    styles: { font: 'Roboto', fontSize: 9 },
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
  designation: string,
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
  doc.line(70, y, pw - 30, y);
  doc.setFont('helvetica', 'bold');
  const staffStr = designation ? `${examinerName}, ${designation.replace(/Assistant Professor/gi, 'AP').replace(/Associate Professor/gi, 'ASP')}` : examinerName;
  doc.text(staffStr, 75, y - 1);
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

export function generateProjectClaimPDF(
  formData: ProjectClaimFormData,
  allExaminers: ExaminerInfo[]
) {
  const doc = new jsPDF('landscape', 'mm', 'a4');
  doc.addFileToVFS('Roboto-Regular.ttf', robotoBase64);
  doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
  doc.addFont('Roboto-Regular.ttf', 'Roboto', 'bold');

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Top Right Small Text
  doc.setFontSize(10);
  doc.setFont('Roboto', 'bold');
  doc.text(`Period of Examinations : ${formData.periodOfExamination}`, pageWidth - 14, 7, { align: 'right' });
  doc.setFontSize(6);
  doc.setFont('Roboto', 'normal');
  doc.text('Syndicate approval as per Res. 195.6.3 w.e.f. 15 Apr 2009', pageWidth - 14, 10, { align: 'right' });
  doc.text('Approved in the 14th Executive Committee meeting w.e.f. 1-4-2014', pageWidth - 14, 13, { align: 'right' });

  // Header
  doc.setFont('times', 'bold');
  doc.setFontSize(14);
  doc.text('ANNA UNIVERSITY, CHENNAI - 25', pageWidth / 2, 20, { align: 'center' });

  doc.setFontSize(12);
  doc.text('OFFICE OF THE CONTROLLER OF EXAMINATIONS', pageWidth / 2, 26, { align: 'center' });

  doc.setFontSize(11);
  doc.text('ABSTRACT', pageWidth / 2, 32, { align: 'center' });

  doc.setFontSize(10);
  doc.text('CLAIM FORM FOR EXTERNAL / INTERNAL EXAMINERS / SKILLED ASST. / SUPERVISOR', pageWidth / 2, 38, { align: 'center' });
  doc.text('AEC WISE STATEMENT FOR PROJECT VIVA-VOCE EXAMINATIONS', pageWidth / 2, 42, { align: 'center' });

  // Center info
  doc.setFontSize(10);
  doc.setFont('Roboto', 'normal');
  doc.text(`Code and Name of the Examination Center : ${formData.centreCode} - ${formData.examinationCentre.toUpperCase()}`, 14, 48);
  doc.text(`Department : ${formData.departmentName}`, pageWidth - 14, 48, { align: 'right' });

  // Build table data
  const tableBody: any[] = [];

  formData.entries.forEach((entry, idx) => {
    const dateStr = entry.date ? format(entry.date, 'dd/MM/yyyy') : '-';

    // Determine the count string
    let countStr = '';
    if (formData.projectType === 'ug_regular') {
      countStr = `${entry.numGroups || 0} Grps`;
    } else {
      countStr = `${entry.numCandidates || 0} Cand`;
    }

    entry.rows.forEach((row, rowIdx) => {
      const rowData: any[] = [];
      const numRows = entry.rows.length;

      rowData.push({ content: rowIdx === 0 ? `${idx + 1}.` : '', styles: { halign: 'center' } });
      rowData.push({ content: rowIdx === 0 ? dateStr : '' });
      rowData.push({ content: rowIdx === 0 ? entry.subjectCode : '' });
      rowData.push({ content: rowIdx === 0 ? countStr : '', styles: { halign: 'center' } });

      const matchingCollege = INITIAL_COLLEGES.find(c => c.code === row.collegeCode);
      const collegeAbbrev = matchingCollege ? matchingCollege.abbreviated : '';

      let thesisText = '';
      if (entry.numThesis && row.examinerRole === 'external') {
        thesisText = `\n(${entry.numThesis} Thesis)`;
      }

      const roleLabel = row.examinerRole === 'skilled_assistant' ? 'Skilled Assistant' : (row.examinerRole === 'supervisor' ? 'Supervisor' : row.examinerRole.charAt(0).toUpperCase() + row.examinerRole.slice(1));

      // Lookup designation if missing
      let designation = row.designation;
      if (!designation) {
        const examiner = allExaminers.find(ex => ex.name === row.examinerName);
        if (examiner) designation = examiner.designation;
      }

      // Ensure shorthand (for legacy data)
      if (designation) {
        designation = designation
          .replace(/Assistant Professor/gi, 'AP')
          .replace(/Associate Professor/gi, 'ASP');
      }

      const desigAndRole = designation ? `${designation} / ${roleLabel}${thesisText || ''}` : `${roleLabel}${thesisText || ''}`;
      rowData.push(`${row.examinerName}\n${desigAndRole}`);
      rowData.push(`${row.collegeCode}\n${collegeAbbrev}`);
      rowData.push(`₹${row.remuneration}`);
      rowData.push(row.lumpsumAIE > 0 ? `₹${row.lumpsumAIE}` : '-');
      rowData.push('-');

      // Total for the row
      rowData.push(`₹${row.total}`);
      rowData.push(''); // Signature column
      tableBody.push(rowData);
    });

    // OTHER EXPENSES row
    const rowTotals = entry.rows.reduce((sum, r) => sum + r.total, 0);
    const otherExp = Math.round(entry.total - rowTotals);
    tableBody.push([
      { content: 'OTHER EXPENSES', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold' } },
      '', '',
      '-', '-',
      `₹${otherExp}`,
      `₹${otherExp}`,
      'Receipt to be enclosed',
    ]);
  });

  // Calculate Totals for Summary
  const subTotal = formData.entries.reduce((sum, e) => sum + e.rows.reduce((s, r) => s + r.remuneration, 0), 0);
  const totalAIE = formData.entries.reduce((sum, e) => sum + e.rows.reduce((s, r) => s + r.lumpsumAIE, 0), 0);
  const totalOther = formData.entries.reduce((sum, e) => sum + Math.round(e.total - e.rows.reduce((s,r) => s + r.total, 0)), 0);
  const grandTotal = subTotal + totalAIE + totalOther;

  tableBody.push([
    { content: formData.entries.length === 1 ? 'Total =' : 'Grand Total =', colSpan: 6, styles: { halign: 'right', fontStyle: 'bold' } },
    `₹${subTotal}`,
    `₹${totalAIE}`,
    `₹${totalOther}`,
    `₹${grandTotal}`,
    { content: '', styles: { fontSize: 7, halign: 'center' } },
  ]);

  autoTable(doc, {
    startY: 52,
    head: [
      [
        'sl.\nNo.', 'Date', 'Subject\nCode', 'No. of\nGrps/Cands',
        'Name & Designation\nExternal / Internal / Supervisor', 'Code No.\nCollege Name in which working\n(abbreviated)',
        'Rem.\n(₹)', 'Lumpsum\nAIE*\n(₹)', 'Other Exp.\n(₹)', 'Total\n(₹)', 'Signature\nin full',
      ],
      ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11']
    ],
    body: tableBody,
    theme: 'grid',
    styles: {
      font: 'Roboto',
      fontSize: 10,
      cellPadding: 1.5,
      lineWidth: 0.4,
      lineColor: [0, 0, 0],
      textColor: [0, 0, 0],
      halign: 'center',
      valign: 'middle'
    },
    headStyles: {
      font: 'Roboto',
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      halign: 'center'
    },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 25 },
      2: { cellWidth: 30 },
      3: { cellWidth: 25 },
      4: { halign: 'left' },
      5: { halign: 'left' },
    },
    didDrawPage: (data) => {
    }
  });

  const lastTableFinalY = (doc as any).lastAutoTable.finalY || 75;

  // Disclaimer and Footer
  doc.setFontSize(7);
  doc.text('Cumulative columnwise total should be arrived and the grand total to be taken to the main abstract', 14, pageHeight - 12);
  doc.text('* AIE - Allowance to Incidental Expenses (only to the external examiners)', 14, pageHeight - 8);

  doc.setFontSize(10);
  doc.text('Signature of the Principal / Chief Superintendent', pageWidth - 14, pageHeight - 15, { align: 'right' });
  doc.line(pageWidth - 80, pageHeight - 20, pageWidth - 14, pageHeight - 20);

  doc.save(`project-claim-${formData.projectType}.pdf`);
}
