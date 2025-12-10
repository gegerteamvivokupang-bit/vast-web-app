import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUsersInDB() {
  console.log('🔍 Checking users in database...\n');

  try {
    // Check user_profiles
    const { data: profiles, error } = await supabase
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.log('❌ Error:', error.message);
      return;
    }

    console.log(`📋 Found ${profiles?.length || 0} user profiles:\n`);

    if (profiles && profiles.length > 0) {
      profiles.forEach((p, i) => {
        console.log(`${i + 1}. ${p.email}`);
        console.log(`   ID: ${p.id}`);
        console.log(`   Name: ${p.name}`);
        console.log(`   Role: ${p.role}`);
        console.log(`   Area: ${p.area}`);
        console.log();
      });
    }

    // Expected users
    const expectedEmails = [
      'admin@vast.com',
      'alberto@vast.com',
      'wilibrodus@vast.com',
      'anfal@vast.com',
      'andri@vast.com',
      'antonio@vast.com'
    ];

    const foundEmails = profiles?.map(p => p.email) || [];
    const missingEmails = expectedEmails.filter(email => !foundEmails.includes(email));

    console.log('📊 Summary:\n');
    console.log(`✅ Found: ${foundEmails.length}/6 users`);

    if (missingEmails.length > 0) {
      console.log(`❌ Missing: ${missingEmails.join(', ')}\n`);
    } else {
      console.log('✅ All 6 user profiles exist in database!\n');
    }

    // Now check if the issue is with auth
    console.log('🔐 Testing if profiles are linked to auth.users...\n');

    for (const email of expectedEmails) {
      const profile = profiles?.find(p => p.email === email);
      if (profile) {
        console.log(`${email}:`);
        console.log(`  Profile ID: ${profile.id}`);
        console.log(`  (This ID should match the auth.users ID)`);
      }
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

checkUsersInDB();
