// Check if December 1-11 data is properly imported
const xlsx = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const excelPath = process.argv[2] || 'Data Sheet Vast (2).xlsx';

const excelDateToISO = (n) => {
  const date = new Date(Date.UTC(1899, 11, 30));
  date.setUTCDate(date.getUTCDate() + Number(n));
  return date.toISOString().slice(0, 10);
};

async function main() {
  console.log('=== CHECKING DECEMBER 1-11 DATA ===\n');

  // 1. Check Excel file
  console.log('1. Checking Excel file:', excelPath);
  const wb = xlsx.readFile(excelPath);
  const sheetMaster = wb.Sheets['Master Data All'];

  if (!sheetMaster) {
    console.log('ERROR: Sheet "Master Data All" not found');
    return;
  }

  const master = xlsx.utils.sheet_to_json(sheetMaster, { defval: '' });

  // Filter data tanggal 1-11 Desember
  const decData = master.filter(r => {
    if (!r.Timestamp) return false;
    const dateStr = excelDateToISO(Number(r.Timestamp));
    return dateStr >= '2025-12-01' && dateStr <= '2025-12-11';
  });

  console.log('   Total rows in Excel (Dec 1-11):', decData.length);

  // Group by date
  const excelByDate = {};
  decData.forEach(r => {
    const dateStr = excelDateToISO(Number(r.Timestamp));
    excelByDate[dateStr] = (excelByDate[dateStr] || 0) + 1;
  });

  console.log('\n   Breakdown by date (Excel):');
  Object.keys(excelByDate).sort().forEach(d => {
    console.log('   ', d + ':', excelByDate[d], 'rows');
  });

  // 2. Check database
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.log('\nERROR: Missing Supabase credentials');
    return;
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  console.log('\n2. Checking database (vast_finance_applications)...');
  const { data, error, count } = await supabase
    .from('vast_finance_applications')
    .select('sale_date, customer_name, promoter_name, status_pengajuan', { count: 'exact', head: false })
    .gte('sale_date', '2025-12-01')
    .lte('sale_date', '2025-12-11')
    .is('deleted_at', null);

  if (error) {
    console.error('   ERROR:', error);
    return;
  }

  console.log('   Total rows in database (Dec 1-11):', count);

  // Group by date
  const dbByDate = {};
  (data || []).forEach(r => {
    const d = r.sale_date;
    dbByDate[d] = (dbByDate[d] || 0) + 1;
  });

  console.log('\n   Breakdown by date (Database):');
  Object.keys(dbByDate).sort().forEach(d => {
    console.log('   ', d + ':', dbByDate[d], 'rows');
  });

  // 3. Compare
  console.log('\n3. COMPARISON:');
  console.log('   Excel total:', decData.length);
  console.log('   Database total:', count);

  if (decData.length === count) {
    console.log('   ✓ ALL DATA IMPORTED SUCCESSFULLY!');
  } else {
    console.log('   ✗ MISMATCH! Missing', decData.length - count, 'rows');

    // Check which dates are missing
    console.log('\n   Date-by-date comparison:');
    const allDates = new Set([...Object.keys(excelByDate), ...Object.keys(dbByDate)]);
    Array.from(allDates).sort().forEach(d => {
      const excelCount = excelByDate[d] || 0;
      const dbCount = dbByDate[d] || 0;
      const diff = excelCount - dbCount;
      const status = diff === 0 ? '✓' : '✗';
      console.log('   ', status, d + ':', 'Excel:', excelCount, '| DB:', dbCount, diff !== 0 ? `(${diff > 0 ? '-' : '+'}${Math.abs(diff)})` : '');
    });
  }

  // 4. Sample data
  console.log('\n4. Sample data from database (first 5 rows):');
  const sample = data.slice(0, 5);
  sample.forEach((s, i) => {
    console.log('   ' + (i + 1) + '.', s.sale_date, '|', s.customer_name, '|', 'Promoter:', s.promoter_name, '|', s.status_pengajuan);
  });
}

main().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});
