import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkAuthUsers() {
  console.log('🔍 Checking Supabase Auth users...\n');

  const testEmails = [
    'admin@vast.com',
    'alberto@vast.com',
    'wilibrodus@vast.com',
    'anfal@vast.com',
    'andri@vast.com',
    'antonio@vast.com'
  ];

  const testPasswords = [
    'password123', // admin (old)
    'alberto123',
    'wili123',
    'anfal123',
    'andri123',
    'antonio123'
  ];

  console.log('🧪 Testing login for each user...\n');

  for (let i = 0; i < testEmails.length; i++) {
    const email = testEmails[i];
    const password = testPasswords[i];

    console.log(`${i + 1}. Testing ${email} with password: ${password}`);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      console.log(`   ❌ FAILED: ${error.message}`);

      // If password is wrong for admin, try the new password
      if (email === 'admin@vast.com' && error.message.includes('Invalid')) {
        console.log(`   🔄 Trying with admin123...`);
        const { data: retryData, error: retryError } = await supabase.auth.signInWithPassword({
          email,
          password: 'admin123'
        });

        if (retryError) {
          console.log(`   ❌ FAILED: ${retryError.message}`);
        } else {
          console.log(`   ✅ SUCCESS with admin123`);
          await supabase.auth.signOut();
        }
      }
    } else {
      console.log(`   ✅ SUCCESS`);
      // Sign out after successful login
      await supabase.auth.signOut();
    }
    console.log();
  }

  console.log('\n📝 DIAGNOSIS:\n');
  console.log('If you see "Invalid login credentials" errors:');
  console.log('   → Users NOT created in Supabase Authentication');
  console.log('   → ACTION: Run supabase-insert-users.sql LANGKAH 2');
  console.log('\nIf you see "Email not confirmed" errors:');
  console.log('   → Go to Supabase Dashboard → Authentication → Users');
  console.log('   → Manually confirm each user email\n');
}

checkAuthUsers();
