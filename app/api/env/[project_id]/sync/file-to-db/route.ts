import { NextResponse } from 'next/server';
import { syncEnvFileToDb } from '@/lib/services/env';

interface RouteContext {
  params: Promise<{ project_id: string }>;
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { project_id } = await params;
    const { searchParams } = new URL(request.url);
    const target = searchParams.get('target') ?? undefined;
    const synced = await syncEnvFileToDb(project_id, target || undefined);
    return NextResponse.json({
      success: true,
      synced_count: synced,
      message: `Synced ${synced} env vars from file to database`,
    });
  } catch (error) {
    console.error('[Env API] Failed to sync file to DB:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to sync env file to database',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
