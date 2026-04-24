// Convert a File (including HEIC/HEIF via canvas) to base64 + normalized mime.
// HEIC is transcoded to PNG since GPT Image does not accept it.
export function readFileAsImageData(
  file: File,
): Promise<{ base64: string; mimeType: string; fileName: string } | null> {
  return new Promise((resolve, reject) => {
    const isHeic = file.type === 'image/heic' || file.type === 'image/heif'
    if (!isHeic) {
      const reader = new FileReader()
      reader.onload = () => resolve({
        base64: (reader.result as string).split(',')[1],
        mimeType: file.type,
        fileName: file.name,
      })
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(file)
      return
    }
    createImageBitmap(file)
      .then((bitmap) => {
        const canvas = document.createElement('canvas')
        canvas.width = bitmap.width
        canvas.height = bitmap.height
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(bitmap, 0, 0)
        bitmap.close()
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error(`无法转换 ${file.name}：canvas toBlob 失败`))
            return
          }
          const reader = new FileReader()
          reader.onload = () => resolve({
            base64: (reader.result as string).split(',')[1],
            mimeType: 'image/png',
            fileName: file.name.replace(/\.(heic|heif)$/i, '.png'),
          })
          reader.onerror = () => reject(reader.error)
          reader.readAsDataURL(blob)
        }, 'image/png')
      })
      .catch(() => {
        reject(new Error(`${file.name}：当前浏览器不支持 HEIC 格式。请在 iPhone「设置 > 相机 > 格式」中选择"兼容性最佳"，或使用 Safari 浏览器。`))
      })
  })
}
