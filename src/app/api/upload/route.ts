import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        // Enforce dynamic file size limits based on media type sent from client
        let maximumSizeInBytes = 25 * 1024 * 1024; // Default 25MB for files
        
        if (clientPayload) {
          try {
            const payload = JSON.parse(clientPayload);
            if (payload.type === 'image') maximumSizeInBytes = 10 * 1024 * 1024;
            if (payload.type === 'video') maximumSizeInBytes = 50 * 1024 * 1024;
          } catch (e) {
            console.error('Invalid client payload');
          }
        }

        return {
          allowedContentTypes: [
            'image/jpeg', 'image/png', 'image/webp', 'image/gif',
            'video/mp4', 'video/webm',
            'application/pdf', 'application/msword', 
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'text/plain', 'application/zip', 'application/x-zip-compressed', 'application/x-zip'
          ],
          maximumSizeInBytes,
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        console.log('Blob upload completed', blob.url);
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 } 
    );
  }
}
