import { getCollection } from 'astro:content';
import rss from '@astrojs/rss';
import { SITE_DESCRIPTION, SITE_TITLE } from '../consts';

export async function GET(context) {
	const posts = await getCollection('blog', ({ data }) => import.meta.env.PROD ? data.draft !== true : true);
	const items = posts
		.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf())
		.map((post) => ({
			title: post.data.title,
			description: post.data.description,
			pubDate: post.data.date,
			categories: post.data.categories,
			link: `/blog/${post.id}/`,
		}));

	return rss({
		title: SITE_TITLE,
		description: SITE_DESCRIPTION,
		site: context.site,
		items,
	});
}
