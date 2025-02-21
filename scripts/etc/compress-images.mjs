import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';


const IMG_COMPRESSION_QUALITY = 40; // compression in JPEG to 40% 
const IMG_COMPRESSION_WIDTH = 300;
const dirname = path.dirname(fileURLToPath(import.meta.url))

const productionImgsPath = '/home/ubuntu/images';
const localImgsPath = `${dirname}/../../src/db/images`;

const compressedImgsPath = fs.existsSync(productionImgsPath)
  ? `${productionImgsPath}/compressed/products/`
  : `${localImgsPath}/compressed/products/`;
const productImgsPath = fs.existsSync(productionImgsPath)
  ? `${productionImgsPath}/products/`
  : `${localImgsPath}/products/`;

if (!fs.existsSync(compressedImgsPath)) fs.mkdirSync(compressedImgsPath, { recursive: true });

if (fs.existsSync(productImgsPath)) {
  const imgNames = fs.readdirSync(productImgsPath);

  imgNames.forEach(async (imgName) => {
    const imgPath = path.join(productImgsPath, imgName);

    if (fs.readFileSync(imgPath)) {
      const img = fs.readFileSync(imgPath);
      const outputPath = compressedImgsPath + imgName;
      let compressedImg = img;
      let quality = 90; // start compressing from 90% upto 40% (IMAGE_COMPRESSION_QUALITY)

      while (
        compressedImg.length > 15 * 1024  && 
        quality > IMG_COMPRESSION_QUALITY
      ) {
        // max compression around 100KB
        try {
          compressedImg = await sharp(compressedImg).resize({ width: IMG_COMPRESSION_WIDTH }).jpeg({ quality }).toBuffer();
          quality -= 10;
        } catch (error) {
          console.error('failed to compress: ', outputPath);
        }
      }
      fs.writeFileSync(outputPath, compressedImg);
    } else console.error('Incorrect path!: ', imgPath);
  });
} else {
  console.error(productImgsPath, ' not found');
}
