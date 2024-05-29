/* eslint-disable no-underscore-dangle */
/* eslint-disable no-console */
import { readdir, readFile, writeFile } from 'node:fs';
import { join, basename, dirname } from 'node:path';
import { fileURLToPath } from 'url';
import { translate } from '@vitalets/google-translate-api'; // or any other translation library

const __dirname = dirname(fileURLToPath(import.meta.url));
const i18nDir = join(__dirname, 'src', 'i18n');

readdir(i18nDir, (err, files) => {
  if (err) {
    console.error(err);
    return;
  }

  files.forEach((file) => {
    const filePath = join(i18nDir, file);
    let lang = basename(file, '.json'); // assumes file names are like 'en.json', 'es.json', etc.
    if (lang === 'ch') {
      lang = 'tk';
    }

    readFile(filePath, 'utf8', (error, data) => {
      if (error) {
        console.error(error);
        return;
      }

      const json = JSON.parse(data);

      // Add your key-value pair here
      const key = process.argv[2];
      const value = process.argv[3];

      translate(value, { to: lang })
        .then((res) => {
          json[key] = lang === 'en' ? value : res.text;

          writeFile(filePath, JSON.stringify(json, null, 2), 'utf8', (e) => {
            if (e) {
              console.error(e);
            }
          });
        })
        .catch((e) => {
          console.error(e);
        });
    });
  });
});
