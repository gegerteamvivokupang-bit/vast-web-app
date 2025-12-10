import * as XLSX from 'xlsx';
const workbook = XLSX.readFile('../Data Sheet Vast (2).xlsx');
const salesSheet = workbook.Sheets['Sheet21'];
const salesRaw: any[] = XLSX.utils.sheet_to_json(salesSheet);

const statuses = new Set<string>();
salesRaw.forEach(row => {
  const status = String(row['STATUS_PENGAJUAN'] || '').trim();
  if (status) statuses.add(status);
});

console.log('Semua status unik di Excel:');
Array.from(statuses).sort().forEach(s => console.log(`  - "${s}"`));
