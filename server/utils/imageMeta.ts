// server/utils/imageMeta.ts
//
// 轻量级图片尺寸读取：直接解析二进制头部，无需 sharp 等外部依赖。
// 支持 PNG / JPEG / GIF / WEBP / BMP。解析失败返回 { width: 0, height: 0 }。

interface Dimensions { width: number; height: number }

export function readImageDimensions(buf: Buffer, mimeType: string): Dimensions {
  try {
    if (mimeType === 'image/png') return readPng(buf)
    if (mimeType === 'image/jpeg') return readJpeg(buf)
    if (mimeType === 'image/gif') return readGif(buf)
    if (mimeType === 'image/webp') return readWebp(buf)
    if (mimeType === 'image/bmp') return readBmp(buf)
  } catch {
    // 解析失败不阻塞上传
  }
  return { width: 0, height: 0 }
}

function readPng(buf: Buffer): Dimensions {
  // PNG: bytes 16-24 are width/height as big-endian uint32
  if (buf.length < 24) return { width: 0, height: 0 }
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
  }
}

function readGif(buf: Buffer): Dimensions {
  // GIF: bytes 6-10 are width/height as little-endian uint16
  if (buf.length < 10) return { width: 0, height: 0 }
  return {
    width: buf.readUInt16LE(6),
    height: buf.readUInt16LE(8),
  }
}

function readBmp(buf: Buffer): Dimensions {
  // BMP: bytes 18-26 are width/height as little-endian int32
  if (buf.length < 26) return { width: 0, height: 0 }
  return {
    width: Math.abs(buf.readInt32LE(18)),
    height: Math.abs(buf.readInt32LE(22)),
  }
}

function readJpeg(buf: Buffer): Dimensions {
  // JPEG: scan SOF markers (0xFFC0–0xFFCF, excluding 0xFFC4/0xFFC8/0xFFCC)
  // to find width/height. Each SOF segment: [0xFF, marker, lenHi, lenLo, precision, heightHi, heightLo, widthHi, widthLo]
  let offset = 2 // skip SOI marker (0xFFD8)
  while (offset < buf.length - 1) {
    if (buf[offset] !== 0xff) { offset++; continue }
    const marker = buf[offset + 1]
    // SOF markers: C0,C1,C2,C3,C5,C6,C7,C9,CA,CB,CD,CE,CF
    const isSof =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf)
    if (isSof) {
      // height at offset+5, width at offset+7 (big-endian uint16)
      if (offset + 9 <= buf.length) {
        return {
          height: buf.readUInt16BE(offset + 5),
          width: buf.readUInt16BE(offset + 7),
        }
      }
      return { width: 0, height: 0 }
    }
    // Skip this segment: read length (big-endian uint16 at offset+2)
    if (offset + 4 > buf.length) return { width: 0, height: 0 }
    const segLen = buf.readUInt16BE(offset + 2)
    offset += 2 + segLen
  }
  return { width: 0, height: 0 }
}

function readWebp(buf: Buffer): Dimensions {
  // WEBP: RIFF header at 0, "WEBP" at 8, then VP8/VP8L/VP8X chunk
  if (buf.length < 30) return { width: 0, height: 0 }
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') {
    return { width: 0, height: 0 }
  }
  const chunkType = buf.toString('ascii', 12, 16)
  if (chunkType === 'VP8 ') {
    // Lossy: width/height at offset 26-30 (little-endian uint16, 14-bit)
    return {
      width: buf.readUInt16LE(26) & 0x3fff,
      height: buf.readUInt16LE(28) & 0x3fff,
    }
  }
  if (chunkType === 'VP8L') {
    // Lossless: signature byte at 20, then 14-bit width/height packed
    const b0 = buf[21]
    const b1 = buf[22]
    const b2 = buf[23]
    const b3 = buf[24]
    const width = 1 + ((b1 & 0x3f) << 8 | b0)
    const height = 1 + ((b3 & 0x0f) << 10 | b2 << 2 | (b1 & 0xc0) >> 6)
    return { width, height }
  }
  if (chunkType === 'VP8X') {
    // Extended: canvas size at offset 24-30 (24-bit little-endian, +1)
    return {
      width: 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16)),
      height: 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16)),
    }
  }
  return { width: 0, height: 0 }
}
