import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';
import remarkGemoji from 'remark-gemoji';
import { remarkMermaid } from './remark-mermaid.ts';

import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  site: 'https://gsavitha.in',
  base: '/',
  integrations: [mdx(), sitemap(), react()],
  markdown: {
    remarkPlugins: [remarkGemoji, remarkMermaid],
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
