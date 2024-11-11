export default {
  '*.{ts,tsx,js}': (stagedFiles) => [
    'eslint --fix .',
    `prettier --write --ignore-unknown ${stagedFiles.join(' ')}`,
    'tsc --noEmit --pretty -p tsconfig.json',
  ],
};
