/**
 * Script to populate area_hierarchy table
 * Run with: npx tsx scripts/populate-hierarchy.ts
 * Run AFTER insert-users.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('🏢 Populating area_hierarchy table...\n');

  // Get all users first
  const { data: users } = await supabase
    .from('users')
    .select('id, name, role, area, sator_name');

  if (!users || users.length === 0) {
    console.error('❌ No users found! Please run insert-users.ts first');
    process.exit(1);
  }

  console.log(`✅ Found ${users.length} users\n`);

  // Get promoters data untuk count
  const { data: promoters } = await supabase
    .from('promoters')
    .select('name, sator, store_id');

  const { data: stores } = await supabase
    .from('stores')
    .select('id, area_detail');

  // Create store map
  const storeMap = new Map(stores?.map(s => [s.id, s.area_detail]) || []);

  // Count promoters per sator per area
  const promoterCounts: Record<string, Record<string, number>> = {};

  promoters?.forEach(p => {
    const area = storeMap.get(p.store_id) || 'UNKNOWN';
    const sator = p.sator;

    if (!promoterCounts[area]) promoterCounts[area] = {};
    if (!promoterCounts[sator]) promoterCounts[area][sator] = 0;
    promoterCounts[area][sator] = (promoterCounts[area][sator] || 0) + 1;
  });

  console.log('📊 Promoter counts per Sator:');
  Object.entries(promoterCounts).forEach(([area, sators]) => {
    console.log(`\n${area}:`);
    Object.entries(sators).forEach(([sator, count]) => {
      console.log(`  ${sator}: ${count} promoters`);
    });
  });
  console.log('');

  // Build hierarchy data
  const hierarchyData = [
    // KUPANG
    {
      area: 'KUPANG',
      manager_name: 'Gery B. Dahoklory',
      sator_name: 'TUTOR ANDRI RUDOLOF ELI MANAFE',
      promoter_count: promoterCounts['KUPANG']?.['TUTOR ANDRI RUDOLOF ELI MANAFE'] || 0,
    },
    {
      area: 'KUPANG',
      manager_name: 'Gery B. Dahoklory',
      sator_name: 'TUTOR ANTONIO DE JANAIRO TOMASOEY',
      promoter_count: promoterCounts['KUPANG']?.['TUTOR ANTONIO DE JANAIRO TOMASOEY'] || 0,
    },

    // KABUPATEN
    {
      area: 'KABUPATEN',
      manager_name: 'Wilibrodus Samara',
      sator_name: 'SPV WILIBRODUS R MANEK SAMARA',
      promoter_count: promoterCounts['KABUPATEN']?.['SPV WILIBRODUS R MANEK SAMARA'] || 0,
    },
    {
      area: 'KABUPATEN',
      manager_name: 'Wilibrodus Samara',
      sator_name: 'TUTOR HERY YULIUS DILLAK',
      promoter_count: promoterCounts['KABUPATEN']?.['TUTOR HERY YULIUS DILLAK'] || 0,
    },
    {
      area: 'KABUPATEN',
      manager_name: 'Wilibrodus Samara',
      sator_name: 'TUTOR LEU ADOLF QICHEN LEI BAIT',
      promoter_count: promoterCounts['KABUPATEN']?.['TUTOR LEU ADOLF QICHEN LEI BAIT'] || 0,
    },
    {
      area: 'KABUPATEN',
      manager_name: 'Wilibrodus Samara',
      sator_name: 'TUTOR MARSELUS M LAMBO',
      promoter_count: promoterCounts['KABUPATEN']?.['TUTOR MARSELUS M LAMBO'] || 0,
    },
    {
      area: 'KABUPATEN',
      manager_name: 'Wilibrodus Samara',
      sator_name: 'TUTOR YACOB CHRISTIAN BOLING',
      promoter_count: promoterCounts['KABUPATEN']?.['TUTOR YACOB CHRISTIAN BOLING'] || 0,
    },

    // SUMBA
    {
      area: 'SUMBA',
      manager_name: 'Anfal Jupriadi',
      sator_name: 'SPV ANFAL JUPRIADI AMBU WARU',
      promoter_count: promoterCounts['SUMBA']?.['SPV ANFAL JUPRIADI AMBU WARU'] || 0,
    },
    {
      area: 'SUMBA',
      manager_name: 'Anfal Jupriadi',
      sator_name: 'TUTOR KUSMYATI KILIMANDU',
      promoter_count: promoterCounts['SUMBA']?.['TUTOR KUSMYATI KILIMANDU'] || 0,
    },
  ];

  // Clear existing data
  console.log('🗑️  Clearing existing hierarchy...');
  await supabase.from('area_hierarchy').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  // Insert hierarchy data
  console.log('\n📝 Inserting hierarchy data...\n');

  for (const h of hierarchyData) {
    // Find manager user_id
    const manager = users.find(u => u.name === h.manager_name);

    // Find sator user_id (only for Kupang sators)
    const sator = users.find(u => u.sator_name === h.sator_name);

    const { error } = await supabase
      .from('area_hierarchy')
      .insert({
        area: h.area,
        manager_name: h.manager_name,
        manager_user_id: manager?.id || null,
        sator_name: h.sator_name,
        sator_user_id: sator?.id || null,
        promoter_count: h.promoter_count,
      });

    if (error) {
      console.error(`❌ Error inserting ${h.area} - ${h.sator_name}:`, error.message);
    } else {
      console.log(`✅ ${h.area} - ${h.sator_name} (${h.promoter_count} promoters)`);
    }
  }

  // Verify
  console.log('\n🔍 Verifying hierarchy:\n');
  const { data: hierarchy } = await supabase
    .from('area_hierarchy')
    .select('*')
    .order('area', { ascending: true });

  if (hierarchy) {
    const byArea: Record<string, any[]> = {};
    hierarchy.forEach(h => {
      if (!byArea[h.area]) byArea[h.area] = [];
      byArea[h.area].push(h);
    });

    Object.entries(byArea).forEach(([area, items]) => {
      console.log(`📍 ${area} (Manager: ${items[0].manager_name}):`);
      items.forEach(item => {
        console.log(`   └─ ${item.sator_name}: ${item.promoter_count} promoters`);
      });
      console.log('');
    });
  }

  console.log('🎉 Area hierarchy population completed!\n');
  console.log('📝 Next steps:');
  console.log('   1. Update Login page to support multi-user auth');
  console.log('   2. Implement Auth Context & RBAC');
  console.log('   3. Test login with 6 users');
}

main().catch(console.error);
