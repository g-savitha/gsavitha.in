import fs from 'fs';
import path from 'path';

const type = process.argv[2]; // 'blog' or 'paper'
const name = process.argv[3];

if (!type || !name) {
  console.log('Usage: bun run new <blog|paper> <filename-without-ext>');
  process.exit(1);
}

const date = new Date();
const isoString = date.toISOString();
const shortDate = isoString.split('T')[0];
// Format for blog: 2023-04-01T22:07:21+05:30 (approximate match)
const fullDate = isoString;

const folder = type === 'blog' ? 'blog' : 'papers';
const filename = name.endsWith('.md') ? name : `${name}.md`;
const filePath = path.join(process.cwd(), 'src/content', folder, filename);

if (fs.existsSync(filePath)) {
  console.error(`Error: File already exists at ${filePath}`);
  process.exit(1);
}

const templates = {
  blog: `---
title: "${name.replace(/-/g, ' ')}"
date: ${fullDate}
draft: false
heroImage: ""
tags: []
categories: []
---

`,
  paper: `---
title: "${name.replace(/-/g, ' ')}"
url: ""
date: ${shortDate}
---

`,
};

const template = templates[type === 'blog' ? 'blog' : 'paper'];

// Ensure directory exists
fs.mkdirSync(path.dirname(filePath), { recursive: true });

fs.writeFileSync(filePath, template);
console.log(`\x1b[32m✔ Created ${type} content at ${filePath}\x1b[0m`);
