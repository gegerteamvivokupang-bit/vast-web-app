import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyUsers() {
  console.log('🔍 Verifying users in Supabase...\n');

  try {
    // 1. Check if user_profiles table exists
    console.log('1️⃣ Checking user_profiles table...');
    const { data: profiles, error: profilesError } = await supabase
      .from('user_profiles')
      .select('*')
      .limit(1);

    if (profilesError) {
      console.log('❌ Table user_profiles NOT FOUND!');
      console.log('   Error:', profilesError.message);
      console.log('\n📝 ACTION REQUIRED:');
      console.log('   Run supabase-schema-users.sql di Supabase SQL Editor');
      return;
    }

    console.log('✅ Table user_profiles exists\n');

    // 2. Get all user profiles
    console.log('2️⃣ Fetching all user profiles...');
    const { data: allProfiles, error: allError } = await supabase
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: true });

    if (allError) {
      console.log('❌ Error fetching profiles:', allError.message);
      return;
    }

    console.log(`✅ Found ${allProfiles?.length || 0} user profiles\n`);

    if (allProfiles && allProfiles.length > 0) {
      console.log('📋 User Profiles:\n');
      allProfiles.forEach((profile, index) => {
        console.log(`${index + 1}. ${profile.email}`);
        console.log(`   Name: ${profile.name}`);
        console.log(`   Role: ${profile.role}`);
        console.log(`   Area: ${profile.area}`);
        if (profile.sator_name) {
          console.log(`   Sator: ${profile.sator_name}`);
        }
        if (profile.can_view_other_sators && profile.can_view_other_sators.length > 0) {
          console.log(`   Can view: ${profile.can_view_other_sators.join(', ')}`);
        }
        console.log();
      });
    } else {
      console.log('⚠️  No user profiles found!\n');
      console.log('📝 ACTION REQUIRED:');
      console.log('   Run supabase-insert-users.sql di Supabase SQL Editor');
    }

    // 3. Check expected users
    const expectedEmails = [
      'admin@vast.com',
      'alberto@vast.com',
      'wilibrodus@vast.com',
      'anfal@vast.com',
      'andri@vast.com',
      'antonio@vast.com'
    ];

    console.log('3️⃣ Checking expected users...\n');
    const foundEmails = allProfiles?.map(p => p.email) || [];
    const missingEmails = expectedEmails.filter(email => !foundEmails.includes(email));

    if (missingEmails.length === 0) {
      console.log('✅ All 6 users found!\n');
    } else {
      console.log(`⚠️  Missing ${missingEmails.length} users:\n`);
      missingEmails.forEach(email => {
        console.log(`   ❌ ${email}`);
      });
      console.log('\n📝 ACTION REQUIRED:');
      console.log('   Run supabase-insert-users.sql di Supabase SQL Editor');
    }

    // 4. Test login for each user (optional - needs service role key)
    console.log('\n4️⃣ User Login Test Info:\n');
    console.log('Default passwords:');
    console.log('   admin@vast.com      → password123 (old) or admin123 (new)');
    console.log('   alberto@vast.com    → alberto123');
    console.log('   wilibrodus@vast.com → wili123');
    console.log('   anfal@vast.com      → anfal123');
    console.log('   andri@vast.com      → andri123');
    console.log('   antonio@vast.com    → antonio123');
    console.log('\n📝 To test login:');
    console.log('   1. Open http://localhost:3000/login');
    console.log('   2. Try each email with the password above');

  } catch (error: any) {
    console.error('❌ Verification failed:', error.message);
  }
}

verifyUsers();
