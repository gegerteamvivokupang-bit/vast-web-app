/**
 * Script to insert 6 users with hashed passwords
 * Run with: npx tsx scripts/insert-users.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const SALT_ROUNDS = 10;

interface UserData {
  email: string;
  password: string;
  name: string;
  role: 'super_admin' | 'manager_area' | 'spv_area' | 'sator';
  area: string;
  sator_name?: string;
}

const USERS: UserData[] = [
  {
    email: 'admin@vast.com',
    password: 'admin123',
    name: 'Gery B. Dahoklory',
    role: 'super_admin',
    area: 'ALL',
  },
  {
    email: 'alberto@vast.com',
    password: 'alberto123',
    name: 'Alberto G Munthe',
    role: 'manager_area',
    area: 'ALL',
  },
  {
    email: 'wilibrodus@vast.com',
    password: 'wili123',
    name: 'Wilibrodus Samara',
    role: 'spv_area',
    area: 'KABUPATEN',
  },
  {
    email: 'anfal@vast.com',
    password: 'anfal123',
    name: 'Anfal Jupriadi',
    role: 'spv_area',
    area: 'SUMBA',
  },
  {
    email: 'andri@vast.com',
    password: 'andri123',
    name: 'Andri Rudolof Eli Manafe',
    role: 'sator',
    area: 'KUPANG',
    sator_name: 'TUTOR ANDRI RUDOLOF ELI MANAFE',
  },
  {
    email: 'antonio@vast.com',
    password: 'antonio123',
    name: 'Antonio De Janairo Tomasoey',
    role: 'sator',
    area: 'KUPANG',
    sator_name: 'TUTOR ANTONIO DE JANAIRO TOMASOEY',
  },
];

async function main() {
  console.log('👥 Inserting users with hashed passwords...\n');

  // Check if users table exists
  const { error: checkError } = await supabase
    .from('users')
    .select('id')
    .limit(1);

  if (checkError) {
    console.error('❌ Error: users table not found!');
    console.error('   Please run supabase-schema-users.sql first in Supabase SQL Editor');
    console.error('   Error:', checkError.message);
    process.exit(1);
  }

  // Delete existing users (fresh start)
  console.log('🗑️  Clearing existing users...');
  await supabase.from('users').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('✅ Existing users cleared\n');

  let insertedCount = 0;

  for (const user of USERS) {
    console.log(`📝 Creating user: ${user.name} (${user.email})`);

    // Hash password
    const passwordHash = await bcrypt.hash(user.password, SALT_ROUNDS);

    // Insert user
    const { data, error } = await supabase
      .from('users')
      .insert({
        email: user.email,
        password_hash: passwordHash,
        name: user.name,
        role: user.role,
        area: user.area,
        sator_name: user.sator_name || null,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error(`   ❌ Error inserting ${user.email}:`, error.message);
    } else {
      console.log(`   ✅ Created with ID: ${data.id}`);
      console.log(`   📋 Role: ${user.role} | Area: ${user.area}`);
      insertedCount++;
    }
    console.log('');
  }

  console.log(`\n✅ Total users inserted: ${insertedCount}/${USERS.length}\n`);

  // Verify
  console.log('🔍 Verifying inserted users:\n');
  const { data: allUsers } = await supabase
    .from('users')
    .select('id, email, name, role, area, sator_name, is_active')
    .order('role', { ascending: true });

  if (allUsers) {
    console.log('📊 Users in database:');
    allUsers.forEach((u, idx) => {
      console.log(`${idx + 1}. ${u.name} (${u.email})`);
      console.log(`   Role: ${u.role} | Area: ${u.area} | Active: ${u.is_active}`);
      if (u.sator_name) {
        console.log(`   Sator: ${u.sator_name}`);
      }
      console.log('');
    });
  }

  console.log('🎉 User insertion completed!\n');
  console.log('📝 Next steps:');
  console.log('   1. Run: npx tsx scripts/populate-hierarchy.ts');
  console.log('   2. Test login with any of the 6 users');
  console.log('\n🔑 Login credentials:');
  USERS.forEach(u => {
    console.log(`   ${u.email} / ${u.password}`);
  });
}

main().catch(console.error);
