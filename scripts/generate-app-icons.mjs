import { mkdir } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import sharp from "sharp"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const brandDirectory = path.join(root, "assets", "brand")
const imageDirectory = path.join(root, "assets", "images")

const logoSource = path.join(brandDirectory, "moneyfly-cash-icon.svg")
const iconSize = 1024
const standardArtworkSize = 600
const adaptiveArtworkSize = 480
const background = { r: 25, g: 27, b: 25, alpha: 1 }

const markTargets = [
  "app-icon-all.png",
  "app-icon-ios.png",
  "app-icon-android-legacy.png",
  "app-icon-web-favicon.png",
]

await mkdir(imageDirectory, { recursive: true })

const trimmedLogo = await sharp(logoSource, { density: 384 })
  .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer()

const createForeground = async (artworkSize) => {
  const artwork = await sharp(trimmedLogo)
    .resize(artworkSize, artworkSize, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer()

  return sharp({
    create: {
      width: iconSize,
      height: iconSize,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: artwork, gravity: "center" }])
    .png()
    .toBuffer()
}

const standardForeground = await createForeground(standardArtworkSize)
const adaptiveForeground = await createForeground(adaptiveArtworkSize)

const standardIcon = await sharp({
  create: {
    width: iconSize,
    height: iconSize,
    channels: 4,
    background,
  },
})
  .composite([{ input: standardForeground }])
  .png()
  .toBuffer()

await Promise.all(
  markTargets.map((filename) => sharp(standardIcon).toFile(path.join(imageDirectory, filename))),
)

await Promise.all([
  sharp(adaptiveForeground).toFile(
    path.join(imageDirectory, "app-icon-android-adaptive-foreground.png"),
  ),
  sharp({
    create: {
      width: iconSize,
      height: iconSize,
      channels: 4,
      background,
    },
  })
    .png()
    .toFile(path.join(imageDirectory, "app-icon-android-adaptive-background.png")),
])

console.log("Generated Expo app icons from assets/brand/moneyfly-cash-icon.svg")
