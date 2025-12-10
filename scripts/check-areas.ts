/**
 * Script to check unique area values in database
 * Run with: npx tsx scripts/check-areas.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('🔍 Checking area_detail values...\n');

  // Get all unique area_detail values from stores
  const { data: stores } = await supabase
    .from('stores')
    .select('area_detail')
    .order('area_detail');

  const uniqueAreas = [...new Set(stores?.map(s => s.area_detail) || [])];

  console.log(`📊 Unique areas in stores table:`);
  uniqueAreas.forEach(area => {
    const count = stores?.filter(s => s.area_detail === area).length || 0;
    console.log(`   "${area}" - ${count} stores`);
  });

  // Get sample sales with area_detail
  const { data: sales } = await supabase
    .from('sales_with_details')
    .select('area_detail')
    .limit(100);

  const uniqueSalesAreas = [...new Set(sales?.map(s => s.area_detail).filter(Boolean) || [])];

  console.log(`\n📊 Unique areas in sales_with_details view:`);
  uniqueSalesAreas.forEach(area => {
    console.log(`   "${area}"`);
  });

  // Count sales per area
  for (const area of uniqueSalesAreas) {
    const { count } = await supabase
      .from('sales_with_details')
      .select('*', { count: 'exact', head: true })
      .eq('area_detail', area);

    console.log(`   ${area}: ${count} sales`);
  }
}

main().catch(console.error);
