# VAST Finance Form - Setup Guide

## 🎯 Fitur yang Sudah Dibuat

### 1. Database Schema
- ✅ Tabel `phone_types` - Master data tipe HP (dikelola super admin)
- ✅ Tabel `vast_finance_applications` - Data pengajuan customer VAST Finance
- ✅ RLS Policies yang sudah diperbaiki untuk promoter (tidak pakai Supabase Auth)

### 2. Form Input Promoter (`/promoter/vast-finance`)
Form lengkap dengan conditional logic:

**Data Pemohon:**
- Nama (sesuai KTP)
- No Telp Pemohon
- Foto KTP (auto upload ke Cloudinary: `vast-finance/ktp`)

**Data Pekerjaan & Keuangan:**
- Pekerjaan (dropdown: PNS, Pegawai Swasta, Buruh, Pelajar, IRT, Tidak Bekerja)
- Penghasilan (format rupiah otomatis)
- NPWP (Ada/Tidak Ada)

**Status Pengajuan:**
- ACC → Tampilkan Section A (Limit, Tipe HP, Foto Bukti)
- Belum disetujui → Section B (Selesai)
- Dapat limit tapi belum proses → Section C (Selesai)

### 3. Management Tipe HP (`/dashboard/phone-types`)
Khusus Super Admin:
- ✅ Tambah tipe HP baru
- ✅ Edit nama tipe HP
- ✅ Aktifkan/Nonaktifkan tipe HP
- ✅ Hapus (soft delete) tipe HP
- ✅ Real-time sync ke semua promoter

### 4. API Upload Image (`/api/upload-image`)
- ✅ Upload foto ke Cloudinary dengan folder custom
- ✅ Delete foto dari Cloudinary
- ✅ Return URL dan public_id untuk database

---

## 🚀 Cara Install

### **Step 1: Drop Tables Lama (Optional - Jika mau clean start)**
Buka Supabase SQL Editor, copy & paste:
```sql
-- File: supabase-vast-finance-drop.sql
```
⚠️ **WARNING**: Ini akan menghapus semua data!

### **Step 2: Run Migration Utama**
Copy & paste file ini ke Supabase SQL Editor:
```sql
-- File: supabase-vast-finance-migration.sql
```

File ini akan:
1. Membuat tabel `phone_types` dengan 6 tipe HP default
2. Membuat tabel `vast_finance_applications`
3. Setup RLS policies yang sudah diperbaiki
4. Membuat indexes untuk performa
5. Membuat triggers untuk auto-update timestamp

### **Step 3: Fix RLS (Jika masih error)**
Jika setelah Step 2 masih dapat error RLS policy, jalankan:
```sql
-- File: supabase-vast-finance-fix-rls.sql
```

---

## 🧪 Testing

### **Test 1: Login sebagai Promoter**
1. Login ke `/login` sebagai promoter
2. Di dashboard, klik tombol hijau "Form VAST Finance"
3. Isi semua field yang required
4. Upload foto KTP → otomatis tersimpan ke Cloudinary
5. Pilih status pengajuan:
   - **ACC**: Isi limit, pilih tipe HP, upload foto bukti
   - **Belum disetujui**: Langsung submit
   - **Dapat limit tapi belum proses**: Langsung submit
6. Submit → Seharusnya berhasil tanpa RLS error

### **Test 2: Login sebagai Super Admin**
1. Login ke `/login` sebagai super admin
2. Buka menu "Management Tipe HP"
3. Tambah tipe HP baru (misal: "T3x SERIES")
4. Logout dan login lagi sebagai promoter
5. Buka form VAST Finance → Tipe HP baru sudah muncul di dropdown

---

## 🔧 Troubleshooting

### Error: "violates row-level security policy"
**Solusi**: Run file `supabase-vast-finance-fix-rls.sql`

**Penjelasan**: Promoter tidak login via Supabase Auth (pakai localStorage session), jadi RLS policy tidak bisa pakai `auth.uid()`. Policy sudah dibuat permissive dengan validasi di application level.

### Error: "foreign key constraint cannot be implemented"
**Solusi**: Sudah diperbaiki! `store_id` sudah diganti dari UUID ke TEXT.

### Foto tidak terupload ke Cloudinary
**Cek**:
1. Pastikan environment variables sudah ada di `.env.local`:
   - `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`
2. Restart development server setelah update env

### Tipe HP tidak muncul di dropdown
**Cek**:
1. Di Supabase, cek tabel `phone_types` → pastikan ada data
2. Cek kolom `is_active` → harus `true`
3. Run query: `SELECT * FROM phone_types WHERE is_active = true;`

---

## 📊 Database Schema

### `phone_types`
```sql
id                UUID PRIMARY KEY
name              VARCHAR(100) UNIQUE
is_active         BOOLEAN
created_at        TIMESTAMP
updated_at        TIMESTAMP
created_by        UUID
updated_by        UUID
```

### `vast_finance_applications`
```sql
id                           UUID PRIMARY KEY
customer_name                VARCHAR(255)
customer_phone               VARCHAR(20)
customer_ktp_image_url       TEXT
customer_ktp_image_public_id TEXT
pekerjaan                    VARCHAR(50)
penghasilan                  DECIMAL(15,2)
has_npwp                     BOOLEAN
status_pengajuan             VARCHAR(50)
limit_amount                 DECIMAL(15,2)      -- Only if ACC
phone_type_id                UUID               -- Only if ACC
proof_image_url              TEXT               -- Only if ACC
proof_image_public_id        TEXT               -- Only if ACC
promoter_id                  UUID
promoter_name                VARCHAR(255)
store_id                     TEXT               -- Match stores.id type
created_by_user_id           UUID
created_at                   TIMESTAMP
updated_at                   TIMESTAMP
deleted_at                   TIMESTAMP
```

---

## 🔐 Security Notes

### Current RLS Setup (Development Mode)
- ✅ Phone types: Semua bisa view, hanya super admin bisa manage
- ✅ Applications: Policy permissive untuk promoter (tidak pakai auth.uid())
- ⚠️ Validasi dilakukan di application level

### Production Recommendations
Untuk production, pertimbangkan:
1. Login promoter via Supabase Auth (lebih aman)
2. Implement stricter RLS policies dengan auth.uid()
3. Add audit logging untuk tracking changes

---

## 📱 Routes

| Route | Role | Description |
|-------|------|-------------|
| `/promoter/vast-finance` | Promoter | Form input pengajuan VAST Finance |
| `/dashboard/phone-types` | Super Admin | Management tipe HP |
| `/api/upload-image` | All | API upload foto ke Cloudinary |

---

## 🎨 UI Features

1. **Auto Currency Format**: Penghasilan dan limit otomatis format rupiah (1.000.000)
2. **Image Preview**: Preview foto sebelum upload
3. **Upload Progress**: Loading indicator saat upload
4. **Conditional Sections**: Form berubah sesuai status pengajuan
5. **Validation**: Client-side validation sebelum submit
6. **Success Screen**: Konfirmasi setelah berhasil submit

---

## 📝 File Structure

```
app/
  ├── promoter/
  │   └── vast-finance/
  │       └── page.tsx           # Form input VAST Finance
  ├── dashboard/
  │   └── phone-types/
  │       └── page.tsx           # Management tipe HP
  └── api/
      └── upload-image/
          └── route.ts           # API upload Cloudinary

lib/
  ├── supabase.ts                # Database interfaces
  └── cloudinary.ts              # Cloudinary config

SQL Files:
  ├── supabase-vast-finance-migration.sql     # Main migration
  ├── supabase-vast-finance-fix-rls.sql       # Fix RLS policies
  └── supabase-vast-finance-drop.sql          # Drop tables
```

---

## ✅ Checklist Implementasi

- [x] Database schema dengan foreign keys yang benar
- [x] RLS policies untuk promoter (non-auth users)
- [x] Form input dengan conditional logic
- [x] Upload foto ke Cloudinary
- [x] Management tipe HP (CRUD)
- [x] TypeScript interfaces
- [x] Mobile-responsive UI
- [x] Error handling
- [x] Loading states
- [x] Success feedback

---

## 🆘 Support

Jika ada error atau pertanyaan:
1. Cek section Troubleshooting di atas
2. Cek console browser untuk error details
3. Cek Supabase logs untuk database errors
4. Pastikan semua migration sudah dijalankan dengan benar
