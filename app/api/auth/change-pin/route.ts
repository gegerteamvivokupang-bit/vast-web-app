import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function POST(request: NextRequest) {
  // Validate environment variables
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { success: false, message: 'Server configuration error' },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const userId = body?.userId;
    const oldPin = body?.oldPin;
    const newPin = body?.newPin;

    // Input validation
    if (!userId || typeof userId !== 'string') {
      return NextResponse.json(
        { success: false, message: 'Invalid user ID' },
        { status: 400 }
      );
    }

    if (!oldPin || typeof oldPin !== 'string' || !/^\d{4}$/.test(oldPin)) {
      return NextResponse.json(
        { success: false, message: 'PIN lama harus 4 digit angka' },
        { status: 400 }
      );
    }

    if (!newPin || typeof newPin !== 'string' || !/^\d{4}$/.test(newPin)) {
      return NextResponse.json(
        { success: false, message: 'PIN baru harus 4 digit angka' },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Call the change_promoter_pin function
    const { data, error } = await supabase.rpc('change_promoter_pin', {
      p_user_id: userId,
      p_old_pin: oldPin,
      p_new_pin: newPin,
    });

    if (error) {
      return NextResponse.json(
        { success: false, message: 'Gagal mengubah PIN' },
        { status: 500 }
      );
    }

    const result = data?.[0];

    if (!result?.success) {
      return NextResponse.json(
        { success: false, message: result?.message || 'Gagal mengubah PIN' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'PIN berhasil diubah',
    });
  } catch {
    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan server' },
      { status: 500 }
    );
  }
}
