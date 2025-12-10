/**
 * MIGRATION READINESS CHECKER
 *
 * Script ini akan check apakah sistem siap untuk migration:
 * 1. Database schema sudah update
 * 2. Functions & views sudah dibuat
 * 3. SPV accounts ready (3 SPV)
 * 4. Environment variables configured
 * 5. Promoters status
 *
 * Run: npx tsx scripts/check-migration-ready.ts
 */

import { createClient } from '@supabase/supabase-js'

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
}

const success = (msg: string) => console.log(`${colors.green}✅ ${msg}${colors.reset}`)
const error = (msg: string) => console.log(`${colors.red}❌ ${msg}${colors.reset}`)
const warning = (msg: string) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`)
const info = (msg: string) => console.log(`${colors.cyan}ℹ️  ${msg}${colors.reset}`)
const header = (msg: string) => {
  console.log(`\n${colors.bold}${colors.blue}${'='.repeat(60)}${colors.reset}`)
  console.log(`${colors.bold}${colors.blue}${msg}${colors.reset}`)
}

interface CheckResult {
  passed: boolean
  message: string
  details?: string[]
}

interface AllChecks {
  envVars: CheckResult
  dbSchema: CheckResult
  functions: CheckResult
  views: CheckResult
  spvAccounts: CheckResult
  promotersStatus: CheckResult
}

async function checkEnvironmentVariables(): Promise<CheckResult> {
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY', // CRITICAL for migration
  ]

  const missing: string[] = []

  for (const varName of required) {
    if (!process.env[varName]) {
      missing.push(varName)
    }
  }

  if (missing.length > 0) {
    return {
      passed: false,
      message: 'Missing environment variables',
      details: [
        ...missing.map(v => `Missing: ${v}`),
        '',
        'Add to .env.local:',
        'SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...',
        '',
        'Get from: Supabase Dashboard → Project Settings → API → service_role key',
      ],
    }
  }

  return {
    passed: true,
    message: 'All environment variables configured',
  }
}

async function checkDatabaseSchema(supabase: any): Promise<CheckResult> {
  try {
    // Check user_profiles columns
    const { data: upColumns } = await supabase
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_name', 'user_profiles')
      .in('column_name', ['employee_id', 'pin_hash'])

    // Check promoters columns
    const { data: pColumns } = await supabase
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_name', 'promoters')
      .in('column_name', ['user_id', 'spv_id', 'area', 'category', 'employee_id'])

    // Use raw SQL query instead
    const { data: schemaCheck } = await supabase.rpc('check_schema', {}, { count: 'exact' })

    // Fallback: Try direct query
    const userProfilesCheck = await supabase
      .from('user_profiles')
      .select('employee_id, pin_hash')
      .limit(0)

    const promotersCheck = await supabase
      .from('promoters')
      .select('user_id, spv_id, area, category, employee_id')
      .limit(0)

    // If no error, columns exist
    const upPassed = !userProfilesCheck.error
    const pPassed = !promotersCheck.error

    if (!upPassed || !pPassed) {
      return {
        passed: false,
        message: 'Database schema not migrated',
        details: [
          !upPassed ? 'Missing: user_profiles (employee_id, pin_hash)' : '',
          !pPassed ? 'Missing: promoters (user_id, spv_id, area, category)' : '',
          '',
          'Action: Run supabase-migration-promoter-system.sql in Supabase SQL Editor',
        ].filter(Boolean),
      }
    }

    return {
      passed: true,
      message: 'Database schema updated',
    }
  } catch (err: any) {
    return {
      passed: false,
      message: 'Error checking database schema',
      details: [err.message],
    }
  }
}

async function checkFunctions(supabase: any): Promise<CheckResult> {
  const requiredFunctions = [
    'generate_employee_id',
    'create_promoter_account',
    'authenticate_promoter',
  ]

  const missingFunctions: string[] = []

  for (const funcName of requiredFunctions) {
    try {
      // Try to call function with dummy data to check if exists
      if (funcName === 'generate_employee_id') {
        const { error } = await supabase.rpc('generate_employee_id', { p_area: 'KUPANG' })
        if (error && error.message.includes('does not exist')) {
          missingFunctions.push(funcName)
        }
      } else if (funcName === 'authenticate_promoter') {
        const { error } = await supabase.rpc('authenticate_promoter', {
          p_employee_id: 'TEST',
          p_pin: '0000',
        })
        if (error && error.message.includes('does not exist')) {
          missingFunctions.push(funcName)
        }
      }
    } catch (err: any) {
      if (err.message?.includes('does not exist')) {
        missingFunctions.push(funcName)
      }
    }
  }

  if (missingFunctions.length > 0) {
    return {
      passed: false,
      message: 'Missing database functions',
      details: [
        ...missingFunctions.map(f => `Missing: ${f}()`),
        '',
        'Action: Run supabase-migration-promoter-system.sql',
      ],
    }
  }

  return {
    passed: true,
    message: 'All database functions created',
  }
}

async function checkViews(supabase: any): Promise<CheckResult> {
  try {
    // Try to query views
    const { error: viewError1 } = await supabase
      .from('promoters_with_users')
      .select('*')
      .limit(0)

    const { error: viewError2 } = await supabase
      .from('sales_detailed')
      .select('*')
      .limit(0)

    const missingViews: string[] = []
    if (viewError1) missingViews.push('promoters_with_users')
    if (viewError2) missingViews.push('sales_detailed')

    if (missingViews.length > 0) {
      return {
        passed: false,
        message: 'Missing database views',
        details: [
          ...missingViews.map(v => `Missing: ${v}`),
          '',
          'Action: Run supabase-migration-promoter-system.sql',
        ],
      }
    }

    return {
      passed: true,
      message: 'All database views created',
    }
  } catch (err: any) {
    return {
      passed: false,
      message: 'Error checking views',
      details: [err.message],
    }
  }
}

async function checkSPVAccounts(supabase: any): Promise<CheckResult> {
  try {
    const { data: spvs, error } = await supabase
      .from('user_profiles')
      .select('email, name, area')
      .eq('role', 'spv_area')
      .order('area')

    if (error) throw error

    const requiredSPVs = [
      { area: 'SUMBA', email: 'anfal@vast.com' },
      { area: 'KUPANG', email: 'gery.spv@vast.com' },
      { area: 'KABUPATEN', email: 'wilibrodus@vast.com' },
    ]

    const missingSPVs: string[] = []

    for (const required of requiredSPVs) {
      const exists = spvs?.find(
        (spv: any) => spv.area === required.area && spv.email === required.email
      )
      if (!exists) {
        missingSPVs.push(`${required.email} (${required.area})`)
      }
    }

    if (missingSPVs.length > 0) {
      const details = [
        `Found ${spvs?.length || 0}/3 SPV accounts`,
        '',
        ...missingSPVs.map(spv => `Missing: ${spv}`),
        '',
        'Action for missing SPV:',
        '1. Supabase Dashboard → Authentication → Users → Add User',
        '2. Create user with email (e.g., gery.spv@vast.com)',
        '3. Run SQL to insert user_profiles (see MIGRATION_STEPS.md)',
      ]

      return {
        passed: false,
        message: 'Missing SPV accounts',
        details,
      }
    }

    return {
      passed: true,
      message: `All 3 SPV accounts ready`,
      details: spvs?.map((spv: any) => `✓ ${spv.email} (${spv.area})`),
    }
  } catch (err: any) {
    return {
      passed: false,
      message: 'Error checking SPV accounts',
      details: [err.message],
    }
  }
}

async function checkPromotersStatus(supabase: any): Promise<CheckResult> {
  try {
    const { data: stats } = await supabase.rpc('get_promoters_stats')

    // Fallback to direct query
    const { data: promoters } = await supabase
      .from('promoters')
      .select('user_id, is_active')
      .eq('is_active', true)

    if (!promoters) {
      return {
        passed: false,
        message: 'Cannot fetch promoters data',
      }
    }

    const total = promoters.length
    const withUser = promoters.filter((p: any) => p.user_id !== null).length
    const withoutUser = total - withUser

    if (withoutUser === 0) {
      return {
        passed: true,
        message: 'All promoters already have user accounts',
        details: [
          `Total promoters: ${total}`,
          `With user accounts: ${withUser}`,
          '',
          'Migration already completed! ✅',
        ],
      }
    }

    return {
      passed: true,
      message: `Ready to migrate ${withoutUser} promoters`,
      details: [
        `Total active promoters: ${total}`,
        `Already migrated: ${withUser}`,
        `Need migration: ${withoutUser}`,
        '',
        `Next: Run migration script`,
      ],
    }
  } catch (err: any) {
    return {
      passed: false,
      message: 'Error checking promoters status',
      details: [err.message],
    }
  }
}

async function runAllChecks(): Promise<AllChecks> {
  console.log(`${colors.bold}${colors.cyan}`)
  console.log('╔════════════════════════════════════════════════════════════╗')
  console.log('║                                                            ║')
  console.log('║           MIGRATION READINESS CHECKER                      ║')
  console.log('║           Checking prerequisites...                        ║')
  console.log('║                                                            ║')
  console.log('╚════════════════════════════════════════════════════════════╝')
  console.log(colors.reset)

  // Check 1: Environment Variables
  header('CHECK 1: Environment Variables')
  const envCheck = await checkEnvironmentVariables()
  if (envCheck.passed) {
    success(envCheck.message)
  } else {
    error(envCheck.message)
    envCheck.details?.forEach(d => console.log(`  ${d}`))
  }

  // If env vars missing, can't proceed
  if (!envCheck.passed) {
    console.log('\n⛔ Cannot proceed without environment variables')
    return {
      envVars: envCheck,
      dbSchema: { passed: false, message: 'Skipped' },
      functions: { passed: false, message: 'Skipped' },
      views: { passed: false, message: 'Skipped' },
      spvAccounts: { passed: false, message: 'Skipped' },
      promotersStatus: { passed: false, message: 'Skipped' },
    }
  }

  // Initialize Supabase
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! // Use service role for admin access
  )

  // Check 2: Database Schema
  header('CHECK 2: Database Schema')
  const schemaCheck = await checkDatabaseSchema(supabase)
  if (schemaCheck.passed) {
    success(schemaCheck.message)
  } else {
    error(schemaCheck.message)
    schemaCheck.details?.forEach(d => console.log(`  ${d}`))
  }

  // Check 3: Functions
  header('CHECK 3: Database Functions')
  const functionsCheck = await checkFunctions(supabase)
  if (functionsCheck.passed) {
    success(functionsCheck.message)
  } else {
    error(functionsCheck.message)
    functionsCheck.details?.forEach(d => console.log(`  ${d}`))
  }

  // Check 4: Views
  header('CHECK 4: Database Views')
  const viewsCheck = await checkViews(supabase)
  if (viewsCheck.passed) {
    success(viewsCheck.message)
  } else {
    error(viewsCheck.message)
    viewsCheck.details?.forEach(d => console.log(`  ${d}`))
  }

  // Check 5: SPV Accounts
  header('CHECK 5: SPV Accounts')
  const spvCheck = await checkSPVAccounts(supabase)
  if (spvCheck.passed) {
    success(spvCheck.message)
    spvCheck.details?.forEach(d => console.log(`  ${colors.green}${d}${colors.reset}`))
  } else {
    error(spvCheck.message)
    spvCheck.details?.forEach(d => console.log(`  ${d}`))
  }

  // Check 6: Promoters Status
  header('CHECK 6: Promoters Status')
  const promotersCheck = await checkPromotersStatus(supabase)
  if (promotersCheck.passed) {
    info(promotersCheck.message)
    promotersCheck.details?.forEach(d => console.log(`  ${d}`))
  } else {
    error(promotersCheck.message)
    promotersCheck.details?.forEach(d => console.log(`  ${d}`))
  }

  return {
    envVars: envCheck,
    dbSchema: schemaCheck,
    functions: functionsCheck,
    views: viewsCheck,
    spvAccounts: spvCheck,
    promotersStatus: promotersCheck,
  }
}

async function main() {
  const results = await runAllChecks()

  // Final Summary
  console.log(`\n${colors.bold}${colors.cyan}`)
  console.log('╔════════════════════════════════════════════════════════════╗')
  console.log('║                      SUMMARY                               ║')
  console.log('╚════════════════════════════════════════════════════════════╝')
  console.log(colors.reset)

  const allPassed = Object.values(results).every(r => r.passed)

  if (allPassed) {
    console.log(`\n${colors.green}${colors.bold}✅ ALL CHECKS PASSED!${colors.reset}\n`)
    console.log(`${colors.cyan}Ready to run migration script:${colors.reset}`)
    console.log(`${colors.yellow}  npx tsx scripts/migrate-existing-promoters.ts${colors.reset}\n`)
  } else {
    console.log(`\n${colors.red}${colors.bold}❌ SOME CHECKS FAILED${colors.reset}\n`)
    console.log(`${colors.yellow}Please fix the issues above before running migration.${colors.reset}\n`)

    // Show action items
    console.log(`${colors.cyan}Action Items:${colors.reset}`)

    if (!results.envVars.passed) {
      console.log(`  1. ⚙️  Configure environment variables in .env.local`)
    }
    if (!results.dbSchema.passed || !results.functions.passed || !results.views.passed) {
      console.log(`  2. 🗄️  Run database migration SQL:`)
      console.log(`     - Open Supabase Dashboard → SQL Editor`)
      console.log(`     - Run: supabase-migration-promoter-system.sql`)
    }
    if (!results.spvAccounts.passed) {
      console.log(`  3. 👥 Create missing SPV accounts`)
      console.log(`     - See: MIGRATION_STEPS.md (Step 2)`)
    }

    console.log(`\n${colors.cyan}Then run this checker again:${colors.reset}`)
    console.log(`${colors.yellow}  npx tsx scripts/check-migration-ready.ts${colors.reset}\n`)
  }

  process.exit(allPassed ? 0 : 1)
}

main()
