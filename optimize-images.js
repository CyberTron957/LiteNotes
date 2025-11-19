const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function optimizeImages() {
    const imagesDir = path.join(__dirname, 'src', 'images');
    const outputDir = path.join(__dirname, 'public', 'optimized');

    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    // Optimize blue_icon.png (favicon)
    console.log('Optimizing blue_icon.png...');
    await sharp(path.join(imagesDir, 'blue_icon.png'))
        .resize(192, 192, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .webp({ quality: 85 })
        .toFile(path.join(outputDir, 'icon-192.webp'));

    await sharp(path.join(imagesDir, 'blue_icon.png'))
        .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .webp({ quality: 85 })
        .toFile(path.join(outputDir, 'icon-512.webp'));

    // Also create optimized PNG for browsers without WebP support
    await sharp(path.join(imagesDir, 'blue_icon.png'))
        .resize(192, 192, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png({ quality: 80, compressionLevel: 9 })
        .toFile(path.join(outputDir, 'icon-192.png'));

    console.log('Images optimized successfully!');
    console.log('Output directory:', outputDir);
}

optimizeImages().catch(console.error);
