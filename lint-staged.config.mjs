/* eslint-disable no-restricted-syntax */

// const prefix = '/Users/intizar/Intizar/xmobile-v1/';

export default () => {
  // for (const file of allStagedFiles) {
  //   if (
  //     file.endsWith('.ts') ||
  //     file.endsWith('.tsx') ||
  //     file.endsWith('.sql') ||
  //     file.includes('tsconfig.json') ||
  //     file.includes('schema.prisma') ||
  //     file.includes('next.config')
  //   ) {
  //     const relativePath = file.slice(prefix.length);
  //     const scpCommand = `scp -i ~/.ssh/xmobile -P 2222 ${relativePath} ubuntu@216.250.13.115:/home/ubuntu/xmobile-v1/${relativePath}`;
  //     execSync(scpCommand, (error, _, stderr) => {
  //       if (error) {
  //         console.error(`Error executing SCP: ${error.message}`);
  //         return;
  //       }
  //       if (stderr) {
  //         console.error(`SCP stderr: ${stderr}`);
  //       }
  //     });
  //     console.info(`Copied ${relativePath} to production\n`);
  //   }
  // }

  return [
    'eslint --fix .',
    'npx prettier --write --ignore-unknown .',
    'npx tsc --noEmit --pretty -p tsconfig.json',
  ];
};
