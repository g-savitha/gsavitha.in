import fs from 'fs';
import path from 'path';

const type = process.argv[2]; // 'blog' or 'paper'
const name = process.argv[3];

if (!type || !name) {
  console.log('Usage: bun run new <blog|paper> <filename-without-ext>');
  process.exit(1);
}

const slug = name.replace(/\.md$/i, '');
const date = new Date();
const isoString = date.toISOString();
const shortDate = isoString.split('T')[0];

function titleFromSlug(value) {
  return value
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

const folder = type === 'blog' ? 'blog' : 'papers';
const filename = slug.endsWith('.md') ? slug : `${slug}.md`;
const filePath = path.join(process.cwd(), 'src/content', folder, filename);

if (fs.existsSync(filePath)) {
  console.error(`Error: File already exists at ${filePath}`);
  process.exit(1);
}

const templates = {
  blog: `---
title: "${titleFromSlug(slug)}"
date: ${isoString}
draft: false
heroImage: "../../assets/${slug}.png"
audio:
  enabled: true
  voice: af_heart
  codeSummaryMode: contextual
hideToc: false
enableToc: true
enableTocContent: true
pinned: false
tags: []
categories: []
---

`,
  paper: `---
title: "${titleFromSlug(slug)}"
url: ""
date: ${shortDate}
---

`,
};

const template = templates[type === 'blog' ? 'blog' : 'paper'];

fs.mkdirSync(path.dirname(filePath), { recursive: true });
fs.writeFileSync(filePath, template);
console.log(`\x1b[32m✔ Created ${type} content at ${filePath}\x1b[0m`);
