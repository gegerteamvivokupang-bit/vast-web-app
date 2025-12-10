/**
 * Script to check sator data grouped by area
 * Run with: npx tsx scripts/check-sator.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('👥 Checking SATOR data...\n');

  // Get all unique sator from promoters table
  const { data: promoters } = await supabase
    .from('promoters')
    .select('name, sator, store_id')
    .order('sator');

  console.log(`📊 Total Promoters: ${promoters?.length || 0}\n`);

  // Get unique sator names
  const uniqueSators = [...new Set(promoters?.map(p => p.sator).filter(Boolean) || [])];
  console.log(`📊 Unique SATOR: ${uniqueSators.length}`);

  uniqueSators.forEach(sator => {
    const count = promoters?.filter(p => p.sator === sator).length || 0;
    console.log(`   ${sator}: ${count} promoters`);
  });

  // Get stores to map area
  const { data: stores } = await supabase
    .from('stores')
    .select('id, name, area_detail');

  const storeMap = new Map(stores?.map(s => [s.id, s]) || []);

  console.log('\n📍 SATOR grouped by AREA:\n');

  // Group by area
  const byArea: Record<string, Record<string, string[]>> = {};

  promoters?.forEach(p => {
    const store = storeMap.get(p.store_id);
    const area = store?.area_detail || 'UNKNOWN';
    const sator = p.sator || 'NO SATOR';

    if (!byArea[area]) byArea[area] = {};
    if (!byArea[area][sator]) byArea[area][sator] = [];
    byArea[area][sator].push(p.name);
  });

  // Print by area
  Object.entries(byArea).sort().forEach(([area, sators]) => {
    console.log(`📍 ${area}:`);
    Object.entries(sators).sort().forEach(([sator, promoters]) => {
      console.log(`   └─ ${sator}`);
      console.log(`      Promoters (${promoters.length}): ${promoters.slice(0, 3).join(', ')}${promoters.length > 3 ? '...' : ''}`);
    });
    console.log('');
  });

  // Check sales data - what sator values are in sales_with_details
  const { data: sales } = await supabase
    .from('sales_with_details')
    .select('sator, area_detail')
    .limit(1000);

  const uniqueSalesSators = [...new Set(sales?.map(s => s.sator).filter(Boolean) || [])];

  console.log(`\n📊 SATOR in sales data: ${uniqueSalesSators.length} unique values`);
  uniqueSalesSators.forEach(sator => {
    const count = sales?.filter(s => s.sator === sator).length || 0;
    console.log(`   ${sator}: ${count} sales (from sample)`);
  });
}

main().catch(console.error);
