import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const blog = defineCollection({
	// Load Markdown and MDX files in the `src/content/blog/` directory.
	loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
	// Type-check frontmatter using a schema
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			description: z.string().optional(),
			// Transform string to Date object
			date: z.coerce.date(),
			tags: z.array(z.string()).optional(),
			categories: z.array(z.string()).optional(),
			draft: z.boolean().optional(),
			updatedDate: z.coerce.date().optional(),
			heroImage: z.optional(image()),
		}),
});

const papers = defineCollection({
	loader: glob({ base: './src/content/papers', pattern: '**/*.{md,mdx}' }),
	schema: z.object({
		title: z.string(),
		url: z.string().url().optional(),
		date: z.coerce.date().optional(),
		tags: z.array(z.string()).optional(),
		categories: z.array(z.string()).optional(),
	}),
});

const certifications = defineCollection({
	loader: glob({ base: './src/content/certifications', pattern: '**/*.{md,mdx}' }),
	schema: ({ image }) => z.object({
		title: z.string(),
		issuer: z.string(),
		url: z.string().url().optional(),
		date: z.coerce.date().optional(),
		thumbnail: z.optional(image()),
		thumbnailUrl: z.string().url().optional(),
	}),
});

const goodies = defineCollection({
	loader: glob({ base: './src/content/goodies', pattern: '**/*.{md,mdx}' }),
	schema: z.object({
		title: z.string(),
		description: z.string(),
		icon: z.string().optional(),
		href: z.string(),
		date: z.coerce.date().optional(),
	}),
});

export const collections = { blog, papers, certifications, goodies };
