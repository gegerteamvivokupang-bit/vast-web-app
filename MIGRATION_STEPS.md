# 🚀 MIGRATION STEPS - Promoter System

Panduan langkah-demi-langkah untuk migrasi sistem promoter.

---

## ✅ STEP 1: Update Database Schema

**File:** `supabase-migration-promoter-system.sql`

1. Buka Supabase Dashboard → SQL Editor
2. Copy-paste seluruh isi file `supabase-migration-promoter-system.sql`
3. Run query
4. Verify hasil:
   ```sql
   -- Check new columns
   SELECT column_name FROM information_schema.columns
   WHERE table_name = 'user_profiles'
   AND column_name IN ('employee_id', 'pin_hash');

   SELECT column_name FROM information_schema.columns
   WHERE table_name = 'promoters'
   AND column_name IN ('user_id', 'spv_id', 'area', 'category');
   ```

**Expected result:** Semua kolom baru ada

---

## ✅ STEP 2: Create Auth User untuk Gery (SPV Kupang)

1. Buka Supabase Dashboard → Authentication → Users
2. Klik "Add User" / "Invite User"
3. Input:
   - **Email:** `gery.spv@vast.com`
   - **Password:** (pilih password yang kuat)
   - **Auto Confirm User:** ✅ Yes
4. Klik "Create User"
5. Copy User ID yang di-generate

---

## ✅ STEP 3: Create User Profile untuk Gery

Jalankan query ini di Supabase SQL Editor (ganti `USER_ID_HERE` dengan ID dari step 2):

```sql
-- Insert profile untuk Gery SPV
INSERT INTO user_profiles (
  id,
  email,
  name,
  role,
  area,
  is_active,
  created_at
) VALUES (
  'USER_ID_HERE'::UUID,  -- GANTI dengan user ID dari step 2
  'gery.spv@vast.com',
  'Gery B. Dahoklory (SPV Kupang)',
  'spv_area',
  'KUPANG',
  TRUE,
  NOW()
);

-- Verify
SELECT email, name, role, area FROM user_profiles
WHERE email = 'gery.spv@vast.com';
```

**Expected result:** 1 row dengan data Gery

---

## ✅ STEP 4: Setup Environment Variables

Buat file `.env.local` atau update yang ada:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key  # PENTING untuk migration script

# Cloudinary
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

**PENTING:** `SUPABASE_SERVICE_ROLE_KEY` dibutuhkan untuk migration script.

Get service role key dari: Supabase Dashboard → Project Settings → API → service_role key

---

## ✅ STEP 5: Run Migration Script (Create Promoter Accounts)

**SEBELUM RUN:** Pastikan step 1-4 sudah selesai!

```bash
# Install dependencies jika belum
npm install

# Run migration script
npx tsx scripts/migrate-existing-promoters.ts
```

**Output yang diharapkan:**
```
🚀 Starting migration for existing promoters...
📊 Fetching promoters from database...
✅ Found 72 promoters to migrate
👥 Fetching SPV user IDs...
✅ Found 3 SPV users
⚙️  Processing promoters...

✅ KPG001 - John Doe (KUPANG)
✅ KPG002 - Jane Smith (KUPANG)
✅ KBP001 - Bob Wilson (KABUPATEN)
...

📊 MIGRATION SUMMARY:
==================================================
Total Promoters: 72
Successful: 72
Failed: 0

By Area:
  KUPANG: 28 promoters
  KABUPATEN: 23 promoters
  SUMBA: 21 promoters
==================================================

✅ Migration completed!
```

---

## ✅ STEP 6: Verify Migration Results

Jalankan query ini untuk verify:

```sql
-- Check total promoter accounts created
SELECT COUNT(*) as total_promoter_accounts
FROM user_profiles
WHERE role = 'promoter';
-- Expected: 72

-- Check promoters by area
SELECT area, COUNT(*) as count
FROM user_profiles
WHERE role = 'promoter'
GROUP BY area
ORDER BY area;
-- Expected: KUPANG (~28), KABUPATEN (~23), SUMBA (~21)

-- Check employee_id format
SELECT employee_id, name, area
FROM user_profiles
WHERE role = 'promoter'
ORDER BY employee_id
LIMIT 10;
-- Expected: KPG001, KPG002, ..., KBP001, ..., SMB001, ...

-- Check promoters table updated
SELECT
  COUNT(*) FILTER (WHERE user_id IS NOT NULL) as with_user,
  COUNT(*) FILTER (WHERE user_id IS NULL) as without_user
FROM promoters
WHERE is_active = true;
-- Expected: with_user = 72, without_user = 0

-- Check SPV assignments
SELECT
  p.area,
  spv.name as spv_name,
  COUNT(*) as promoter_count
FROM promoters p
JOIN user_profiles spv ON p.spv_id = spv.id
GROUP BY p.area, spv.name
ORDER BY p.area;
-- Expected:
--   KUPANG    | Gery B. Dahoklory (SPV Kupang) | 28
--   KABUPATEN | Wilibrodus Samara              | 23
--   SUMBA     | Anfal Jupriadi                 | 21
```

---

## ✅ STEP 7: Test Promoter Login

Sebelum deploy, test login dengan salah satu employee_id:

**Test Account:**
- Employee ID: `KPG001` (atau ambil dari database)
- PIN: `1234`

**Test Steps:**
1. Buka aplikasi
2. Login dengan employee_id + PIN
3. Harus masuk ke dashboard promotor
4. Test input pengajuan

---

## ❌ TROUBLESHOOTING

### Error: "SPV not found for area"
**Solusi:** Pastikan step 2-3 sudah selesai (create auth user + profile untuk Gery)

### Error: "Duplicate employee_id"
**Solusi:** Run script lagi, function `generate_employee_id` akan auto-increment

### Error: "RLS policy violation"
**Solusi:** Pastikan RLS policies dari migration SQL sudah di-run

### Promoter count tidak 72
**Solusi:**
```sql
-- Check inactive or deleted promoters
SELECT is_active, COUNT(*) FROM promoters GROUP BY is_active;

-- Check promoters that already have accounts
SELECT COUNT(*) FROM promoters WHERE user_id IS NOT NULL;
```

---

## 📋 POST-MIGRATION CHECKLIST

- [ ] Total 72 promoter accounts created
- [ ] Employee IDs format benar (KPG001, KBP001, SMB001)
- [ ] Semua promoters ter-assign ke SPV yang benar
- [ ] Gery SPV account created (gery.spv@vast.com)
- [ ] RLS policies working (test login per role)
- [ ] Migration script output saved (untuk audit)

---

## 🔐 DEFAULT CREDENTIALS

### Admin & Manager Accounts (Existing):
- **Super Admin:** admin@vast.com
- **Manager Area:** alberto@vast.com
- **SPV Kabupaten:** wilibrodus@vast.com
- **SPV Sumba:** anfal@vast.com

### New Accounts:
- **SPV Kupang:** gery.spv@vast.com (password: set in dashboard)

### All Promoters:
- **Employee ID:** KPG001, KPG002, ..., KBP001, ..., SMB001, ...
- **PIN:** 1234 (default)

**PENTING:** Inform all SPVs to have promoters change their PIN after first login!

---

## 📞 SUPPORT

Jika ada masalah saat migration:
1. Check error message di console
2. Verify database state dengan queries di atas
3. Rollback jika perlu (delete user_profiles dengan role = 'promoter')
4. Contact developer

---

**Migration Version:** 1.0
**Last Updated:** December 2025
