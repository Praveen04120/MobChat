export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function createFirebaseSafeNameKey(normalizedName: string): string {
  let hex = '';
  const utf8 = unescape(encodeURIComponent(normalizedName));
  for (let i = 0; i < utf8.length; i++) {
    hex += utf8.charCodeAt(i).toString(16).padStart(2, '0');
  }
  return hex;
}

export function getMediaType(file: File): "image" | "video" | "file" {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  // Fallback by extension
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) return 'image';
  if (['mp4', 'webm', 'mov'].includes(ext || '')) return 'video';
  return 'file';
}

export function validateFileSize(file: File): { valid: boolean; error?: string } {
  const type = getMediaType(file);
  const sizeMB = file.size / (1024 * 1024);
  
  if (type === 'image' && sizeMB > 10) {
    return { valid: false, error: "This image is too large. Maximum size is 10 MB." };
  }
  if (type === 'video' && sizeMB > 50) {
    return { valid: false, error: "This video is too large. Maximum size is 50 MB." };
  }
  if (type === 'file' && sizeMB > 25) {
    return { valid: false, error: "This file is too large. Maximum size is 25 MB." };
  }
  return { valid: true };
}
