/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { deflateSync } from 'node:zlib'

const root = resolve(import.meta.dirname, '..')
const buildDir = resolve(root, 'build')
const resourcesDir = resolve(root, 'resources')

const pngTargets = [
  { path: resolve(buildDir, 'icon.png'), size: 512 },
  { path: resolve(resourcesDir, 'icon.png'), size: 512 }
]

const icoSizes = [16, 24, 32, 48, 64, 128, 256]
const icnsTypes = [
  ['icp4', 16],
  ['icp5', 32],
  ['icp6', 64],
  ['ic07', 128],
  ['ic08', 256],
  ['ic09', 512],
  ['ic10', 1024]
]

mkdirSync(buildDir, { recursive: true })
mkdirSync(resourcesDir, { recursive: true })

for (const target of pngTargets) {
  writePng(target.path, renderIcon(target.size))
}

writeIco(
  resolve(buildDir, 'icon.ico'),
  icoSizes.map((size) => ({ size, png: encodePng(renderIcon(size)) }))
)
writeIcns(
  resolve(buildDir, 'icon.icns'),
  icnsTypes.map(([type, size]) => ({ type, png: encodePng(renderIcon(size)) }))
)
rmSync(resolve(buildDir, 'icon.iconset'), { force: true, recursive: true })

console.log('Generated Velox icons in build/ and resources/.')

function writePng(path, image) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, encodePng(image))
}

function renderIcon(size) {
  const pixels = new Uint8Array(size * size * 4)

  drawRoundedRect(pixels, size, 34, 34, 444, 444, 104, (x, y) =>
    mix([91, 92, 246], mix([37, 99, 235], [15, 118, 110], y), x * 0.2 + y * 0.8)
  )
  drawStroke(pixels, size, [117, 140, 92, 208, 148, 291, 183, 273], 18, [255, 255, 255, 72])
  drawRoundedRect(pixels, size, 142, 104, 228, 300, 39, (x, y) =>
    mix([255, 255, 255], [238, 244, 255], y)
  )
  drawPolygon(
    pixels,
    size,
    [
      [320, 104],
      [370, 155],
      [330, 155],
      [320, 145]
    ],
    [220, 232, 255, 255]
  )
  drawStroke(pixels, size, [184, 174, 260, 174], 16, [148, 163, 184, 255])
  drawStroke(pixels, size, [184, 210, 286, 210], 14, [203, 213, 225, 255])
  drawStroke(pixels, size, [184, 246, 239, 246], 14, [203, 213, 225, 255])
  drawStroke(pixels, size, [171, 236, 240, 323, 344, 177], 42, [17, 24, 39, 255])
  drawStroke(pixels, size, [171, 236, 240, 323, 344, 177], 16, [255, 255, 255, 42])

  return { width: size, height: size, pixels }
}

function drawRoundedRect(pixels, size, x, y, width, height, radius, colorAt) {
  const scale = size / 512
  const bounds = scaleBounds(x, y, width, height, scale)
  const samples = size < 64 ? 2 : 3

  for (let py = bounds.top; py < bounds.bottom; py += 1) {
    for (let px = bounds.left; px < bounds.right; px += 1) {
      const coverage = sampleCoverage(px, py, samples, (sx, sy) =>
        roundedRectCoverage(sx / scale, sy / scale, x, y, width, height, radius)
      )

      if (coverage <= 0) {
        continue
      }

      const color = colorAt(
        (px - bounds.left) / Math.max(1, bounds.right - bounds.left),
        (py - bounds.top) / Math.max(1, bounds.bottom - bounds.top)
      )
      blendPixel(pixels, size, px, py, [color[0], color[1], color[2], Math.round(255 * coverage)])
    }
  }
}

function drawStroke(pixels, size, points, width, color) {
  const scale = size / 512
  const scaledWidth = width * scale
  const xs = []
  const ys = []

  for (let index = 0; index < points.length; index += 2) {
    xs.push(points[index] * scale)
    ys.push(points[index + 1] * scale)
  }

  const left = Math.max(0, Math.floor(Math.min(...xs) - scaledWidth))
  const right = Math.min(size, Math.ceil(Math.max(...xs) + scaledWidth))
  const top = Math.max(0, Math.floor(Math.min(...ys) - scaledWidth))
  const bottom = Math.min(size, Math.ceil(Math.max(...ys) + scaledWidth))
  const samples = size < 64 ? 2 : 3

  for (let py = top; py < bottom; py += 1) {
    for (let px = left; px < right; px += 1) {
      const coverage = sampleCoverage(px, py, samples, (sx, sy) => {
        let distance = Number.POSITIVE_INFINITY

        for (let index = 0; index < xs.length - 1; index += 1) {
          distance = Math.min(
            distance,
            distanceToSegment(sx, sy, xs[index], ys[index], xs[index + 1], ys[index + 1])
          )
        }

        return distance <= scaledWidth / 2 ? 1 : 0
      })

      if (coverage > 0) {
        blendPixel(pixels, size, px, py, [
          color[0],
          color[1],
          color[2],
          Math.round(color[3] * coverage)
        ])
      }
    }
  }
}

function drawPolygon(pixels, size, points, color) {
  const scale = size / 512
  const scaled = points.map(([x, y]) => [x * scale, y * scale])
  const left = Math.max(0, Math.floor(Math.min(...scaled.map(([x]) => x))))
  const right = Math.min(size, Math.ceil(Math.max(...scaled.map(([x]) => x))))
  const top = Math.max(0, Math.floor(Math.min(...scaled.map(([, y]) => y))))
  const bottom = Math.min(size, Math.ceil(Math.max(...scaled.map(([, y]) => y))))
  const samples = 3

  for (let py = top; py < bottom; py += 1) {
    for (let px = left; px < right; px += 1) {
      const coverage = sampleCoverage(px, py, samples, (sx, sy) =>
        pointInPolygon(sx, sy, scaled) ? 1 : 0
      )

      if (coverage > 0) {
        blendPixel(pixels, size, px, py, [
          color[0],
          color[1],
          color[2],
          Math.round(color[3] * coverage)
        ])
      }
    }
  }
}

function scaleBounds(x, y, width, height, scale) {
  return {
    left: Math.max(0, Math.floor(x * scale - 1)),
    top: Math.max(0, Math.floor(y * scale - 1)),
    right: Math.min(Math.ceil((x + width) * scale + 1), Math.ceil(512 * scale)),
    bottom: Math.min(Math.ceil((y + height) * scale + 1), Math.ceil(512 * scale))
  }
}

function roundedRectCoverage(px, py, x, y, width, height, radius) {
  const nearestX = clamp(px, x + radius, x + width - radius)
  const nearestY = clamp(py, y + radius, y + height - radius)
  const dx = px - nearestX
  const dy = py - nearestY

  return dx * dx + dy * dy <= radius * radius ? 1 : 0
}

function sampleCoverage(px, py, samples, test) {
  let hits = 0

  for (let y = 0; y < samples; y += 1) {
    for (let x = 0; x < samples; x += 1) {
      if (test(px + (x + 0.5) / samples, py + (y + 0.5) / samples)) {
        hits += 1
      }
    }
  }

  return hits / (samples * samples)
}

function distanceToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax
  const dy = by - ay
  const lengthSquared = dx * dx + dy * dy
  const t = lengthSquared === 0 ? 0 : clamp(((px - ax) * dx + (py - ay) * dy) / lengthSquared, 0, 1)
  const x = ax + t * dx
  const y = ay + t * dy

  return Math.hypot(px - x, py - y)
}

function pointInPolygon(px, py, points) {
  let inside = false

  for (
    let index = 0, previous = points.length - 1;
    index < points.length;
    previous = index, index += 1
  ) {
    const [xi, yi] = points[index]
    const [xj, yj] = points[previous]
    const intersects = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi

    if (intersects) {
      inside = !inside
    }
  }

  return inside
}

function blendPixel(pixels, size, x, y, color) {
  const offset = (y * size + x) * 4
  const sourceAlpha = color[3] / 255
  const targetAlpha = pixels[offset + 3] / 255
  const outAlpha = sourceAlpha + targetAlpha * (1 - sourceAlpha)

  if (outAlpha <= 0) {
    return
  }

  pixels[offset] = Math.round(
    (color[0] * sourceAlpha + pixels[offset] * targetAlpha * (1 - sourceAlpha)) / outAlpha
  )
  pixels[offset + 1] = Math.round(
    (color[1] * sourceAlpha + pixels[offset + 1] * targetAlpha * (1 - sourceAlpha)) / outAlpha
  )
  pixels[offset + 2] = Math.round(
    (color[2] * sourceAlpha + pixels[offset + 2] * targetAlpha * (1 - sourceAlpha)) / outAlpha
  )
  pixels[offset + 3] = Math.round(outAlpha * 255)
}

function encodePng(image) {
  const bytesPerRow = image.width * 4 + 1
  const raw = Buffer.alloc(bytesPerRow * image.height)

  for (let y = 0; y < image.height; y += 1) {
    raw[y * bytesPerRow] = 0
    Buffer.from(image.pixels.buffer, y * image.width * 4, image.width * 4).copy(
      raw,
      y * bytesPerRow + 1
    )
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr(image.width, image.height)),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0))
  ])
}

function ihdr(width, height) {
  const buffer = Buffer.alloc(13)
  buffer.writeUInt32BE(width, 0)
  buffer.writeUInt32BE(height, 4)
  buffer[8] = 8
  buffer[9] = 6
  buffer[10] = 0
  buffer[11] = 0
  buffer[12] = 0
  return buffer
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii')
  const length = Buffer.alloc(4)
  const crc = Buffer.alloc(4)

  length.writeUInt32BE(data.length, 0)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0)

  return Buffer.concat([length, typeBuffer, data, crc])
}

function writeIco(path, images) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(images.length, 4)

  const entries = []
  const payloads = []
  let offset = 6 + images.length * 16

  for (const image of images) {
    const entry = Buffer.alloc(16)
    entry[0] = image.size >= 256 ? 0 : image.size
    entry[1] = image.size >= 256 ? 0 : image.size
    entry[2] = 0
    entry[3] = 0
    entry.writeUInt16LE(1, 4)
    entry.writeUInt16LE(32, 6)
    entry.writeUInt32LE(image.png.length, 8)
    entry.writeUInt32LE(offset, 12)
    entries.push(entry)
    payloads.push(image.png)
    offset += image.png.length
  }

  writeFileSync(path, Buffer.concat([header, ...entries, ...payloads]))
}

function writeIcns(path, images) {
  const chunks = images.map((image) => {
    const header = Buffer.alloc(8)
    header.write(image.type, 0, 4, 'ascii')
    header.writeUInt32BE(image.png.length + 8, 4)
    return Buffer.concat([header, image.png])
  })
  const header = Buffer.alloc(8)
  const length = 8 + chunks.reduce((total, chunk) => total + chunk.length, 0)

  header.write('icns', 0, 4, 'ascii')
  header.writeUInt32BE(length, 4)
  writeFileSync(path, Buffer.concat([header, ...chunks]))
}

function crc32(buffer) {
  let crc = 0xffffffff

  for (const byte of buffer) {
    crc ^= byte

    for (let index = 0; index < 8; index += 1) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1
    }
  }

  return (crc ^ 0xffffffff) >>> 0
}

function mix(a, b, amount) {
  return [
    Math.round(a[0] * (1 - amount) + b[0] * amount),
    Math.round(a[1] * (1 - amount) + b[1] * amount),
    Math.round(a[2] * (1 - amount) + b[2] * amount)
  ]
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}
