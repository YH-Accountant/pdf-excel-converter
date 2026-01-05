const { jsPDF } = require('jspdf');
const fs = require('fs');
const path = require('path');

const doc = new jsPDF({
  orientation: 'portrait',
  unit: 'mm',
  format: 'a4',
});

// Title
doc.setFontSize(18);
doc.setFont('helvetica', 'bold');
doc.text('Withholding Tax Return', 105, 20, { align: 'center' });

doc.setFontSize(12);
doc.setFont('helvetica', 'normal');
doc.text('(Monthly Salary Tax Withholding Report)', 105, 28, { align: 'center' });

// Attribution Period
doc.setFontSize(14);
doc.setFont('helvetica', 'bold');
doc.text('Attribution Month: 2025-03', 105, 45, { align: 'center' });

// Company Info Box
doc.setDrawColor(0);
doc.setLineWidth(0.5);
doc.rect(20, 55, 170, 35);

doc.setFontSize(11);
doc.setFont('helvetica', 'normal');
doc.text('Business Registration No: 123-45-67890', 25, 65);
doc.text('Company Name: ABC Corporation', 25, 73);
doc.text('Representative: Kim Chul-soo', 25, 81);

// Main Data Table
doc.setFontSize(12);
doc.setFont('helvetica', 'bold');
doc.text('Withholding Summary', 20, 105);

// Table Header
const tableStartY = 112;
doc.setFillColor(200, 200, 200);
doc.rect(20, tableStartY, 170, 10, 'F');
doc.setFontSize(10);
doc.text('Category', 25, tableStartY + 7);
doc.text('Persons', 75, tableStartY + 7);
doc.text('Total Payment', 105, tableStartY + 7);
doc.text('Tax Amount', 155, tableStartY + 7);

// Table Data
doc.setFont('helvetica', 'normal');
const data = [
  ['Regular Salary', '45', '225,000,000', '18,500,000'],
  ['Daily Workers', '12', '24,000,000', '720,000'],
  ['Retirement', '2', '80,000,000', '4,800,000'],
  ['Business Income', '8', '32,000,000', '1,056,000'],
  ['Other Income', '3', '6,000,000', '1,320,000'],
];

let currentY = tableStartY + 10;
data.forEach((row, index) => {
  currentY += 8;
  if (index % 2 === 0) {
    doc.setFillColor(245, 245, 245);
    doc.rect(20, currentY - 6, 170, 8, 'F');
  }
  doc.text(row[0], 25, currentY);
  doc.text(row[1], 80, currentY);
  doc.text(row[2], 110, currentY);
  doc.text(row[3], 160, currentY);
});

// Total Row
currentY += 10;
doc.setFillColor(220, 220, 180);
doc.rect(20, currentY - 6, 170, 10, 'F');
doc.setFont('helvetica', 'bold');
doc.text('TOTAL', 25, currentY);
doc.text('70', 80, currentY);
doc.text('367,000,000', 110, currentY);
doc.text('26,396,000', 160, currentY);

// Draw table border
doc.rect(20, tableStartY, 170, currentY - tableStartY + 4);

// Tax Details Section
currentY += 25;
doc.setFontSize(12);
doc.text('Tax Breakdown:', 20, currentY);

currentY += 10;
doc.setFont('helvetica', 'normal');
doc.setFontSize(11);
doc.text('Number of People: 70', 30, currentY);
currentY += 8;
doc.text('Total Payment: 367,000,000 won', 30, currentY);
currentY += 8;
doc.text('Income Tax: 24,000,000 won', 30, currentY);
currentY += 8;
doc.text('Local Income Tax: 2,396,000 won', 30, currentY);

// Key Summary Box
currentY += 20;
doc.setDrawColor(0, 100, 200);
doc.setLineWidth(1);
doc.rect(20, currentY, 170, 40);

doc.setFontSize(12);
doc.setFont('helvetica', 'bold');
doc.setTextColor(0, 100, 200);
doc.text('KEY DATA SUMMARY', 105, currentY + 10, { align: 'center' });

doc.setTextColor(0, 0, 0);
doc.setFontSize(11);
doc.setFont('helvetica', 'normal');
doc.text('Attribution Month: 2025-03', 30, currentY + 20);
doc.text('Number of Employees: 70', 30, currentY + 28);
doc.text('Total Payment: 367,000,000', 110, currentY + 20);
doc.text('Income Tax: 24,000,000', 110, currentY + 28);
doc.text('Local Tax: 2,396,000', 110, currentY + 36);

// Filing Info
currentY += 55;
doc.setFontSize(10);
doc.text('Filing Date: 2025-04-10', 20, currentY);
doc.text('Signature: _______________________', 120, currentY);

// Save
const outputPath = path.join(__dirname, '..', 'test_file', 'withholding_tax_sample.pdf');
const pdfOutput = doc.output('arraybuffer');
fs.writeFileSync(outputPath, Buffer.from(pdfOutput));

console.log('PDF created:', outputPath);
console.log('');
console.log('Sample Data:');
console.log('- Attribution Month: 2025-03');
console.log('- Number of People: 70');
console.log('- Total Payment: 367,000,000');
console.log('- Income Tax: 24,000,000');
console.log('- Local Income Tax: 2,396,000');
