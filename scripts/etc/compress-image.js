const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const IMAGE_COMPRESSION_QUALITY = 5;
const productionImgsPath = 'images';
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

  imgNames.forEach((imgName) => {
    const imgPath = path.join(productImgsPath, imgName);

    if (fs.readFileSync(imgPath)) {
      const img = fs.readFileSync(imgPath);

      if (img.length > 100 * 1024) {
        // don't compress images under 100KB
        const outputPath = compressedImgsPath + imgName;
        sharp(img)
          .png({ quality: IMAGE_COMPRESSION_QUALITY })
          .toFile(outputPath); // reduce quality to 5% of original image

        // console.log('Compressing..: ' + outputPath);
      }
    } else console.error('Incorrect path!: ', imgPath);
  });
}
