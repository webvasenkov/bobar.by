/** The VPS build replaces this portable adapter with the native Sharp implementation. */
export async function optimizeImage(bytes: Uint8Array, contentType: string): Promise<{
  bytes: Uint8Array; contentType: string; blurDataURL: string | null; optimizationVersion: number;
}> {
  return { bytes, contentType, blurDataURL: null, optimizationVersion: 0 };
}
