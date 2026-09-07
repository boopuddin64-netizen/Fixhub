import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

async function generateIcons() {
  const publicDir = path.resolve(process.cwd(), 'public');
  const svgPath = path.join(publicDir, 'logo.svg');

  if (!fs.existsSync(svgPath)) {
    console.error('logo.svg not found in public directory!');
    process.exit(1);
  }

  const svgBuffer = fs.readFileSync(svgPath);

  console.log('Generating PNG icons for Apple iOS Home Screen and PWA Manifest...');

  // 1. Apple Touch Icon 180x180
  await sharp(svgBuffer)
    .resize(180, 180, { fit: 'contain', background: { r: 15, g: 23, b: 42, alpha: 1 } })
    .png()
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));
  console.log('✓ Generated apple-touch-icon.png (180x180)');

  // 2. Apple Touch Icon Precomposed 180x180
  await sharp(svgBuffer)
    .resize(180, 180, { fit: 'contain', background: { r: 15, g: 23, b: 42, alpha: 1 } })
    .png()
    .toFile(path.join(publicDir, 'apple-touch-icon-precomposed.png'));
  console.log('✓ Generated apple-touch-icon-precomposed.png (180x180)');

  // 3. PWA 192x192
  await sharp(svgBuffer)
    .resize(192, 192, { fit: 'contain', background: { r: 15, g: 23, b: 42, alpha: 1 } })
    .png()
    .toFile(path.join(publicDir, 'pwa-192x192.png'));
  console.log('✓ Generated pwa-192x192.png (192x192)');

  // 4. PWA 512x512
  await sharp(svgBuffer)
    .resize(512, 512, { fit: 'contain', background: { r: 15, g: 23, b: 42, alpha: 1 } })
    .png()
    .toFile(path.join(publicDir, 'pwa-512x512.png'));
  console.log('✓ Generated pwa-512x512.png (512x512)');

  // 5. PWA Maskable 512x512 (with 15% safe padding for Android squircles/circles)
  const innerSize = Math.round(512 * 0.75); // 384px
  const innerBuffer = await sharp(svgBuffer)
    .resize(innerSize, innerSize, { fit: 'contain' })
    .toBuffer();

  await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 15, g: 23, b: 42, alpha: 1 },
    },
  })
    .composite([
      {
        input: innerBuffer,
        top: Math.round((512 - innerSize) / 2),
        left: Math.round((512 - innerSize) / 2),
      },
    ])
    .png()
    .toFile(path.join(publicDir, 'pwa-maskable-512x512.png'));
  console.log('✓ Generated pwa-maskable-512x512.png (512x512 with safe padding)');

  // 6. Favicon PNGs
  await sharp(svgBuffer)
    .resize(32, 32, { fit: 'contain' })
    .png()
    .toFile(path.join(publicDir, 'favicon-32x32.png'));

  await sharp(svgBuffer)
    .resize(16, 16, { fit: 'contain' })
    .png()
    .toFile(path.join(publicDir, 'favicon-16x16.png'));
  console.log('✓ Generated favicons (32x32, 16x16)');

  console.log('All icons successfully created in /public!');
}

generateIcons().catch((err) => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
