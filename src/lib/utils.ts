export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function createFirebaseSafeNameKey(normalizedName: string): string {
  // URL safe encoding to ensure it is deterministic and Firebase safe.
  // encodeURIComponent leaves some characters like . ! ~ * ' ( )
  // We can convert it to base64 or a safe hex to avoid any Firebase path issues (. # $ [ ])
  // btoa works on ascii, let's use encodeURIComponent and replace .
  // Or even safer: convert to hex string
  let hex = '';
  const utf8 = unescape(encodeURIComponent(normalizedName));
  for (let i = 0; i < utf8.length; i++) {
    hex += utf8.charCodeAt(i).toString(16).padStart(2, '0');
  }
  return hex;
}
