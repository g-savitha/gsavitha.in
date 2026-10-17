import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';
import { themeCssPlugin } from './src/theme/vitePlugin.ts';
import { buildEnvGuard } from './src/env/buildEnvGuard.ts';
import { rehypePlugins, remarkPlugins } from './src/utils/markdownPlugins.ts';

// https://astro.build/config
export default defineConfig({
  site: 'https://gsavitha.in',
  base: '/',
  integrations: [buildEnvGuard(), mdx(), sitemap(), react()],
  markdown: {
    remarkPlugins,
    rehypePlugins,
    shikiConfig: {
      theme: 'github-dark',
    },
  },

  vite: {
    plugins: [themeCssPlugin(), tailwindcss()],
    optimizeDeps: {
      exclude: ['lucide-astro'],
    },
  },
});
