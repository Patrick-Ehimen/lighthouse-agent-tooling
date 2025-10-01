export default {
  "**/*.{js,jsx,ts,tsx,json,md,css,scss,yml,yaml}": ["prettier --write", "pnpm dlx eslint@9 --fix"],
};
