'use client'

import * as pdfjsLib from 'pdfjs-dist'

// Configure the worker from the public folder
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

export interface RenderedPage {
  pageNumber: number
  dataUrl: string      // PNG data URL (for thumbnails / preview)
  blob: Blob           // PNG blob (for download / share)
  width: number
  height: number
}

export interface RenderOptions {
  scale?: number        // render scale (higher = better quality)
  onProgress?: (current: number, total: number) => void
  signal?: AbortSignal
}

/**
 * Render every page of a PDF file to a PNG blob/dataURL.
 */
export async function renderPdfToPngs(
  file: File,
  options: RenderOptions = {},
): Promise<RenderedPage[]> {
  const { scale = 2, onProgress, signal } = options

  const arrayBuffer = await file.arrayBuffer()
  if (signal?.aborted) throw new Error('aborted')

  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer })
  const pdf = await loadingTask.promise

  const total = pdf.numPages
  const pages: RenderedPage[] = []

  for (let i = 1; i <= total; i++) {
    if (signal?.aborted) {
      await loadingTask.destroy()
      throw new Error('aborted')
    }

    const page = await pdf.getPage(i)
    const viewport = page.getViewport({ scale })

    const canvas = document.createElement('canvas')
    canvas.width = Math.floor(viewport.width)
    canvas.height = Math.floor(viewport.height)
    const ctx = canvas.getContext('2d')!

    // White background to avoid transparency in PDFs
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    await page.render({
      canvas,
      canvasContext: ctx,
      viewport,
    } as any).promise

    const blob: Blob = await new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b!), 'image/png')
    })

    const dataUrl = canvas.toDataURL('image/png')

    pages.push({
      pageNumber: i,
      dataUrl,
      blob,
      width: canvas.width,
      height: canvas.height,
    })

    onProgress?.(i, total)
    page.cleanup()
  }

  await loadingTask.destroy()
  return pages
}

/**
 * Trigger a browser download of a Blob with a given filename.
 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * Share a PNG via WhatsApp.
 *
 * Strategy:
 *  1. On mobile / browsers that support navigator.share with files,
 *     use the native share sheet — WhatsApp will appear as a target.
 *  2. Otherwise, open WhatsApp Web with a text hint and trigger an
 *     automatic download so the user can manually attach the file.
 */
export async function sharePngViaWhatsApp(
  blob: Blob,
  filename: string,
): Promise<'shared' | 'fallback'> {
  const file = new File([blob], filename, { type: 'image/png' })

  // Try the native share API with files (works great on mobile)
  if (
    typeof navigator !== 'undefined' &&
    typeof (navigator as any).share === 'function' &&
    typeof (navigator as any).canShare === 'function' &&
    (navigator as any).canShare({ files: [file] })
  ) {
    try {
      await (navigator as any).share({
        files: [file],
        title: filename,
        text: '',
      })
      return 'shared'
    } catch (err: any) {
      // User cancelled or share failed — fall through to fallback
      if (err?.name === 'AbortError') return 'shared'
    }
  }

  // Fallback: download the file + open WhatsApp Web so the user can attach it
  downloadBlob(blob, filename)

  // Detect mobile to choose between wa.me (mobile) and web.whatsapp.com (desktop)
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  if (isMobile) {
    window.open('https://wa.me/', '_blank')
  } else {
    window.open('https://web.whatsapp.com/', '_blank')
  }
  return 'fallback'
}

/**
 * Zip multiple PNGs in-memory using a minimal store-only zip encoder
 * (no native deps, no compression — PNGs are already compressed).
 *
 * Returns a Blob with mime type 'application/zip'.
 */
export async function createZipFromPngs(
  pages: { blob: Blob; filename: string }[],
): Promise<Blob> {
  // CRC32 table
  const crcTable = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    crcTable[n] = c >>> 0
  }
  const crc32 = (buf: Uint8Array) => {
    let c = 0xffffffff
    for (let i = 0; i < buf.length; i++) {
      c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
    }
    return (c ^ 0xffffffff) >>> 0
  }

  const enc = new TextEncoder()
  const chunks: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0

  const push = (u: Uint8Array) => {
    chunks.push(u)
    offset += u.length
  }

  for (const { blob, filename } of pages) {
    const nameBytes = enc.encode(filename)
    const data = new Uint8Array(await blob.arrayBuffer())
    const crc = crc32(data)
    const size = data.length

    // Local file header
    const localHeader = new Uint8Array(30 + nameBytes.length)
    const dv = new DataView(localHeader.buffer)
    dv.setUint32(0, 0x04034b50, true)  // signature
    dv.setUint16(4, 20, true)           // version needed
    dv.setUint16(6, 0, true)            // flags
    dv.setUint16(8, 0, true)            // compression: store
    dv.setUint16(10, 0, true)           // mod time
    dv.setUint16(12, 0, true)           // mod date
    dv.setUint32(14, crc, true)
    dv.setUint32(18, size, true)        // compressed size
    dv.setUint32(22, size, true)        // uncompressed size
    dv.setUint16(26, nameBytes.length, true)
    dv.setUint16(28, 0, true)           // extra field length
    localHeader.set(nameBytes, 30)

    const localHeaderOffset = offset
    push(localHeader)
    push(data)

    // Central directory entry
    const centralEntry = new Uint8Array(46 + nameBytes.length)
    const cv = new DataView(centralEntry.buffer)
    cv.setUint32(0, 0x02014b50, true)
    cv.setUint16(4, 20, true)            // version made by
    cv.setUint16(6, 20, true)            // version needed
    cv.setUint16(8, 0, true)             // flags
    cv.setUint16(10, 0, true)            // compression
    cv.setUint16(12, 0, true)            // mod time
    cv.setUint16(14, 0, true)            // mod date
    cv.setUint32(16, crc, true)
    cv.setUint32(20, size, true)
    cv.setUint32(24, size, true)
    cv.setUint16(28, nameBytes.length, true)
    cv.setUint16(30, 0, true)            // extra length
    cv.setUint16(32, 0, true)            // comment length
    cv.setUint16(34, 0, true)            // disk number
    cv.setUint16(36, 0, true)            // internal attrs
    cv.setUint32(38, 0, true)            // external attrs
    cv.setUint32(42, localHeaderOffset, true)
    centralEntry.set(nameBytes, 46)
    central.push(centralEntry)
  }

  const centralStart = offset
  let centralSize = 0
  for (const c of central) {
    push(c)
    centralSize += c.length
  }

  // End of central directory record
  const eocd = new Uint8Array(22)
  const ev = new DataView(eocd.buffer)
  ev.setUint32(0, 0x06054b50, true)
  ev.setUint16(4, 0, true)   // disk number
  ev.setUint16(6, 0, true)   // disk with central dir
  ev.setUint16(8, pages.length, true)
  ev.setUint16(10, pages.length, true)
  ev.setUint32(12, centralSize, true)
  ev.setUint32(16, centralStart, true)
  ev.setUint16(20, 0, true)  // comment length
  push(eocd)

  return new Blob(chunks as BlobPart[], { type: 'application/zip' })
}
