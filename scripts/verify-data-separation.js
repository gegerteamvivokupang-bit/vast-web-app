// Verify data separation between sales and vast_finance_applications tables
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function main() {
  console.log('=== DATA SEPARATION VERIFICATION ===\n');

  // 1. Check sales table
  console.log('1. SALES TABLE (Old Data - until November 2025):');

  const { count: totalSales } = await supabase
    .from('sales')
    .select('*', { count: 'exact', head: true })
    .is('deleted_at', null);

  console.log('   Total rows:', totalSales);

  // Get date range in sales
  const { data: salesDates } = await supabase
    .from('sales')
    .select('sale_date')
    .is('deleted_at', null)
    .order('sale_date', { ascending: true })
    .limit(1);

  const { data: salesDatesMax } = await supabase
    .from('sales')
    .select('sale_date')
    .is('deleted_at', null)
    .order('sale_date', { ascending: false })
    .limit(1);

  if (salesDates && salesDates.length > 0) {
    console.log('   Earliest date:', salesDates[0].sale_date);
  }
  if (salesDatesMax && salesDatesMax.length > 0) {
    console.log('   Latest date:', salesDatesMax[0].sale_date);
  }

  // Check if any December data exists
  const { count: decSales } = await supabase
    .from('sales')
    .select('*', { count: 'exact', head: true })
    .gte('sale_date', '2025-12-01')
    .is('deleted_at', null);

  console.log('   December 2025 data:', decSales, decSales === 0 ? '✓ CLEAN' : '✗ FOUND DECEMBER DATA!');

  // Count November data
  const { count: novSales } = await supabase
    .from('sales')
    .select('*', { count: 'exact', head: true })
    .gte('sale_date', '2025-11-01')
    .lte('sale_date', '2025-11-30')
    .is('deleted_at', null);

  console.log('   November 2025 data:', novSales);

  // 2. Check vast_finance_applications table
  console.log('\n2. VAST_FINANCE_APPLICATIONS TABLE (New Data - from December 2025):');

  const { count: totalVast } = await supabase
    .from('vast_finance_applications')
    .select('*', { count: 'exact', head: true })
    .is('deleted_at', null);

  console.log('   Total rows:', totalVast);

  // Get date range in vast_finance_applications
  const { data: vastDates } = await supabase
    .from('vast_finance_applications')
    .select('sale_date')
    .is('deleted_at', null)
    .order('sale_date', { ascending: true })
    .limit(1);

  const { data: vastDatesMax } = await supabase
    .from('vast_finance_applications')
    .select('sale_date')
    .is('deleted_at', null)
    .order('sale_date', { ascending: false })
    .limit(1);

  if (vastDates && vastDates.length > 0) {
    console.log('   Earliest date:', vastDates[0].sale_date);
  }
  if (vastDatesMax && vastDatesMax.length > 0) {
    console.log('   Latest date:', vastDatesMax[0].sale_date);
  }

  // Count December data
  const { count: decVast } = await supabase
    .from('vast_finance_applications')
    .select('*', { count: 'exact', head: true })
    .gte('sale_date', '2025-12-01')
    .lte('sale_date', '2025-12-09')
    .is('deleted_at', null);

  console.log('   December 1-9, 2025 data:', decVast);

  // Check if any November or earlier data exists
  const { count: beforeDec } = await supabase
    .from('vast_finance_applications')
    .select('*', { count: 'exact', head: true })
    .lt('sale_date', '2025-12-01')
    .is('deleted_at', null);

  console.log('   Data before December:', beforeDec, beforeDec === 0 ? '✓ CLEAN' : '✗ FOUND OLD DATA!');

  // Summary
  console.log('\n3. SUMMARY:');
  console.log('   ─────────────────────────────────────────────────────');
  console.log('   Sales Table:');
  console.log('     • Contains old data (until November 2025)');
  console.log('     • Total rows:', totalSales);
  console.log('     • November 2025:', novSales, 'rows');
  console.log('     • December 2025:', decSales, 'rows', decSales === 0 ? '✓' : '✗');
  console.log('   ─────────────────────────────────────────────────────');
  console.log('   Vast Finance Applications Table:');
  console.log('     • Contains new data (from December 2025)');
  console.log('     • Total rows:', totalVast);
  console.log('     • December 1-9, 2025:', decVast, 'rows');
  console.log('     • Before December:', beforeDec, 'rows', beforeDec === 0 ? '✓' : '✗');
  console.log('   ─────────────────────────────────────────────────────');

  if (decSales === 0 && beforeDec === 0) {
    console.log('\n   ✓ DATA SEPARATION IS CORRECT!');
    console.log('   • Sales: Old data (≤ Nov 2025)');
    console.log('   • Vast Finance: New data (≥ Dec 2025)');
  } else {
    console.log('\n   ✗ DATA SEPARATION HAS ISSUES!');
    if (decSales > 0) {
      console.log('   • Sales table has December data - needs cleanup');
    }
    if (beforeDec > 0) {
      console.log('   • Vast Finance table has old data - needs cleanup');
    }
  }
}

main().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});
