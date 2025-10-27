export async function generateQRCode(text: string): Promise<string> {
  // Use a simple QR code API service
  const size = 200
  const url = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}`
  return url
}
