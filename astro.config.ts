import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';
import { rehypePlugins, remarkPlugins } from './src/utils/markdownPlugins.ts';

// https://astro.build/config
export default defineConfig({
  site: 'https://gsavitha.in',
  base: '/',
  integrations: [mdx(), sitemap(), react()],
  markdown: {
    remarkPlugins,
    rehypePlugins,
    shikiConfig: {
      theme: 'github-dark',
    },
  },

  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      exclude: ['lucide-astro'],
    },
  },
});
