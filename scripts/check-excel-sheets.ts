/**
 * Script to check all Excel sheets and their data
 * Run with: npx tsx scripts/check-excel-sheets.ts
 */

import * as XLSX from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';

const EXCEL_FILE_PATH = path.join(__dirname, '../../Data Sheet Vast (2).xlsx');

async function main() {
  console.log('🔍 Checking Excel file structure...\n');

  if (!fs.existsSync(EXCEL_FILE_PATH)) {
    console.error(`❌ Excel file not found at: ${EXCEL_FILE_PATH}`);
    process.exit(1);
  }

  const workbook = XLSX.readFile(EXCEL_FILE_PATH);

  console.log(`📋 Available sheets: ${workbook.SheetNames.length}\n`);

  // Check each sheet
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const data: any[] = XLSX.utils.sheet_to_json(sheet);

    console.log(`\n📄 Sheet: "${sheetName}"`);
    console.log(`   Total rows: ${data.length}`);

    if (data.length > 0) {
      console.log(`   Columns:`, Object.keys(data[0]));
      console.log(`   Sample row:`, data[0]);

      // Count non-empty rows (rows with at least 3 fields filled)
      const nonEmptyRows = data.filter(row => {
        const values = Object.values(row);
        const filledValues = values.filter(v => v !== undefined && v !== '' && v !== null);
        return filledValues.length >= 3;
      });
      console.log(`   Non-empty rows: ${nonEmptyRows.length}`);
    }
  }
}

main().catch(console.error);
