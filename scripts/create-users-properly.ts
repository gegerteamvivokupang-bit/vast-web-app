import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

// We need service role key - check if it exists
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey || serviceRoleKey === 'undefined') {
  console.error('❌ ERROR: SUPABASE_SERVICE_ROLE_KEY not found!\n');
  console.log('📝 To get the service role key:');
  console.log('1. Go to: https://supabase.com/dashboard');
  console.log('2. Select your project: VAST Sales');
  console.log('3. Go to: Settings → API');
  console.log('4. Copy the "service_role" secret key (NOT anon key!)');
  console.log('5. Add to .env.local:');
  console.log('   SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...\n');
  console.log('⚠️  Since we don\'t have service_role key, we will use the DASHBOARD METHOD instead.\n');
  console.log('📋 DASHBOARD METHOD - CREATE USERS MANUALLY:');
  console.log('='.repeat(60));
  console.log('\n1. Go to: https://supabase.com/dashboard');
  console.log('2. Select project: VAST Sales');
  console.log('3. Go to: Authentication → Users');
  console.log('4. Click "Add user" button and create these 6 users:\n');

  const users = [
    { email: 'admin@vast.com', password: 'password123' },
    { email: 'alberto@vast.com', password: 'alberto123' },
    { email: 'wilibrodus@vast.com', password: 'wili123' },
    { email: 'anfal@vast.com', password: 'anfal123' },
    { email: 'andri@vast.com', password: 'andri123' },
    { email: 'antonio@vast.com', password: 'antonio123' }
  ];

  users.forEach((user, i) => {
    console.log(`   ${i + 1}. Email: ${user.email}`);
    console.log(`      Password: ${user.password}`);
    console.log(`      ✅ Auto Confirm User: CHECK THIS BOX!\n`);
  });

  console.log('5. After creating all users, run this script again to link profiles.\n');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const users = [
  {
    email: 'admin@vast.com',
    password: 'password123',
    name: 'Gery B. Dahoklory',
    role: 'super_admin',
    area: 'ALL'
  },
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

async function createUsersWithAdminAPI() {
  console.log('🚀 Creating users via Supabase Admin API...\n');

  for (const user of users) {
    console.log(`Creating ${user.email}...`);

    try {
      // Create user via Admin API (the proper way!)
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true, // Auto-confirm email
        user_metadata: {
          name: user.name
        }
      });

      if (authError) {
        if (authError.message.includes('already registered')) {
          console.log(`   ⚠️  Already exists, updating profile...`);

          // Get existing user
          const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers();
          const foundUser = existingUser.users.find(u => u.email === user.email);

          if (foundUser) {
            // Update profile
            const { error: profileError } = await supabaseAdmin
              .from('user_profiles')
              .upsert({
                id: foundUser.id,
                email: user.email,
                name: user.name,
                role: user.role,
                area: user.area,
                sator_name: user.sator_name || null,
                can_view_other_sators: user.can_view_other_sators || null
              });

            if (profileError) {
              console.log(`   ❌ Profile error: ${profileError.message}`);
            } else {
              console.log(`   ✅ Profile updated`);
            }
          }
        } else {
          console.log(`   ❌ Auth error: ${authError.message}`);
        }
        console.log();
        continue;
      }

      console.log(`   ✅ Auth user created: ${authData.user?.id}`);

      // Create profile
      const { error: profileError } = await supabaseAdmin
        .from('user_profiles')
        .upsert({
          id: authData.user!.id,
          email: user.email,
          name: user.name,
          role: user.role,
          area: user.area,
          sator_name: user.sator_name || null,
          can_view_other_sators: user.can_view_other_sators || null
        });

      if (profileError) {
        console.log(`   ❌ Profile error: ${profileError.message}`);
      } else {
        console.log(`   ✅ Profile created`);
      }

      console.log();
    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message}\n`);
    }
  }

  console.log('✅ All users processed!\n');

  // Verify
  const { data: profiles } = await supabaseAdmin
    .from('user_profiles')
    .select('email, name, role, area')
    .order('email');

  console.log('📋 Current user profiles:');
  profiles?.forEach((p, i) => {
    console.log(`${i + 1}. ${p.email} (${p.role}, ${p.area})`);
  });

  console.log('\n🧪 Now test login in browser: http://localhost:3000/login');
}

createUsersWithAdminAPI();
