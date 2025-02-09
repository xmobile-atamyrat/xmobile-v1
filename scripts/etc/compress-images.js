const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const IMAGE_COMPRESSION_QUALITY = 40;
const productionImgsPath = '/home/ubuntu/images';
const localImgsPath = `${__dirname}/../../src/db/images`;

const compressedImgsPath = fs.existsSync(productionImgsPath)
  ? `${productionImgsPath}/compressed/`
  : `${localImgsPath}/compressed/`;
const productImgsPath = fs.existsSync(productionImgsPath)
  ? `${productionImgsPath}/products/`
  : `${localImgsPath}/products/`;

if (!fs.existsSync(compressedImgsPath)) fs.mkdirSync(compressedImgsPath);

if (fs.existsSync(productImgsPath)) {
  const imgNames = fs.readdirSync(productImgsPath);

  imgNames.forEach(async (imgName) => {
    const imgPath = path.join(productImgsPath, imgName);

    if (fs.readFileSync(imgPath)) {
      const img = fs.readFileSync(imgPath);
      const outputPath = compressedImgsPath + imgName;
      let compressedImg = img;
      let quality = 85; // start compressing from 85% upto 40% (IMAGE_COMPRESSION_QUALITY)

      while (
        compressedImg.length > 100 * 1024 &&
        quality > IMAGE_COMPRESSION_QUALITY
      ) {
        // max compression around 100KB
        try {
          compressedImg = await sharp(img).jpeg({ quality }).toBuffer();
          quality -= 10;
        } catch (error) {
          console.error('failed to compress: ', outputPath);
        }
      }
      fs.writeFileSync(outputPath, compressedImg);
    } else console.error('Incorrect path!: ', imgPath);
  });
}
