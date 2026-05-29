/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { PNG } from 'pngjs'

/**
 * Generates every packaged and in-app icon from the current source artwork.
 * Source: build/velox.png
 */
const root = resolve(import.meta.dirname, '..')
const buildDir = resolve(root, 'build')
const resourcesDir = resolve(root, 'resources')
const sourcePath = resolve(buildDir, 'velox.png')
const pngDir = resolve(buildDir, 'icons')
const iconsetDir = resolve(buildDir, 'icon.iconset')

const appIconSize = 512
const pngSizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024]
const icoSizes = [16, 24, 32, 48, 64, 128, 256]
const icnsEntries = [
  ['icp4', 16],
  ['icp5', 32],
  ['icp6', 64],
  ['ic07', 128],
  ['ic08', 256],
  ['ic09', 512],
  ['ic10', 1024]
]

if (!existsSync(sourcePath)) {
  throw new Error(`Missing source icon: ${sourcePath}`)
}

mkdirSync(buildDir, { recursive: true })
mkdirSync(resourcesDir, { recursive: true })
rmSync(pngDir, { force: true, recursive: true })
rmSync(iconsetDir, { force: true, recursive: true })
mkdirSync(pngDir, { recursive: true })
mkdirSync(iconsetDir, { recursive: true })

const source = PNG.sync.read(readFileSync(sourcePath))
const squareSource = cropToSquare(source)
const rendered = new Map(pngSizes.map((size) => [size, resizeImage(squareSource, size)]))

for (const [size, image] of rendered) {
  writePng(resolve(pngDir, `icon-${size}.png`), image)
}

writePng(resolve(buildDir, 'icon.png'), rendered.get(appIconSize))
writePng(resolve(resourcesDir, 'icon.png'), rendered.get(appIconSize))

writeIco(
  resolve(buildDir, 'icon.ico'),
  icoSizes.map((size) => ({ size, png: encodePng(rendered.get(size)) }))
)
writeIcns(
  resolve(buildDir, 'icon.icns'),
  icnsEntries.map(([type, size]) => ({ type, png: encodePng(rendered.get(size)) }))
)

writeIconset(rendered)

console.log('Generated Velox icon pack from build/velox.png.')

function writeIconset(renderedImages) {
  const iconsetTargets = [
    ['icon_16x16.png', 16],
    ['icon_16x16@2x.png', 32],
    ['icon_32x32.png', 32],
    ['icon_32x32@2x.png', 64],
    ['icon_128x128.png', 128],
    ['icon_128x128@2x.png', 256],
    ['icon_256x256.png', 256],
    ['icon_256x256@2x.png', 512],
    ['icon_512x512.png', 512],
    ['icon_512x512@2x.png', 1024]
  ]

  for (const [fileName, size] of iconsetTargets) {
    writePng(resolve(iconsetDir, fileName), renderedImages.get(size))
  }
}

function writePng(path, image) {
  if (!image) {
    throw new Error(`Cannot write missing image: ${path}`)
  }

  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, encodePng(image))
}

function encodePng(image) {
  return PNG.sync.write(image, {
    colorType: 6,
    inputColorType: 6
  })
}

function cropToSquare(image) {
  const cropSize = Math.min(image.width, image.height)
  const startX = Math.floor((image.width - cropSize) / 2)
  const startY = Math.floor((image.height - cropSize) / 2)
  const output = new PNG({ width: cropSize, height: cropSize })

  for (let y = 0; y < cropSize; y += 1) {
    for (let x = 0; x < cropSize; x += 1) {
      copyPixel(image, output, startX + x, startY + y, x, y)
    }
  }

  return output
}

function resizeImage(image, size) {
  const output = new PNG({ width: size, height: size })
  const scaleX = image.width / size
  const scaleY = image.height / size

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const sourceX = (x + 0.5) * scaleX - 0.5
      const sourceY = (y + 0.5) * scaleY - 0.5
      const [red, green, blue, alpha] = sampleBilinear(image, sourceX, sourceY)
      const offset = (y * size + x) * 4
      output.data[offset] = red
      output.data[offset + 1] = green
      output.data[offset + 2] = blue
      output.data[offset + 3] = alpha
    }
  }

  return output
}

function sampleBilinear(image, x, y) {
  const x0 = clamp(Math.floor(x), 0, image.width - 1)
  const y0 = clamp(Math.floor(y), 0, image.height - 1)
  const x1 = clamp(x0 + 1, 0, image.width - 1)
  const y1 = clamp(y0 + 1, 0, image.height - 1)
  const dx = clamp(x - x0, 0, 1)
  const dy = clamp(y - y0, 0, 1)
  const top = mixPixel(readPixel(image, x0, y0), readPixel(image, x1, y0), dx)
  const bottom = mixPixel(readPixel(image, x0, y1), readPixel(image, x1, y1), dx)

  return mixPixel(top, bottom, dy)
}

function readPixel(image, x, y) {
  const offset = (y * image.width + x) * 4

  return [
    image.data[offset],
    image.data[offset + 1],
    image.data[offset + 2],
    image.data[offset + 3]
  ]
}

function copyPixel(source, target, sourceX, sourceY, targetX, targetY) {
  const sourceOffset = (sourceY * source.width + sourceX) * 4
  const targetOffset = (targetY * target.width + targetX) * 4

  target.data[targetOffset] = source.data[sourceOffset]
  target.data[targetOffset + 1] = source.data[sourceOffset + 1]
  target.data[targetOffset + 2] = source.data[sourceOffset + 2]
  target.data[targetOffset + 3] = source.data[sourceOffset + 3]
}

function mixPixel(a, b, amount) {
  return [
    Math.round(a[0] * (1 - amount) + b[0] * amount),
    Math.round(a[1] * (1 - amount) + b[1] * amount),
    Math.round(a[2] * (1 - amount) + b[2] * amount),
    Math.round(a[3] * (1 - amount) + b[3] * amount)
  ]
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

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}
