# VAST Web App - Production Readiness Plan

## STATUS: READY FOR DEPLOYMENT ✅

### Completed Tasks:
- [x] Security headers di next.config.ts
- [x] removeConsole untuk production
- [x] Environment variable validation
- [x] API route security (validation, sanitization)
- [x] Error handling improvements (no 'any' types)
- [x] Console.log cleanup di critical files
- [x] .env.example created
- [x] .gitignore updated
- [x] Build test passed

### Remaining (User Action):
- [ ] Delete SQL files di root folder
- [ ] Delete temporary documentation files
- [ ] Import data Desember ke vast_finance_applications (malam ini)

---

## Overview

Dokumen ini berisi rencana lengkap untuk mempersiapkan VAST Web App untuk production, termasuk:
1. Data Migration Strategy
2. Code Cleanup & Security
3. Performance Optimization
4. Testing Checklist
5. Deployment Steps

---

## 1. DATA MIGRATION STRATEGY

### Situasi Saat Ini:
- **Tabel `sales`**: Data dari Excel lama (sampai November 2024)
- **Tabel `vast_finance_applications`**: Data baru dari form online
- **Bulan Desember 2024**: Akan diimport dari Excel ke `vast_finance_applications`

### Rencana Import Data Desember:

#### A. Struktur Data yang Diperlukan
```sql
-- Kolom yang perlu di-import ke vast_finance_applications:
-- customer_name, customer_phone, customer_address, customer_job
-- ktp_number, limit_amount, dp_amount, tenor
-- phone_type, status_pengajuan, sale_date
-- promoter_name, store_id
-- ktp_image_url, proof_image_url (opsional)
```

#### B. Mapping Status
| Excel Status | vast_finance_applications.status_pengajuan |
|--------------|-------------------------------------------|
| ACC          | ACC                                        |
| Pending      | Dapat limit tapi belum proses             |
| Reject       | Belum disetujui                           |

#### C. Query Import Template
```sql
-- Jalankan setelah data disiapkan di tabel temporary
INSERT INTO vast_finance_applications (
  customer_name, customer_phone, customer_address, customer_job,
  ktp_number, limit_amount, dp_amount, tenor,
  phone_type, status_pengajuan, sale_date,
  promoter_name, store_id, created_at, updated_at
)
SELECT 
  temp.customer_name,
  temp.customer_phone,
  temp.customer_address,
  temp.customer_job,
  temp.ktp_number,
  temp.limit_amount,
  temp.dp_amount,
  temp.tenor,
  temp.phone_type,
  CASE 
    WHEN temp.status = 'ACC' THEN 'ACC'
    WHEN temp.status = 'Pending' THEN 'Dapat limit tapi belum proses'
    ELSE 'Belum disetujui'
  END as status_pengajuan,
  temp.sale_date,
  temp.promoter_name,
  s.id as store_id,
  NOW() as created_at,
  NOW() as updated_at
FROM temp_december_data temp
LEFT JOIN stores s ON s.name = temp.store_name;
```

---

## 2. CODE CLEANUP & SECURITY

### A. Console Logs yang Perlu Dihapus

#### CRITICAL - Hapus (expose sensitive data):
| File | Line | Issue |
|------|------|-------|
| login/page.tsx | 95-126 | Log promoter login data |
| dashboard/team/page.tsx | 260-328 | Log user creation data |
| dashboard/targets/page.tsx | 263-294 | Log target data |
| promoter/page.tsx | 221-300 | Log filter & query data |

#### KEEP - Error Logs (untuk monitoring):
- Semua `console.error` untuk API errors
- Gunakan kondisi `process.env.NODE_ENV === 'development'`

### B. Files yang Perlu Dibersihkan

```
Hapus file-file SQL yang tidak diperlukan di production:
- supabase-*.sql (semua file)
- check-*.sql
- cleanup-*.sql
- temp-fix.sql
- CREATE-ALL-PROMOTERS.sql
- FIX-AND-RETRY.sql
- RUN-THIS-ONE-TIME.sql
- create-spv-kupang.sql
```

### C. Security Improvements

#### 1. Environment Variables
```env
# Pastikan ini ada di .env.local dan TIDAK di-commit
NEXT_PUBLIC_SUPABASE_URL=xxx
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
CLOUDINARY_CLOUD_NAME=xxx
CLOUDINARY_API_KEY=xxx
CLOUDINARY_API_SECRET=xxx
```

#### 2. API Route Security
- Tambahkan rate limiting
- Validasi input lebih ketat
- Sanitize user input

#### 3. Supabase RLS (Row Level Security)
```sql
-- Pastikan RLS aktif di semua tabel
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE vast_finance_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE promoters ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE sators ENABLE ROW LEVEL SECURITY;
```

---

## 3. PERFORMANCE OPTIMIZATION

### A. Database Indexes
```sql
-- Index untuk query yang sering digunakan
CREATE INDEX IF NOT EXISTS idx_sales_sale_date ON sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_sales_promoter_name ON sales(promoter_name);
CREATE INDEX IF NOT EXISTS idx_vast_sale_date ON vast_finance_applications(sale_date);
CREATE INDEX IF NOT EXISTS idx_vast_promoter_name ON vast_finance_applications(promoter_name);
CREATE INDEX IF NOT EXISTS idx_vast_store_id ON vast_finance_applications(store_id);
CREATE INDEX IF NOT EXISTS idx_targets_month ON targets(month);
CREATE INDEX IF NOT EXISTS idx_promoters_area ON promoters(area);
CREATE INDEX IF NOT EXISTS idx_promoters_sator ON promoters(sator);
```

### B. Query Optimization
- Gunakan `select` spesifik, bukan `select *`
- Batasi jumlah data yang di-fetch
- Gunakan pagination untuk data besar

### C. Image Optimization
- Pastikan Cloudinary sudah optimize gambar otomatis
- Set max file size di upload (sudah 5MB)

---

## 4. TESTING CHECKLIST

### A. Functional Testing

#### Login
- [ ] Login sebagai Manager Area
- [ ] Login sebagai SPV Area (Kupang, Kabupaten, Sumba)
- [ ] Login sebagai Sator
- [ ] Login sebagai Promoter (PIN)
- [ ] Logout berfungsi

#### Dashboard Manager Area
- [ ] Stats hari ini muncul
- [ ] Modal detail per area berfungsi
- [ ] Stats bulan ini akurat
- [ ] 3 kolom navigasi (Area → Sator → Promoter)
- [ ] Refresh data berfungsi

#### Dashboard SPV
- [ ] Hanya melihat data area sendiri
- [ ] Target display benar
- [ ] Navigasi ke sator/promoter berfungsi

#### Rekap Bulanan
- [ ] Filter area berfungsi
- [ ] Filter bulan berfungsi
- [ ] Export Excel berfungsi
- [ ] Generate Gambar berfungsi
- [ ] Top 3 dan Bottom 3 benar
- [ ] Semua promoter tampil (termasuk 0 penjualan)

#### SPC Grup
- [ ] Hanya akses SPV Kupang, Sator Andri, Admin
- [ ] Filter periode berfungsi
- [ ] Export Excel dengan target
- [ ] Generate Gambar
- [ ] Copy WA dengan format benar

#### Laporan Harian
- [ ] Filter tanggal berfungsi
- [ ] Filter area/sator berfungsi
- [ ] Export Excel
- [ ] Copy WA

#### Setting Target
- [ ] MA: Set target SPV dan Sator
- [ ] SPV: Set target promoter (bulk)
- [ ] Validasi kategori (official/training)
- [ ] Perubahan bulan berfungsi

#### Management Tim
- [ ] Tambah promoter baru
- [ ] Edit promoter
- [ ] Non-aktifkan promoter
- [ ] Reset PIN
- [ ] Tambah/hapus toko

#### Form Promoter (Mobile)
- [ ] Login dengan PIN
- [ ] Form pengajuan VAST Finance
- [ ] Upload foto KTP
- [ ] Upload foto bukti
- [ ] Submit berhasil
- [ ] Lihat stats dan history

### B. Security Testing
- [ ] Tidak bisa akses halaman tanpa login
- [ ] SPV tidak bisa lihat area lain
- [ ] Sator hanya lihat tim sendiri
- [ ] Promoter hanya lihat data sendiri
- [ ] API tidak expose data sensitif
- [ ] Console browser bersih dari log sensitif

### C. Performance Testing
- [ ] Load time < 3 detik
- [ ] Image upload < 10 detik
- [ ] Export Excel < 5 detik untuk 1000 data
- [ ] Tidak ada memory leak

---

## 5. DEPLOYMENT STEPS

### Pre-Deployment
1. [ ] Backup database production
2. [ ] Run all cleanup scripts
3. [ ] Remove debug console.logs
4. [ ] Update environment variables
5. [ ] Test build locally: `npm run build`

### Database Migration
1. [ ] Import data Desember ke vast_finance_applications
2. [ ] Verify data count dan accuracy
3. [ ] Create missing indexes
4. [ ] Enable RLS policies

### Deployment
1. [ ] Deploy ke Vercel/hosting
2. [ ] Verify environment variables di hosting
3. [ ] Test semua fungsi utama
4. [ ] Monitor error logs

### Post-Deployment
1. [ ] Training user jika ada perubahan UI
2. [ ] Monitor performance 24 jam pertama
3. [ ] Siapkan rollback plan jika ada masalah

---

## 6. ROLLBACK PLAN

Jika terjadi masalah serius:

1. **Data Issue**:
   - Restore dari backup database
   - Identifikasi query yang bermasalah

2. **Code Issue**:
   - Revert ke commit sebelumnya
   - Deploy ulang versi stabil

3. **Performance Issue**:
   - Scale up database jika perlu
   - Add caching layer

---

## 7. MONITORING & MAINTENANCE

### Daily
- Check error logs di Supabase
- Monitor API response times

### Weekly
- Backup database
- Review user feedback

### Monthly
- Performance audit
- Security update check
- Cleanup old data jika perlu

---

## Estimasi Timeline

| Task | Durasi | Priority |
|------|--------|----------|
| Code Cleanup (console.log) | 30 menit | HIGH |
| Security Review | 1 jam | HIGH |
| Database Indexes | 15 menit | MEDIUM |
| Import Data Desember | 1-2 jam | HIGH |
| Testing | 2-3 jam | HIGH |
| Deployment | 30 menit | HIGH |
| **Total** | **5-7 jam** | |

---

## Catatan Penting

1. **Data Sales vs VAST Finance**:
   - `sales`: Data lama dari Excel (sampai Nov 2024)
   - `vast_finance_applications`: Data baru + import Des 2024
   - Semua halaman sudah query dari KEDUA tabel

2. **Status Mapping**:
   - ACC = Closing (sudah deal)
   - Pending / Dapat limit tapi belum proses = Dapat limit
   - Reject / Belum disetujui = Ditolak

3. **Role Access**:
   - `super_admin`: Akses semua
   - `manager_area`: Akses semua area, tidak bisa laporan harian
   - `spv_area`: Akses area sendiri saja
   - `sator`: Akses tim sendiri + tim lain yang di-assign

---

*Document Version: 1.0*
*Last Updated: December 2024*
