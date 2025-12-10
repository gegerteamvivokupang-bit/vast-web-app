// Delete data from December 10, 2025
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
  console.log('=== DELETING DECEMBER 10 DATA ===\n');

  // Check data before delete
  const { count: beforeCount } = await supabase
    .from('vast_finance_applications')
    .select('*', { count: 'exact', head: true })
    .eq('sale_date', '2025-12-10')
    .is('deleted_at', null);

  console.log('Rows with sale_date = 2025-12-10:', beforeCount);

  if (!beforeCount || beforeCount === 0) {
    console.log('No data to delete.');
    return;
  }

  // Delete
  console.log('\nDeleting...');
  const { error, count: deletedCount } = await supabase
    .from('vast_finance_applications')
    .delete({ count: 'exact' })
    .eq('sale_date', '2025-12-10')
    .is('deleted_at', null);

  if (error) {
    console.error('ERROR:', error);
    process.exit(1);
  }

  console.log('✓ Successfully deleted', deletedCount, 'rows');

  // Verify
  const { count: afterCount } = await supabase
    .from('vast_finance_applications')
    .select('*', { count: 'exact', head: true })
    .eq('sale_date', '2025-12-10')
    .is('deleted_at', null);

  console.log('\nVerification:');
  console.log('  Rows remaining with sale_date = 2025-12-10:', afterCount);

  // Check total remaining data (Dec 1-9)
  const { count: totalRemaining } = await supabase
    .from('vast_finance_applications')
    .select('*', { count: 'exact', head: true })
    .gte('sale_date', '2025-12-01')
    .lte('sale_date', '2025-12-09')
    .is('deleted_at', null);

  console.log('  Total data Dec 1-9:', totalRemaining);
}

main().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});
