module.exports = {
  '**/*.(ts|tsx)': () => 'npx tsc --noEmit --pretty -p tsconfig.json',

  // Lint & Prettify TS and JS files
  '**/*.(ts|tsx|js)': [
    'eslint --fix ./ --quiet',
    'npx prettier --write --ignore-unknown .',
  ],

  // Prettify only Markdown and JSON files
  '**/*.(md|json)': 'npx prettier --write --ignore-unknown .',
};
