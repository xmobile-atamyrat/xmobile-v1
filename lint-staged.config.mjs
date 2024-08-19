/* eslint-disable no-restricted-syntax */
import { execSync } from 'child_process';

const prefix = '/Users/intizar/Intizar/xmobile-v1/';

export default (allStagedFiles) => {
  for (const file of allStagedFiles) {
    if (file.startsWith(prefix)) {
      const relativePath = file.slice(prefix.length);
      const scpCommand = `scp -i ~/.ssh/xmobile -P 2222 ${relativePath} ubuntu@216.250.13.115:/home/ubuntu/xmobile-v1/${relativePath}`;
      execSync(scpCommand, (error, _, stderr) => {
        if (error) {
          console.error(`Error executing SCP: ${error.message}`);
          return;
        }
        if (stderr) {
          console.error(`SCP stderr: ${stderr}`);
        }
      });
      console.info(`Copied ${relativePath} to production\n`);
    }
  }

  return [
    'eslint --fix .',
    'npx prettier --write --ignore-unknown .',
    'npx tsc --noEmit --pretty -p tsconfig.json',
  ];
};

// module.exports = {
//   '**/*.(ts|tsx)': () => 'npx tsc --noEmit --pretty -p tsconfig.json',

//   // Lint & Prettify TS and JS files
//   '**/*.(ts|tsx|js)': [
//     'eslint --fix ./ --quiet',
//     'npx prettier --write --ignore-unknown .',
//   ],

//   // Prettify only Markdown and JSON files
//   '**/*.(md|json)': 'npx prettier --write --ignore-unknown .',
// };
