// Usage:
// SUPABASE_SERVICE_ROLE_KEY=... SUPABASE_URL=... IMPORT_CREATED_BY_USER_ID=8b1562d8-ac6b-414c-8fb8-1072ba9795db node scripts/import-december-1-11-to-vast-finance.js "F:\\vast redesign\\vast-web-app\\Data Sheet Vast (2).xlsx"
// - Deletes sales rows with sale_date 2025-12-01..2025-12-11
// - Imports rows (dates 2025-12-01..2025-12-11) from sheet "Master Data All" enriched with store info from "Data Penjualan Bersih"
// - Skips blank rows and any date outside that window (including 2025-12-12 and excel-blank 1899-12-30)

const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CREATED_BY_USER_ID = process.env.IMPORT_CREATED_BY_USER_ID;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
if (!CREATED_BY_USER_ID) {
  console.error('Missing IMPORT_CREATED_BY_USER_ID (user id to attribute inserts)');
  process.exit(1);
}

const excelPath = process.argv[2];
if (!excelPath || !fs.existsSync(excelPath)) {
  console.error('Excel file not found. Provide path as first arg.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const excelDateToISO = (n) => {
  const date = new Date(Date.UTC(1899, 11, 30));
  date.setUTCDate(date.getUTCDate() + Number(n));
  return date.toISOString().slice(0, 10);
};

const normalizeStatus = (s) => {
  const v = (s || '').trim();
  if (!v) return null;
  const upper = v.toUpperCase();
  if (upper === 'ACC') return 'ACC';
  if (upper.includes('DAPAT')) return 'Dapat limit tapi belum proses';
  if (upper.includes('BELUM')) return 'Belum disetujui';
  if (upper === 'PENDING') return 'Belum disetujui';
  if (upper === 'REJECT') return 'Belum disetujui';
  return v; // fallback
};

const normalizePekerjaan = (p) => {
  const v = (p || '').toLowerCase();
  if (!v) return 'Tidak Bekerja';
  if (v.includes('pns')) return 'PNS';
  if (v.includes('swasta')) return 'Pegawai Swasta';
  if (v.includes('buruh')) return 'Buruh';
  if (v.includes('pelajar') || v.includes('mahasiswa') || v.includes('student')) return 'Pelajar';
  if (v.includes('irt') || v.includes('rumah tangga')) return 'IRT';
  return 'Tidak Bekerja';
};

async function main() {
  const wb = xlsx.readFile(excelPath);
  const sheetMaster = wb.Sheets['Master Data All'];
  const sheetSales = wb.Sheets['Data Penjualan Bersih'];
  if (!sheetMaster || !sheetSales) {
    throw new Error('Required sheets not found (Master Data All / Data Penjualan Bersih)');
  }

  const master = xlsx.utils.sheet_to_json(sheetMaster, { defval: '' });
  const sales = xlsx.utils.sheet_to_json(sheetSales, { defval: '' });

  // Build lookup by raw Timestamp number for store info
  const salesByTs = new Map();
  for (const r of sales) {
    if (!r.Timestamp) continue;
    salesByTs.set(Number(r.Timestamp), {
      store_id: (r['ID Toko'] || '').trim() || null,
      sator: (r['Sator'] || '').trim() || null,
      area: (r['Area'] || '').trim() || null,
      phone_type: (r['Tipe hp'] || '').trim() || null,
      promoter_name: (r['Nama Promotor'] || '').trim() || null,
      status: normalizeStatus(r['Status']),
    });
  }

  // Helper to pick first non-empty promoter field
  const pickPromoter = (row) => {
    const fields = [
      'Nama Promotor',
      'Nama Promotor_1',
      'Nama Promotor_2',
      'Nama Promotor_3',
      'Nama Promotor_4',
      'Nama Promotor_5',
      'Nama Promotor_6',
      'Nama Promotor_7',
      'Nama Promotor_8',
    ];
    for (const f of fields) {
      const v = (row[f] || '').trim();
      if (v) return v;
    }
    return null;
  };

  const rows = master
    .map((r) => {
      if (!r.Timestamp) return null;
      const tsNum = Number(r.Timestamp);
      const dateStr = excelDateToISO(tsNum);
      if (dateStr < '2025-12-01' || dateStr > '2025-12-11') return null; // skip outside range

      const salesInfo = salesByTs.get(tsNum) || {};
      const promoter = pickPromoter(r) || salesInfo.promoter_name || null;
      const status = normalizeStatus(r['Status pengajuan'] || salesInfo.status);

      return {
        dateStr,
        status,
        promoter_name: promoter,
        store_id: salesInfo.store_id || null,
        area: salesInfo.area || (r['Area'] || '').trim() || null,
        sator: salesInfo.sator || null,
        phone_type: salesInfo.phone_type || (r['Tipe HP VIVO yang diambil konsumen'] || '').trim() || null,
        customer_name: String(r['Nama Pemohon Kredit'] || '').trim(),
        customer_phone: String(r['Nomor Telepon Pemohon Kredit'] || '').trim(),
        pekerjaan: normalizePekerjaan(r['Pekerjaan Pemohon Kredit']),
        penghasilan: r['Penghasilan Bulanan Pemohon Kredit'] || null,
        has_npwp: ((r['Apakah ada NPWP'] || '').toLowerCase().includes('ada')), // simple flag
        limit_amount: r['Total limit yang didapatkan'] || null,
        proof_image_url: (r['Upload bukti pengajuan'] || '').trim() || null,
      };
    })
    .filter(Boolean);

  console.log('Parsed rows in date range 2025-12-01..11 (Master):', rows.length);

  // Delete existing sales for that range
  console.log('Deleting existing sales 2025-12-01..11 ...');
  const { error: delErr, count: delCount } = await supabase
    .from('sales')
    .delete({ count: 'exact' })
    .gte('sale_date', '2025-12-01')
    .lte('sale_date', '2025-12-11');
  if (delErr) throw delErr;
  console.log('Deleted sales rows:', delCount ?? 'unknown');

  // Prepare inserts for vast_finance_applications
  const inserts = rows.map((r) => ({
    status_pengajuan: r.status || 'Belum disetujui',
    customer_name: r.customer_name || 'Unknown',
    customer_phone: r.customer_phone || '0000000000',
    pekerjaan: normalizePekerjaan(r.pekerjaan),
    limit_amount: r.limit_amount ? Number(String(r.limit_amount).replace(/[^0-9.]/g, '')) : null,
    promoter_name: r.promoter_name || null,
    store_id: r.store_id || null,
    promoter_id: null,
    phone_type_id: null,
    proof_image_url: r.proof_image_url || null,
    created_by_user_id: CREATED_BY_USER_ID,
    sale_date: r.dateStr,
    created_at: r.dateStr,
    updated_at: r.dateStr,
  }));

  // Chunked insert to avoid payload limits
  const chunkSize = 500;
  let inserted = 0;
  for (let i = 0; i < inserts.length; i += chunkSize) {
    const chunk = inserts.slice(i, i + chunkSize);
    const { error, count } = await supabase
      .from('vast_finance_applications')
      .insert(chunk, { count: 'exact' });
    if (error) throw error;
    inserted += count || chunk.length;
    console.log(`Inserted chunk ${i / chunkSize + 1}:`, count || chunk.length);
  }

  console.log('Done. Inserted rows:', inserted);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
