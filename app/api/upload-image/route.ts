import { NextRequest, NextResponse } from 'next/server';
import cloudinary, { uploadImage } from '@/lib/cloudinary';

// Maximum file size: 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const folder = formData.get('folder') as string || 'vast-finance';

    // Validation: file exists
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validation: file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only JPEG, PNG, and WebP are allowed.' },
        { status: 400 }
      );
    }

    // Validation: file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 5MB.' },
        { status: 400 }
      );
    }

    // Sanitize folder name
    const sanitizedFolder = folder.replace(/[^a-zA-Z0-9-_]/g, '');

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Upload to Cloudinary
    const result = await uploadImage(buffer, sanitizedFolder) as { secure_url: string; public_id: string };

    return NextResponse.json({
      url: result.secure_url,
      publicId: result.public_id,
    });
  } catch {
    return NextResponse.json(
      { error: 'Upload failed' },
      { status: 500 }
    );
  }
}

// API untuk delete image
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const publicId = body?.publicId;

    // Validation
    if (!publicId || typeof publicId !== 'string') {
      return NextResponse.json(
        { error: 'Invalid public ID' },
        { status: 400 }
      );
    }

    // Sanitize public ID (only allow alphanumeric, /, -, _)
    if (!/^[a-zA-Z0-9/_-]+$/.test(publicId)) {
      return NextResponse.json(
        { error: 'Invalid public ID format' },
        { status: 400 }
      );
    }

    const result = await cloudinary.uploader.destroy(publicId);

    return NextResponse.json({ success: true, result });
  } catch {
    return NextResponse.json(
      { error: 'Delete failed' },
      { status: 500 }
    );
  }
}
