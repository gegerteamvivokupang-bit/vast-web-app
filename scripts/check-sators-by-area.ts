import { supabase } from '../lib/supabase';

async function checkSatorsByArea() {
  console.log('Checking sators in each area...\n');

  // Get all sales data with area and sator info
  const { data: sales, error } = await supabase
    .from('sales_with_details')
    .select('area_detail, sator, promoter_name')
    .not('sator', 'is', null)
    .not('area_detail', 'is', null);

  if (error) {
    console.error('Error:', error);
    return;
  }

  // Group by area and sator
  const areaMap = new Map<string, Map<string, Set<string>>>();

  sales?.forEach((s) => {
    const area = s.area_detail;
    const sator = s.sator;
    const promoter = s.promoter_name;

    if (!areaMap.has(area)) {
      areaMap.set(area, new Map());
    }

    const satorMap = areaMap.get(area)!;
    if (!satorMap.has(sator)) {
      satorMap.set(sator, new Set());
    }

    satorMap.get(sator)?.add(promoter);
  });

  // Display results
  console.log('Sator per Area:');
  console.log('================\n');

  ['KUPANG', 'KABUPATEN', 'SUMBA'].forEach((area) => {
    console.log(`${area}:`);
    const satorMap = areaMap.get(area);

    if (satorMap) {
      satorMap.forEach((promoters, sator) => {
        console.log(`  - ${sator} (${promoters.size} unique promoters)`);
      });
    } else {
      console.log('  No data');
    }
    console.log('');
  });

  process.exit(0);
}

checkSatorsByArea();
