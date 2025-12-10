// Clean December data from sales table
// Keep only data until November 2025
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
  console.log('=== CLEANING DECEMBER DATA FROM SALES TABLE ===\n');

  // Check data before delete
  console.log('1. Checking December data in sales table...');
  const { data: decData, count: decCount } = await supabase
    .from('sales')
    .select('sale_date', { count: 'exact', head: false })
    .gte('sale_date', '2025-12-01')
    .is('deleted_at', null);

  console.log('   Total rows with sale_date >= 2025-12-01:', decCount);

  if (!decCount || decCount === 0) {
    console.log('   No December data found in sales table.');
    console.log('   ✓ Table is already clean!');
    return;
  }

  // Show breakdown by date
  const byDate = {};
  (decData || []).forEach(r => {
    const d = r.sale_date;
    byDate[d] = (byDate[d] || 0) + 1;
  });

  console.log('\n   Breakdown by date:');
  Object.keys(byDate).sort().forEach(d => {
    console.log('   ', d + ':', byDate[d], 'rows');
  });

  // Delete
  console.log('\n2. Deleting all December data from sales table...');
  const { error, count: deletedCount } = await supabase
    .from('sales')
    .delete({ count: 'exact' })
    .gte('sale_date', '2025-12-01')
    .is('deleted_at', null);

  if (error) {
    console.error('   ERROR:', error);
    process.exit(1);
  }

  console.log('   ✓ Successfully deleted', deletedCount, 'rows');

  // Verify
  console.log('\n3. Verification:');

  // Check no December data remains
  const { count: remainingDec } = await supabase
    .from('sales')
    .select('*', { count: 'exact', head: true })
    .gte('sale_date', '2025-12-01')
    .is('deleted_at', null);

  console.log('   Remaining December data:', remainingDec);

  // Check latest date in sales table
  const { data: latestData } = await supabase
    .from('sales')
    .select('sale_date')
    .is('deleted_at', null)
    .order('sale_date', { ascending: false })
    .limit(1);

  if (latestData && latestData.length > 0) {
    console.log('   Latest sale_date in sales table:', latestData[0].sale_date);
  }

  // Count total November data
  const { count: novCount } = await supabase
    .from('sales')
    .select('*', { count: 'exact', head: true })
    .gte('sale_date', '2025-11-01')
    .lte('sale_date', '2025-11-30')
    .is('deleted_at', null);

  console.log('   Total November 2025 data:', novCount);

  // Count total data in sales table
  const { count: totalSales } = await supabase
    .from('sales')
    .select('*', { count: 'exact', head: true })
    .is('deleted_at', null);

  console.log('   Total data in sales table:', totalSales);

  console.log('\n✓ CLEANUP COMPLETE!');
  console.log('  Sales table now contains data only until November 2025.');
  console.log('  December data onwards should be in vast_finance_applications table.');
}

main().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});
