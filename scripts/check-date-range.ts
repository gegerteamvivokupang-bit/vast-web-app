/**
 * Script to check date range of sales data
 * Run with: npx tsx scripts/check-date-range.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('📅 Checking date range of sales data...\n');

  // Get min and max dates
  const { data } = await supabase
    .from('sales')
    .select('sale_date')
    .order('sale_date', { ascending: true })
    .limit(1);

  const { data: maxData } = await supabase
    .from('sales')
    .select('sale_date')
    .order('sale_date', { ascending: false })
    .limit(1);

  if (data && data.length > 0 && maxData && maxData.length > 0) {
    console.log(`📊 Date Range:`);
    console.log(`   Earliest: ${data[0].sale_date}`);
    console.log(`   Latest: ${maxData[0].sale_date}`);

    // Calculate difference
    const earliest = new Date(data[0].sale_date);
    const latest = new Date(maxData[0].sale_date);
    const diffDays = Math.floor((latest.getTime() - earliest.getTime()) / (1000 * 60 * 60 * 24));

    console.log(`   Span: ${diffDays} days`);
    console.log(`\n💡 Recommendation: Set default filter to cover this range`);
  }

  // Check sales per month
  const { data: salesData } = await supabase
    .from('sales')
    .select('sale_date')
    .is('deleted_at', null);

  if (salesData) {
    const byMonth: Record<string, number> = {};
    salesData.forEach(s => {
      const month = s.sale_date.substring(0, 7); // YYYY-MM
      byMonth[month] = (byMonth[month] || 0) + 1;
    });

    console.log(`\n📈 Sales per month:`);
    Object.entries(byMonth)
      .sort()
      .forEach(([month, count]) => {
        console.log(`   ${month}: ${count} records`);
      });
  }
}

main().catch(console.error);
