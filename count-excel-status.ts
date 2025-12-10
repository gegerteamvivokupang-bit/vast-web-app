import * as XLSX from 'xlsx';

function excelDateToJSDate(excelDate: any): string | null {
  if (!excelDate) return null;
  if (typeof excelDate === 'number') {
    const date = XLSX.SSF.parse_date_code(excelDate);
    if (!date || !date.y || !date.m || !date.d) return null;
    return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
  }
  return null;
}

const workbook = XLSX.readFile('../Data Sheet Vast (2).xlsx');
const salesSheet = workbook.Sheets['Sheet21'];
const salesRaw: any[] = XLSX.utils.sheet_to_json(salesSheet);

const statusCount: Record<string, number> = {};
let totalSept = 0;

salesRaw.forEach(row => {
  const dateStr = excelDateToJSDate(row['TANGGAL']);
  if (!dateStr) return;

  const month = parseInt(dateStr.split('-')[1]);
  if (month < 9) return; // Skip Agustus

  const storeId = String(row['ID _TOKO'] || '').trim();
  if (!storeId) return; // Skip empty store

  totalSept++;
  const status = String(row['STATUS_PENGAJUAN'] || '').trim();
  statusCount[status] = (statusCount[status] || 0) + 1;
});

console.log('\n=== DATA ASLI EXCEL (Sept-Des) ===');
console.log(`Total records: ${totalSept}\n`);

const sorted = Object.entries(statusCount).sort((a, b) => b[1] - a[1]);
sorted.forEach(([status, count]) => {
  const pct = ((count / totalSept) * 100).toFixed(1);
  console.log(`${status.padEnd(50)} : ${count.toString().padStart(4)} (${pct}%)`);
});
