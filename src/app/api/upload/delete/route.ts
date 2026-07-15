import { list, del } from '@vercel/blob';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { roomCode } = await request.json();
    if (!roomCode) {
      return NextResponse.json({ error: 'roomCode is required' }, { status: 400 });
    }

    const prefix = `rooms/${roomCode}/`;
    let hasMore = true;
    let cursor: string | undefined;

    while (hasMore) {
      const listResult = await list({
        prefix,
        cursor,
      });

      if (listResult.blobs.length > 0) {
        const urlsToDelete = listResult.blobs.map((blob) => blob.url);
        await del(urlsToDelete);
      }

      hasMore = listResult.hasMore;
      cursor = listResult.cursor;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Blob cleanup error:", error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
