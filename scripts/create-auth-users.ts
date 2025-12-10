import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseServiceKey || supabaseServiceKey === 'undefined') {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY tidak ditemukan di .env.local\n');
  console.log('📝 ACTION REQUIRED:');
  console.log('1. Pergi ke Supabase Dashboard → Settings → API');
  console.log('2. Copy "service_role" key (bukan anon key!)');
  console.log('3. Tambahkan ke .env.local:');
  console.log('   SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...\n');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const newUsers = [
  {
    email: 'alberto@vast.com',
    password: 'alberto123',
    name: 'Alberto G Munthe',
    role: 'manager_area',
    area: 'ALL'
  },
  {
    email: 'wilibrodus@vast.com',
    password: 'wili123',
    name: 'Wilibrodus Samara',
    role: 'spv_area',
    area: 'KABUPATEN'
  },
  {
    email: 'anfal@vast.com',
    password: 'anfal123',
    name: 'Anfal Jupriadi',
    role: 'spv_area',
    area: 'SUMBA'
  },
  {
    email: 'andri@vast.com',
    password: 'andri123',
    name: 'Andri Rudolof Eli Manafe',
    role: 'sator',
    area: 'KUPANG',
    sator_name: 'TUTOR ANDRI RUDOLOF ELI MANAFE',
    can_view_other_sators: ['TUTOR ANTONIO DE JANAIRO TOMASOEY']
  },
  {
    email: 'antonio@vast.com',
    password: 'antonio123',
    name: 'Antonio De Janairo Tomasoey',
    role: 'sator',
    area: 'KUPANG',
    sator_name: 'TUTOR ANTONIO DE JANAIRO TOMASOEY',
    can_view_other_sators: ['TUTOR ANDRI RUDOLOF ELI MANAFE']
  }
];

async function createAuthUsers() {
  console.log('🚀 Creating Supabase Auth users...\n');

  for (const user of newUsers) {
    console.log(`Creating ${user.email}...`);

    try {
      // Create user in auth.users
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
        user_metadata: {
          name: user.name
        }
      });

      if (authError) {
        if (authError.message.includes('already registered')) {
          console.log(`   ⚠️  User already exists, skipping...`);
        } else {
          console.log(`   ❌ FAILED: ${authError.message}`);
        }
        continue;
      }

      console.log(`   ✅ Auth user created: ${authData.user?.id}`);

      // Check if profile already exists
      const { data: existingProfile } = await supabaseAdmin
        .from('user_profiles')
        .select('id')
        .eq('email', user.email)
        .single();

      if (existingProfile) {
        console.log(`   ✅ Profile already exists, updating...`);

        // Update existing profile with auth user ID
        const { error: updateError } = await supabaseAdmin
          .from('user_profiles')
          .update({
            id: authData.user!.id,
            name: user.name,
            role: user.role,
            area: user.area,
            sator_name: user.sator_name || null,
            can_view_other_sators: user.can_view_other_sators || null
          })
          .eq('email', user.email);

        if (updateError) {
          console.log(`   ❌ Profile update failed: ${updateError.message}`);
        } else {
          console.log(`   ✅ Profile updated successfully`);
        }
      } else {
        // Insert new profile
        const { error: profileError } = await supabaseAdmin
          .from('user_profiles')
          .insert({
            id: authData.user!.id,
            email: user.email,
            name: user.name,
            role: user.role,
            area: user.area,
            sator_name: user.sator_name || null,
            can_view_other_sators: user.can_view_other_sators || null
          });

        if (profileError) {
          console.log(`   ❌ Profile creation failed: ${profileError.message}`);
        } else {
          console.log(`   ✅ Profile created successfully`);
        }
      }

      console.log();
    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message}\n`);
    }
  }

  console.log('\n✅ All users processed!\n');
  console.log('🧪 Testing login for all users...\n');

  // Test login
  for (const user of newUsers) {
    console.log(`Testing ${user.email}...`);
    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
      email: user.email,
      password: user.password
    });

    if (error) {
      console.log(`   ❌ FAILED: ${error.message}`);
    } else {
      console.log(`   ✅ SUCCESS`);
      await supabaseAdmin.auth.signOut();
    }
  }

  console.log('\n🎉 DONE! All 5 users should now be able to login.');
  console.log('\n📋 Login credentials:');
  newUsers.forEach(user => {
    console.log(`   ${user.email} / ${user.password}`);
  });
}

createAuthUsers();
