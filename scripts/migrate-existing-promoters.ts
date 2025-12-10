/**
 * MIGRATION SCRIPT: Create User Accounts for Existing Promoters
 *
 * This script will:
 * 1. Fetch all 72 existing promoters from database
 * 2. Determine area based on their store's area_detail
 * 3. Assign SPV based on area
 * 4. Generate employee_id (KPG001, KBP001, SMB001)
 * 5. Create user_profiles with PIN 1234
 * 6. Update promoters table with user_id, spv_id, area, category
 *
 * Run: npx tsx scripts/migrate-existing-promoters.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as crypto from 'crypto'
import * as dotenv from 'dotenv'
import * as path from 'path'

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

// Supabase setup
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables!')
  console.error('Required in .env.local:')
  console.error('  - NEXT_PUBLIC_SUPABASE_URL')
  console.error('  - SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// SPV mapping per area
const SPV_MAPPING = {
  KUPANG: 'gery.spv@vast.com', // Gery (SPV baru)
  KABUPATEN: 'wilibrodus@vast.com', // Wilibrodus
  SUMBA: 'anfal@vast.com' // Anfal
}

// Hash PIN (same as SQL function)
function hashPIN(pin: string): string {
  return crypto.createHash('sha256').update(pin).digest('hex')
}

// Map store area_detail to standard area
function mapStoreAreaToArea(area_detail: string): string {
  const areaLower = area_detail.toLowerCase()

  if (areaLower.includes('kupang') || areaLower.includes('kota')) {
    return 'KUPANG'
  } else if (areaLower.includes('kabupaten') || areaLower.includes('kab')) {
    return 'KABUPATEN'
  } else if (areaLower.includes('sumba')) {
    return 'SUMBA'
  }

  // Default fallback
  return 'KUPANG'
}

// Generate employee_id
function generateEmployeeId(area: string, count: number): string {
  const prefix = area === 'KUPANG' ? 'KPG' : area === 'KABUPATEN' ? 'KBP' : 'SMB'
  return `${prefix}${String(count).padStart(3, '0')}`
}

async function migratePromoters() {
  console.log('🚀 Starting migration for existing promoters...\n')

  try {
    // Step 1: Fetch all promoters with store info
    console.log('📊 Fetching promoters from database...')
    const { data: promoters, error: promotersError } = await supabase
      .from('promoters')
      .select(`
        id,
        name,
        sator,
        target,
        store_id,
        is_active,
        stores (
          id,
          name,
          area_detail
        )
      `)
      .is('user_id', null) // Only promoters without user account
      .eq('is_active', true)

    if (promotersError) {
      throw promotersError
    }

    if (!promoters || promoters.length === 0) {
      console.log('✅ No promoters to migrate (all already have accounts)')
      return
    }

    console.log(`✅ Found ${promoters.length} promoters to migrate\n`)

    // Step 2: Get SPV user IDs
    console.log('👥 Fetching SPV user IDs...')
    const { data: spvUsers, error: spvError } = await supabase
      .from('user_profiles')
      .select('id, email, area')
      .in('email', Object.values(SPV_MAPPING))

    if (spvError) {
      throw spvError
    }

    const spvMap = new Map(spvUsers?.map(spv => [spv.email, spv]) || [])
    console.log(`✅ Found ${spvMap.size} SPV users\n`)

    // Step 3: Group promoters by area and count
    const areaCounts = {
      KUPANG: 0,
      KABUPATEN: 0,
      SUMBA: 0
    }

    // Step 4: Process each promoter
    console.log('⚙️  Processing promoters...\n')
    const results = []

    for (const promoter of promoters) {
      try {
        // Determine area
        const storeArea = (promoter as any).stores?.area_detail || 'kupang'
        const area = mapStoreAreaToArea(storeArea)

        // Increment count for this area
        areaCounts[area as keyof typeof areaCounts]++
        const count = areaCounts[area as keyof typeof areaCounts]

        // Generate employee_id
        const employee_id = generateEmployeeId(area, count)

        // Get SPV for this area
        const spvEmail = SPV_MAPPING[area as keyof typeof SPV_MAPPING]
        const spv = spvMap.get(spvEmail)

        if (!spv) {
          console.log(`⚠️  WARNING: SPV not found for area ${area} (${spvEmail})`)
          console.log(`   Skipping promoter: ${promoter.name}`)
          continue
        }

        // Hash default PIN
        const pin_hash = hashPIN('1234')

        // Create user_profile
        const { data: userProfile, error: userError } = await supabase
          .from('user_profiles')
          .insert({
            name: promoter.name,
            role: 'promoter',
            area: area,
            employee_id: employee_id,
            pin_hash: pin_hash,
            is_active: true
          })
          .select()
          .single()

        if (userError) {
          console.log(`❌ Error creating user for ${promoter.name}: ${userError.message}`)
          results.push({
            promoter_name: promoter.name,
            success: false,
            error: userError.message
          })
          continue
        }

        // Update promoter
        const { error: updateError } = await supabase
          .from('promoters')
          .update({
            user_id: userProfile.id,
            spv_id: spv.id,
            area: area,
            employee_id: employee_id,
            category: 'official', // Default semua official
            updated_at: new Date().toISOString()
          })
          .eq('id', promoter.id)

        if (updateError) {
          console.log(`❌ Error updating promoter ${promoter.name}: ${updateError.message}`)
          // Rollback: delete user profile
          await supabase.from('user_profiles').delete().eq('id', userProfile.id)
          results.push({
            promoter_name: promoter.name,
            success: false,
            error: updateError.message
          })
          continue
        }

        console.log(`✅ ${employee_id} - ${promoter.name} (${area})`)
        results.push({
          promoter_name: promoter.name,
          employee_id: employee_id,
          area: area,
          spv_name: spv.email,
          success: true
        })

      } catch (error: any) {
        console.log(`❌ Error processing ${promoter.name}: ${error.message}`)
        results.push({
          promoter_name: promoter.name,
          success: false,
          error: error.message
        })
      }
    }

    // Step 5: Summary
    console.log('\n📊 MIGRATION SUMMARY:')
    console.log('=' .repeat(50))
    console.log(`Total Promoters: ${promoters.length}`)
    console.log(`Successful: ${results.filter(r => r.success).length}`)
    console.log(`Failed: ${results.filter(r => !r.success).length}`)
    console.log('\nBy Area:')
    console.log(`  KUPANG: ${areaCounts.KUPANG} promoters`)
    console.log(`  KABUPATEN: ${areaCounts.KABUPATEN} promoters`)
    console.log(`  SUMBA: ${areaCounts.SUMBA} promoters`)
    console.log('=' .repeat(50))

    // Show failed migrations
    const failed = results.filter(r => !r.success)
    if (failed.length > 0) {
      console.log('\n❌ FAILED MIGRATIONS:')
      failed.forEach(f => {
        console.log(`  - ${f.promoter_name}: ${f.error}`)
      })
    }

    console.log('\n✅ Migration completed!')
    console.log('\n📝 NEXT STEPS:')
    console.log('1. Verify employee IDs in database')
    console.log('2. Inform SPVs about new promoter accounts')
    console.log('3. SPVs can reset PINs if needed')
    console.log('4. Test promoter login with employee_id + PIN 1234')

  } catch (error: any) {
    console.error('❌ Migration failed:', error.message)
    process.exit(1)
  }
}

// Run migration
migratePromoters()
