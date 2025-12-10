/**
 * Migration Script: Excel to Supabase
 * Run with: npx tsx scripts/migrate-excel.ts
 */

import * as XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import * as path from 'path';
import * as fs from 'fs';

// Load environment variables
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const EXCEL_FILE_PATH = path.join(__dirname, '../../Data Sheet Vast (2).xlsx');

interface ExcelStore {
  'ID Toko': string;
  'Nama Toko': string;
  'Kota': string;
  'Area Detail': string;
}

interface ExcelPromoter {
  'ID Promotor': string;
  'Promotor': string;
  'Sator': string;
  'Target Pengajuan': number;
  'ID Toko Penempatan': string;
}

interface ExcelSale {
  'TANGGAL': any; // Excel date (from Sheet21)
  'NAMA_PROMOTOR': string;
  'STATUS_PENGAJUAN': string;
  'ID _TOKO': string; // Note: there's a space in column name!
  'SATOR'?: string;
  'TOKO'?: string;
  'AREA'?: string;
}

// Normalize status from Excel
function normalizeStatus(status: string): 'ACC' | 'Pending' | 'Reject' {
  const s = String(status || '').trim().toLowerCase();

  // ACC - sudah ambil HP (hanya "ACC" atau "Acc")
  if (s === 'acc') {
    return 'ACC';
  }

  // PENDING - dapat limit tapi belum ambil HP (cek dulu sebelum reject!)
  if (s.includes('dapat limit') || s.includes('pending')) {
    return 'Pending';
  }

  // REJECT - semua sisanya (no limit, tidak dapat, belum disetujui, sistem error, dll)
  if (
    s === 'reject' ||
    s.includes('reject') ||
    s.includes('belum') ||
    s.includes('tidak') ||
    s.includes('no limit') ||
    s.includes('tolak') ||
    s.includes('sistem') ||
    s.includes('error') ||
    s.includes('eror')
  ) {
    return 'Reject';
  }

  // Log unhandled status
  console.log(`⚠️  Unknown status: "${status}" → defaulting to Reject`);
  return 'Reject'; // Default ke Reject
}

// Convert Excel date to JavaScript Date
function excelDateToJSDate(excelDate: any): string | null {
  if (!excelDate) return null;

  try {
    // If already a date object
    if (excelDate instanceof Date) {
      return excelDate.toISOString().split('T')[0];
    }

    // If it's an Excel serial number
    if (typeof excelDate === 'number') {
      const date = XLSX.SSF.parse_date_code(excelDate);

      // Validate parsed date
      if (!date || !date.y || !date.m || !date.d) {
        console.log(`[DEBUG] Invalid date object from parse_date_code:`, date, 'from:', excelDate);
        return null;
      }

      const year = date.y;
      const month = String(date.m).padStart(2, '0');
      const day = String(date.d).padStart(2, '0');

      return `${year}-${month}-${day}`;
    }

    // If it's a string (DD-MM-YYYY format)
    if (typeof excelDate === 'string') {
      const match = excelDate.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
      if (match) {
        const [, day, month, year] = match;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
    }

    return null;
  } catch (error) {
    console.log(`[DEBUG] Exception in excelDateToJSDate:`, error, 'for value:', excelDate);
    return null;
  }
}

async function main() {
  console.log('🚀 Starting migration from Excel to Supabase...\n');

  if (!fs.existsSync(EXCEL_FILE_PATH)) {
    console.error(`❌ Excel file not found at: ${EXCEL_FILE_PATH}`);
    process.exit(1);
  }

  const workbook = XLSX.readFile(EXCEL_FILE_PATH);

  // Debug: List all sheet names
  console.log(`📋 Available sheets in Excel:`, workbook.SheetNames);
  console.log();

  // 1. MIGRATE STORES
  console.log('📦 Migrating Stores...');
  const storesSheet = workbook.Sheets['Database Toko'];
  if (!storesSheet) {
    console.error('❌ Sheet "Database Toko" not found!');
    process.exit(1);
  }

  const storesRaw: ExcelStore[] = XLSX.utils.sheet_to_json(storesSheet);
  const storesWithDuplicates = storesRaw.map((row) => ({
    id: String(row['ID Toko'] || '').trim(),
    name: String(row['Nama Toko'] || '').trim(),
    area_detail: String(row['Area Detail'] || '').trim(),
  })).filter(s => s.id && s.name);

  // Remove duplicates based on ID
  const seenIds = new Set();
  const stores = storesWithDuplicates.filter(store => {
    if (seenIds.has(store.id)) {
      return false;
    }
    seenIds.add(store.id);
    return true;
  });

  console.log(`   Found ${storesWithDuplicates.length} stores, ${stores.length} unique`);

  // Insert one by one to handle conflicts
  let insertedCount = 0;
  for (const store of stores) {
    const { error } = await supabase
      .from('stores')
      .insert(store);

    if (!error) {
      insertedCount++;
    }
  }

  console.log(`✅ Migrated ${insertedCount} stores\n`);

  // 2. MIGRATE PROMOTERS
  console.log('👥 Migrating Promoters...');
  const promotersSheet = workbook.Sheets['Database Promotor'];
  if (!promotersSheet) {
    console.error('❌ Sheet "Database Promotor" not found!');
    process.exit(1);
  }

  const promotersRaw: ExcelPromoter[] = XLSX.utils.sheet_to_json(promotersSheet);

  console.log(`   Raw promoter count: ${promotersRaw.length}`);
  if (promotersRaw.length > 0) {
    console.log(`   Sample row:`, promotersRaw[0]);
    console.log(`   Available columns:`, Object.keys(promotersRaw[0]));
  }

  const promoters = promotersRaw.map((row) => ({
    name: String(row['Promotor'] || '').trim(),
    sator: String(row['Sator'] || '').trim(),
    target: Number(row['Target Pengajuan']) || 0,
    store_id: String(row['ID Toko Penempatan'] || '').trim(),
    is_active: true,
  })).filter(p => p.name && p.sator);

  console.log(`   After mapping: ${promoters.length} promoters`);

  // Delete existing promoters first
  await supabase.from('promoters').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  const { data: promotersData, error: promotersError } = await supabase
    .from('promoters')
    .insert(promoters);

  if (promotersError) {
    console.error('❌ Error migrating promoters:', promotersError);
  } else {
    console.log(`✅ Migrated ${promoters.length} promoters\n`);
  }

  // 3. MIGRATE SALES (without images initially)
  console.log('💰 Migrating Sales Data...');
  const salesSheet = workbook.Sheets['Sheet21']; // Changed from "Data Penjualan Bersih" to "Sheet21"
  if (!salesSheet) {
    console.error('❌ Sheet "Sheet21" not found!');
    process.exit(1);
  }

  const salesRaw: ExcelSale[] = XLSX.utils.sheet_to_json(salesSheet);

  console.log(`   Raw sales count: ${salesRaw.length}`);

  // Filter out completely empty rows (where all key fields are undefined)
  const salesFiltered = salesRaw.filter(row => {
    return row['TANGGAL'] !== undefined ||
           row['NAMA_PROMOTOR'] !== undefined ||
           row['ID _TOKO'] !== undefined;
  });

  console.log(`   After filtering empty rows: ${salesFiltered.length}`);

  if (salesFiltered.length > 0) {
    console.log(`   Sample row:`, salesFiltered[0]);
    console.log(`   Available columns:`, Object.keys(salesFiltered[0]));
  }

  // Debug: Track filtering reasons
  let failedDateParse = 0;
  let emptyPromoterName = 0;
  let emptyStoreId = 0;
  let successCount = 0;

  const sales = salesFiltered.map((row, index) => {
    const timestamp = row['TANGGAL']; // Updated column name
    const saleDate = excelDateToJSDate(timestamp);

    // Debug rows 0-20 to see the pattern
    if (index < 20) {
      console.log(`   [DEBUG] Row ${index}: timestamp=${timestamp}, promoter=${row['NAMA_PROMOTOR']}, store=${row['ID _TOKO']}, parsed=${saleDate}`);
    }

    // Debug first 5 failed dates
    if (!saleDate) {
      if (failedDateParse < 5) {
        console.log(`   [FAIL] Row ${index}: Full row data:`, JSON.stringify(row));
      }
      failedDateParse++;
      return null;
    }

    const promoterName = String(row['NAMA_PROMOTOR'] || '').trim(); // Updated column name
    const storeId = String(row['ID _TOKO'] || '').trim(); // Updated column name (note the space!)

    if (!promoterName) {
      emptyPromoterName++;
      if (index < 5) console.log(`   [DEBUG] Empty promoter name at row ${index}`);
      return null;
    }

    if (!storeId) {
      emptyStoreId++;
      if (index < 5) console.log(`   [DEBUG] Empty store ID at row ${index}`);
      return null;
    }

    // Filter: Hanya data bulan September ke atas (bulan 9-12), skip Agustus
    const month = parseInt(saleDate.split('-')[1]);
    if (month < 9) {
      return null;
    }

    successCount++;
    return {
      sale_date: saleDate,
      promoter_name: promoterName,
      status: normalizeStatus(String(row['STATUS_PENGAJUAN'] || '')), // Updated column name
      phone_type: '', // Tidak ada kolom tipe hp di Excel
      store_id: storeId,
    };
  }).filter(s => s !== null);

  console.log(`   After mapping: ${sales.length} sales`);
  console.log(`   📊 Filter breakdown:`);
  console.log(`      ✅ Success: ${successCount}`);
  console.log(`      ❌ Failed date parse: ${failedDateParse}`);
  console.log(`      ❌ Empty promoter name: ${emptyPromoterName}`);
  console.log(`      ❌ Empty store ID: ${emptyStoreId}`);

  // Delete existing sales first
  console.log('   Deleting existing sales data...');
  await supabase.from('sales').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  // Insert in batches (1000 at a time to avoid timeout)
  const BATCH_SIZE = 1000;
  let totalInserted = 0;

  for (let i = 0; i < sales.length; i += BATCH_SIZE) {
    const batch = sales.slice(i, i + BATCH_SIZE);
    const { data, error } = await supabase
      .from('sales')
      .insert(batch);

    if (error) {
      console.error(`❌ Error migrating sales batch ${i / BATCH_SIZE + 1}:`, error);
    } else {
      totalInserted += batch.length;
      console.log(`   Inserted batch ${i / BATCH_SIZE + 1}: ${batch.length} records`);
    }
  }

  console.log(`✅ Migrated ${totalInserted} sales records\n`);

  console.log('🎉 Migration completed successfully!');
  console.log('\n📊 Summary:');
  console.log(`   - Stores: ${stores.length}`);
  console.log(`   - Promoters: ${promoters.length}`);
  console.log(`   - Sales: ${totalInserted}`);
}

main().catch(console.error);
