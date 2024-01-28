/** @type {import("prettier").Config} */
export default {
  plugins: ["prettier-plugin-astro"],
  overrides: [
    {
      files: "*.astro",
      options: {
        parser: "astro",
      },
    },
  ],
  arrowParens: "always",
  bracketSpacing: true,
  printWidth: 80,
  proseWrap: "preserve",
  quoteProps: "as-needed",
  semi: false,
  singleQuote: true,
  tabWidth: 2,
  trailingComma: "es5",
  useTabs: false,
  jsxBracketSameLine: false,
  jsxSingleQuote: false,
};
