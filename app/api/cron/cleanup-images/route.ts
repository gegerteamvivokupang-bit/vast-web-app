import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import cloudinary from '@/lib/cloudinary';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Secret key untuk validasi cron job (set di Vercel environment)
const CRON_SECRET = process.env.CRON_SECRET;

interface CleanupResult {
  totalChecked: number;
  deleted: number;
  failed: number;
  errors: string[];
}

// Fungsi untuk delete image dengan error handling
async function safeDeleteImage(publicId: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (!publicId || typeof publicId !== 'string') {
      return { success: false, error: 'Invalid public ID' };
    }

    const result = await cloudinary.uploader.destroy(publicId);
    
    // Cloudinary returns 'ok' for successful deletion, 'not found' if already deleted
    if (result.result === 'ok' || result.result === 'not found') {
      return { success: true };
    }
    
    return { success: false, error: `Unexpected result: ${result.result}` };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

// GET handler untuk cron job (Vercel Cron)
export async function GET(request: NextRequest) {
  // Validate cron secret
  const authHeader = request.headers.get('authorization');
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return runCleanup();
}

// POST handler untuk manual trigger
export async function POST(request: NextRequest) {
  // Validate cron secret
  const authHeader = request.headers.get('authorization');
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return runCleanup();
}

async function runCleanup(): Promise<NextResponse> {
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { error: 'Server configuration error' },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  const result: CleanupResult = {
    totalChecked: 0,
    deleted: 0,
    failed: 0,
    errors: [],
  };

  try {
    // Calculate date 30 days ago
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoffDate = thirtyDaysAgo.toISOString();

    // 1. Cleanup deleted vast_finance_applications images (soft deleted > 30 days)
    const { data: deletedApps } = await supabase
      .from('vast_finance_applications')
      .select('id, ktp_image_public_id, proof_image_public_id, deleted_at')
      .not('deleted_at', 'is', null)
      .lt('deleted_at', cutoffDate);

    if (deletedApps && deletedApps.length > 0) {
      for (const app of deletedApps) {
        result.totalChecked++;

        // Delete KTP image
        if (app.ktp_image_public_id) {
          const ktpResult = await safeDeleteImage(app.ktp_image_public_id);
          if (ktpResult.success) {
            result.deleted++;
          } else {
            result.failed++;
            if (ktpResult.error) {
              result.errors.push(`KTP ${app.id}: ${ktpResult.error}`);
            }
          }
        }

        // Delete proof image
        if (app.proof_image_public_id) {
          const proofResult = await safeDeleteImage(app.proof_image_public_id);
          if (proofResult.success) {
            result.deleted++;
          } else {
            result.failed++;
            if (proofResult.error) {
              result.errors.push(`Proof ${app.id}: ${proofResult.error}`);
            }
          }
        }

        // Clear the public_id fields after deletion
        await supabase
          .from('vast_finance_applications')
          .update({
            ktp_image_public_id: null,
            ktp_image_url: null,
            proof_image_public_id: null,
            proof_image_url: null,
          })
          .eq('id', app.id);
      }
    }

    // 2. Cleanup old sales images (deleted > 30 days)
    const { data: deletedSales } = await supabase
      .from('sales')
      .select('id, image_public_id, deleted_at')
      .not('deleted_at', 'is', null)
      .not('image_public_id', 'is', null)
      .lt('deleted_at', cutoffDate);

    if (deletedSales && deletedSales.length > 0) {
      for (const sale of deletedSales) {
        result.totalChecked++;

        if (sale.image_public_id) {
          const imgResult = await safeDeleteImage(sale.image_public_id);
          if (imgResult.success) {
            result.deleted++;
            
            // Clear the public_id field
            await supabase
              .from('sales')
              .update({
                image_public_id: null,
                image_url: null,
              })
              .eq('id', sale.id);
          } else {
            result.failed++;
            if (imgResult.error) {
              result.errors.push(`Sales ${sale.id}: ${imgResult.error}`);
            }
          }
        }
      }
    }

    // 3. Log cleanup result to database (using existing table)
    await supabase.from('image_cleanup_logs').insert({
      type: 'cloudinary_images',
      total_checked: result.totalChecked,
      deleted_count: result.deleted,
      failed_count: result.failed,
      errors: result.errors.length > 0 ? result.errors : null,
      executed_at: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: 'Cleanup completed',
      result: {
        totalChecked: result.totalChecked,
        deleted: result.deleted,
        failed: result.failed,
        errorCount: result.errors.length,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Cleanup failed', details: message },
      { status: 500 }
    );
  }
}
