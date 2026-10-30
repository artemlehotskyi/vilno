/** Стискає фото до ≤ maxSide по довгій стороні (JPEG). Менше трафіку з телефона і швидше CV. */
export async function shrinkImage(file: File, maxSide = 1600): Promise<Blob> {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bmp.width * scale)
  canvas.height = Math.round(bmp.height * scale)
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('не вдалося стиснути фото'))), 'image/jpeg', 0.85),
  )
}
