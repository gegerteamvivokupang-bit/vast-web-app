# 🎯 PLANNING & TODO LIST - VAST Web App
**Created:** 03 Desember 2025, 19:30 WIB
**Status:** Ready to implement

---

## ✅ YANG SUDAH SELESAI (Session 2)

1. ✅ Data migration fixed (3,419 sales dari 3,446 = 99.2%)
2. ✅ Filter area fixed (UPPERCASE: KUPANG, KABUPATEN, SUMBA)
3. ✅ Tambah button "Cari Data" (tidak auto-fetch)
4. ✅ UI filter diperbaiki (hide custom date, lebih simple)
5. ✅ Error "Invalid time value" di Rekap fixed

---

## 📊 KESEPAKATAN FINAL - STATUS PENGAJUAN

**DATABASE TETAP 3 STATUS (TIDAK PERLU DIUBAH):**
- `Reject` = Ditolak ❌
- `Pending` = Dapat limit, belum ambil HP ⏳
- `ACC` = Dapat limit, sudah ambil HP ✅

**TAMPILAN LAPORAN (HITUNG DARI DATABASE):**
```
Total Pengajuan: COUNT(*)
├─ Dapat Limit: COUNT(Pending) + COUNT(ACC)
│   ├─ Closing (Ambil HP): COUNT(ACC)
│   └─ Pending (Belum Ambil HP): COUNT(Pending)
└─ Reject: COUNT(Reject)
```

**Contoh:**
```
TUTOR HERY YULIUS DILLAK
├─ Total Pengajuan: 40
├─ Dapat Limit: 38 (95%)
│   ├─ Closing: 30 (75%)
│   └─ Pending: 8 (20%)
└─ Reject: 2 (5%)

Detail Per Promoter:
1. MARATHA MARLINDA
   - Pengajuan: 10 | Dapat Limit: 10 (100%)
     ├─ Closing: 8
     └─ Pending: 2
   - Reject: 0
```

---

## 👥 STRUKTUR ORGANISASI & HAK AKSES

### **HIERARKI:**
```
LEVEL 1 - SUPER ADMIN
├─ Gery B. Dahoklory (admin@vast.com)
│  Role: Owner + SPV Kupang
│  Access: ALL AREA
│
└─ Alberto G Munthe (alberto@vast.com)
   Role: Manager Area
   Access: ALL AREA

LEVEL 2 - AREA MANAGER/SPV
├─ KUPANG: Gery B. Dahoklory (dia sendiri)
│  ├─ TUTOR ANDRI (andri@vast.com) ← DAPAT LOGIN
│  │  └─ 14 promoters
│  └─ TUTOR ANTONIO (antonio@vast.com) ← DAPAT LOGIN
│     └─ 14 promoters
│
├─ KABUPATEN: Wilibrodus Samara (wilibrodus@vast.com)
│  ├─ SPV WILIBRODUS (5 promoters)
│  ├─ TUTOR HERY (4 promoters)
│  ├─ TUTOR LEU ADOLF (6 promoters)
│  ├─ TUTOR MARSELUS (2 promoters)
│  └─ TUTOR YACOB (6 promoters)
│  SATOR TIDAK DAPAT LOGIN ❌
│
└─ SUMBA: Anfal Jupriadi (anfal@vast.com)
   ├─ SPV ANFAL (11 promoters)
   └─ TUTOR KUSMYATI (10 promoters)
   SATOR TIDAK DAPAT LOGIN ❌
```

### **TOTAL USER LOGIN: 6 ORANG**
1. admin@vast.com - Gery (Super Admin)
2. alberto@vast.com - Alberto (Manager Area)
3. wilibrodus@vast.com - Wilibrodus (SPV Kabupaten)
4. anfal@vast.com - Anfal (SPV Sumba)
5. andri@vast.com - Andri (Sator Kupang)
6. antonio@vast.com - Antonio (Sator Kupang)

---

## 🔐 HAK AKSES DETAIL

### **1. GERY (Super Admin)**
- Login: admin@vast.com
- Akses: ALL AREA (Kupang, Kabupaten, Sumba)
- Filter: Area → Sator → Promoter (full access)
- Bisa lihat semua data tanpa pembatasan

### **2. ALBERTO (Manager Area)**
- Login: alberto@vast.com
- Akses: ALL AREA
- Filter: Area → Sator → Promoter (full access)
- Sama seperti Gery

### **3. WILIBRODUS (SPV Kabupaten)**
- Login: wilibrodus@vast.com
- Akses: HANYA KABUPATEN
- Filter: Sator → Promoter (area auto-set)
- Bisa lihat:
  - Global Kabupaten (semua sator)
  - Per Sator (termasuk tim dia sendiri)
  - Per Promoter

### **4. ANFAL (SPV Sumba)**
- Login: anfal@vast.com
- Akses: HANYA SUMBA
- Filter: Sator → Promoter (area auto-set)
- Bisa lihat:
  - Global Sumba (semua sator)
  - Per Sator (termasuk tim dia sendiri)
  - Per Promoter

### **5. ANDRI (Sator Kupang)**
- Login: andri@vast.com
- Akses: HANYA TIM ANDRI (14 promoters)
- Filter: Promoter saja (area & sator auto-set)
- **BISA LIHAT DATA ANTONIO** (sesama sator di Kupang, untuk compare)

### **6. ANTONIO (Sator Kupang)**
- Login: antonio@vast.com
- Akses: HANYA TIM ANTONIO (14 promoters)
- Filter: Promoter saja (area & sator auto-set)
- **BISA LIHAT DATA ANDRI** (sesama sator di Kupang, untuk compare)

---

## 📋 TODO LIST - PRIORITAS

### **FASE 1: DATABASE & AUTH (PRIORITAS TINGGI)**

#### ✅ 1.1. Buat Table Users
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT CHECK (role IN ('super_admin', 'manager_area', 'spv_area', 'sator')),
  area TEXT, -- KUPANG, KABUPATEN, SUMBA, or ALL
  sator_name TEXT, -- Untuk role sator
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### ✅ 1.2. Insert 6 Users
- Gery (super_admin, ALL)
- Alberto (manager_area, ALL)
- Wilibrodus (spv_area, KABUPATEN)
- Anfal (spv_area, SUMBA)
- Andri (sator, KUPANG, TUTOR ANDRI RUDOLOF ELI MANAFE)
- Antonio (sator, KUPANG, TUTOR ANTONIO DE JANAIRO TOMASOEY)

#### ✅ 1.3. Buat Table Area Hierarchy
```sql
CREATE TABLE area_hierarchy (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  area TEXT NOT NULL,
  manager_name TEXT NOT NULL,
  manager_user_id UUID REFERENCES users(id),
  sator_name TEXT NOT NULL,
  promoter_count INTEGER
);
```

#### ✅ 1.4. Setup Supabase Auth
- Enable email/password auth
- Create auth policies
- Link dengan table users

---

### **FASE 2: UPDATE TAMPILAN LAPORAN**

#### ✅ 2.1. Update Dashboard Overview
File: `app/dashboard/page.tsx`
- Tambah breakdown: Dapat Limit (Closing + Pending)
- Format: Total → Dapat Limit → Closing/Pending → Reject

#### ✅ 2.2. Update Laporan Harian
File: `app/dashboard/laporan-harian/page.tsx`
- Summary stats: 4 angka (Pengajuan, Dapat Limit, Closing, Reject)
- Table detail: tambah breakdown per row
- Filter tambahan: Sator & Promoter (dynamic based on area)

#### ✅ 2.3. Update Rekap Bulanan
File: `app/dashboard/rekap/page.tsx`
- Tampilan nested per Sator → Promoter
- Breakdown: Pengajuan → Dapat Limit (Closing/Pending) → Reject
- Format seperti contoh di atas

---

### **FASE 3: IMPLEMENT RBAC (Role-Based Access Control)**

#### ✅ 3.1. Buat Middleware Auth
File: `middleware.ts`
- Check user role & area
- Redirect based on access level
- Protect routes

#### ✅ 3.2. Buat Auth Context
File: `lib/auth-context.tsx`
- Store current user info (role, area, sator)
- Provide auth state to all components

#### ✅ 3.3. Update Login Page
File: `app/login/page.tsx`
- Support 6 users
- Redirect based on role
- Show error jika access denied

#### ✅ 3.4. Buat Component RoleGuard
File: `components/role-guard.tsx`
- Check if user can access certain feature
- Hide/show components based on role

---

### **FASE 4: FILTER DINAMIS**

#### ✅ 4.1. Buat Hook useUserAccess
File: `hooks/use-user-access.ts`
- Return available areas for user
- Return available sators for user
- Return available promoters for user

#### ✅ 4.2. Update Filter Components
- Area dropdown: dynamic based on role
- Sator dropdown: show after select area (dynamic)
- Promoter dropdown: show after select sator (dynamic)
- Auto-set filter for restricted users

#### ✅ 4.3. Update Query Logic
- Filter by user access level
- Hide data yang tidak boleh diakses
- Apply RLS (Row Level Security) di Supabase

---

### **FASE 5: FITUR TAMBAHAN**

#### ⏳ 5.1. Change Password
File: `app/dashboard/settings/page.tsx`
- Form change password
- Validation & update

#### ⏳ 5.2. Export Excel (Per Role)
- Export sesuai data yang bisa diakses user
- Include breakdown Dapat Limit

#### ⏳ 5.3. Upload Gambar
File: `app/dashboard/input/page.tsx`
- Cloudinary integration
- Save image_url & public_id

#### ⏳ 5.4. Dashboard Analytics
- Chart per Sator
- Chart per Promoter
- Trend analysis

---

## 📂 FILE STRUCTURE (YANG AKAN DIBUAT)

```
vast-web-app/
├── app/
│   ├── dashboard/
│   │   ├── page.tsx                 📝 UPDATE (breakdown stats)
│   │   ├── laporan-harian/page.tsx  📝 UPDATE (filter Sator/Promoter)
│   │   ├── rekap/page.tsx           📝 UPDATE (nested display)
│   │   ├── settings/
│   │   │   └── page.tsx             ✨ NEW (change password)
│   │   └── layout.tsx               📝 UPDATE (show user info)
│   └── login/page.tsx               📝 UPDATE (multi-user)
│
├── components/
│   ├── role-guard.tsx               ✨ NEW
│   └── filters/
│       ├── area-filter.tsx          ✨ NEW
│       ├── sator-filter.tsx         ✨ NEW
│       └── promoter-filter.tsx      ✨ NEW
│
├── hooks/
│   └── use-user-access.ts           ✨ NEW
│
├── lib/
│   ├── auth-context.tsx             ✨ NEW
│   ├── rbac.ts                      ✨ NEW (role logic)
│   └── supabase.ts                  📝 UPDATE (add types)
│
├── middleware.ts                    📝 UPDATE (RBAC)
│
├── supabase-schema-users.sql        ✨ NEW (user tables)
│
└── PLANNING_TODO.md                 ✅ THIS FILE
```

---

## 🔑 EMAIL & PASSWORD (DEFAULT)

**TEMPORARY - Nanti bisa diubah via settings:**

1. admin@vast.com / admin123
2. alberto@vast.com / alberto123
3. wilibrodus@vast.com / wili123
4. anfal@vast.com / anfal123
5. andri@vast.com / andri123
6. antonio@vast.com / antonio123

---

## 🚀 CARA MULAI (NEXT SESSION)

### **Step 1: Setup Database**
```bash
cd vast-web-app
# Run SQL di Supabase SQL Editor:
# - supabase-schema-users.sql
```

### **Step 2: Insert User Data**
```bash
npx tsx scripts/create-users.ts
```

### **Step 3: Update Code**
```bash
# Fase 1: Auth & RBAC
# Fase 2: Update tampilan
# Fase 3: Filter dinamis
```

### **Step 4: Testing**
- Login dengan 6 user berbeda
- Test akses sesuai role
- Test filter sesuai area/sator

---

## 📊 ESTIMASI WAKTU

- **Fase 1 (Database & Auth):** 1-2 jam
- **Fase 2 (Update Tampilan):** 1-2 jam
- **Fase 3 (RBAC):** 2-3 jam
- **Fase 4 (Filter Dinamis):** 1-2 jam
- **Fase 5 (Fitur Tambahan):** 2-3 jam

**Total:** 7-12 jam kerja

---

## 📝 CATATAN PENTING

1. **Database schema users** harus dibuat dulu sebelum coding
2. **Role logic** harus jelas sebelum implement RBAC
3. **Filter dinamis** perlu testing dengan berbagai role
4. **Data 826 ACC** sekarang dianggap sudah benar (Closing)
5. **Sator di Kabupaten & Sumba** tidak dapat login (hanya Kupang)
6. **Antonio & Andri** bisa saling lihat data untuk comparison

---

## 🎯 PRIORITAS NEXT SESSION

1. **PRIORITAS 1:** Setup users & RBAC (Fase 1 & 3)
2. **PRIORITAS 2:** Update tampilan laporan (Fase 2)
3. **PRIORITAS 3:** Filter dinamis (Fase 4)
4. **PRIORITAS 4:** Fitur tambahan (Fase 5)

---

**END OF PLANNING**

Siap dikerjakan! 🚀
