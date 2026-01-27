const sharp = require('sharp');

const imagePath =
  '/Users/intizar/Intizar/xmobile-v1/public/logo/xmobile-original-logo.jpeg';

async function processImage() {
  try {
    const image = sharp(imagePath);
    const metadata = await image.metadata();
    const resizedImageBuffer = await image.resize(10, 10).toBuffer();
    const base64Image = resizedImageBuffer.toString('base64');
    const mimeType = metadata.format
      ? `image/${metadata.format}`
      : 'image/jpeg'; // Default to JPEG if format is unknown
    const dataUrl = `data:${mimeType};base64,${base64Image}`;
    return dataUrl;
  } catch (error) {
    console.error('Error processing image:', error);
    return null;
  }
}

// Absolute path to the image

processImage(imagePath).then((dataUrl) => {
  if (dataUrl) {
    console.info('Data URL:', dataUrl);
  }
});
