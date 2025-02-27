import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export const IMG_COMPRESSION_MIN_QUALITY = 20; // %
export const IMG_COMPRESSION_MAX_QUALITY = 90; // %
export const IMG_COMPRESSION_OPTIONS = {
  bad: {
    width: 600, // px
    size: 50 * 1024, // KB
  },
  good: {
    size: 150 * 1024, // KB
    width: 0, // no change in width
  },
};

const dirname = path.dirname(fileURLToPath(import.meta.url))

const productionImgsPath = '/home/ubuntu/images';
const localImgsPath = `${dirname}/../../src/db/images`;

const compressedImgsPath = fs.existsSync(productionImgsPath)
  ? `${productionImgsPath}/compressed/products/`
  : `${localImgsPath}/compressed/products/`;
const productImgsPath = fs.existsSync(productionImgsPath)
  ? `${productionImgsPath}/products/`
  : `${localImgsPath}/products/`;

if (!fs.existsSync(compressedImgsPath)) {
  fs.mkdirSync(compressedImgsPath + 'bad/', { recursive: true });
  fs.mkdirSync(compressedImgsPath + 'good/', { recursive: true });
} 

const createCompressedImg = async (imgName, type) => {
  const imgUrl = path.join(productImgsPath, imgName);

  if (fs.existsSync(imgUrl)) {
    const img = fs.readFileSync(imgUrl);
    
    let compressedImg = img;
    const targetUrl = `${compressedImgsPath}${type}/${imgName}`;
    const targetSize = IMG_COMPRESSION_OPTIONS[type].size;
    const targetWidth = IMG_COMPRESSION_OPTIONS[type].width === 0 ? null : IMG_COMPRESSION_OPTIONS[type].width;
    let quality = IMG_COMPRESSION_MAX_QUALITY;

    while (
      compressedImg.length > targetSize &&
      quality > IMG_COMPRESSION_MIN_QUALITY
    ) {
      compressedImg = await sharp(img)
        .resize({ width: targetWidth })
        .jpeg({ quality: quality, progressive: true })
        .toBuffer();
      quality -= 10;
    }
    fs.writeFileSync(targetUrl, new Uint8Array(compressedImg));
  } else console.error('Incorrect url!: ', imgUrl);
}

if (fs.existsSync(productImgsPath)) {
  const imgNames = fs.readdirSync(productImgsPath);

  imgNames.forEach(async (imgName) => {
    await createCompressedImg (imgName, 'bad');
    await createCompressedImg (imgName, 'good');

  });
} else {
  console.error(productImgsPath, ' not found');
}
