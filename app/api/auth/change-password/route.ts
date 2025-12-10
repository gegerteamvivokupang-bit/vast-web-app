import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(request: NextRequest) {
  // Validate environment variables
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { success: false, message: 'Server configuration error' },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const userId = body?.userId;
    const oldPassword = body?.oldPassword;
    const newPassword = body?.newPassword;

    // Input validation
    if (!userId || typeof userId !== 'string') {
      return NextResponse.json(
        { success: false, message: 'Invalid user ID' },
        { status: 400 }
      );
    }

    if (!oldPassword || typeof oldPassword !== 'string') {
      return NextResponse.json(
        { success: false, message: 'Password lama diperlukan' },
        { status: 400 }
      );
    }

    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
      return NextResponse.json(
        { success: false, message: 'Password baru minimal 6 karakter' },
        { status: 400 }
      );
    }

    // Create admin client for user management
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Get user email first
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
    
    if (userError || !userData.user) {
      return NextResponse.json(
        { success: false, message: 'User tidak ditemukan' },
        { status: 404 }
      );
    }

    // Verify old password by attempting to sign in
    const { error: signInError } = await supabaseAdmin.auth.signInWithPassword({
      email: userData.user.email!,
      password: oldPassword,
    });

    if (signInError) {
      return NextResponse.json(
        { success: false, message: 'Password lama salah' },
        { status: 401 }
      );
    }

    // Update password using admin API
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { password: newPassword }
    );

    if (updateError) {
      return NextResponse.json(
        { success: false, message: 'Gagal mengubah password' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Password berhasil diubah',
    });
  } catch {
    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan server' },
      { status: 500 }
    );
  }
}
