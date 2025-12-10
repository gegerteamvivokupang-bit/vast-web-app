/**
 * Script to verify migrated data
 * Run with: npx tsx scripts/verify-data.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('🔍 Verifying migrated data...\n');

  // Count stores
  const { count: storesCount } = await supabase
    .from('stores')
    .select('*', { count: 'exact', head: true });

  console.log(`📦 Stores: ${storesCount}`);

  // Count promoters
  const { count: promotersCount } = await supabase
    .from('promoters')
    .select('*', { count: 'exact', head: true });

  console.log(`👥 Promoters: ${promotersCount}`);

  // Count sales
  const { count: salesCount } = await supabase
    .from('sales')
    .select('*', { count: 'exact', head: true })
    .is('deleted_at', null);

  console.log(`💰 Sales: ${salesCount}`);

  // Get sales breakdown by status
  const { data: salesData } = await supabase
    .from('sales')
    .select('status')
    .is('deleted_at', null);

  if (salesData) {
    const acc = salesData.filter(s => s.status === 'ACC').length;
    const pending = salesData.filter(s => s.status === 'Pending').length;
    const reject = salesData.filter(s => s.status === 'Reject').length;

    console.log(`\n📊 Sales Breakdown:`);
    console.log(`   ACC: ${acc} (${((acc / salesData.length) * 100).toFixed(1)}%)`);
    console.log(`   Pending: ${pending} (${((pending / salesData.length) * 100).toFixed(1)}%)`);
    console.log(`   Reject: ${reject} (${((reject / salesData.length) * 100).toFixed(1)}%)`);
  }

  // Get sample sales with details
  const { data: sampleSales } = await supabase
    .from('sales_with_details')
    .select('*')
    .limit(5);

  console.log(`\n📝 Sample sales data:`);
  if (sampleSales && sampleSales.length > 0) {
    sampleSales.forEach((sale, idx) => {
      console.log(`   ${idx + 1}. ${sale.sale_date} - ${sale.promoter_name} - ${sale.status} - ${sale.store_name || 'N/A'}`);
    });
  }

  console.log('\n✅ Verification complete!');
}

main().catch(console.error);
