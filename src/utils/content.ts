import { getCollection, type CollectionEntry } from 'astro:content';

/**
 * Filters out draft posts if in production mode.
 * @param posts Array of content collection entries.
 * @returns Filtered array of entries.
 */
export function filterDrafts<T extends { data: { draft?: boolean } }>(posts: T[]): T[] {
  return posts.filter((post) => (import.meta.env.PROD ? post.data.draft !== true : true));
}

/**
 * Sorts content entries by date in descending order.
 * @param entries Array of content collection entries with a date field.
 * @returns Sorted array of entries.
 */
export function sortByDate<T extends { data: { date?: Date } }>(entries: T[]): T[] {
  return [...entries].sort((a, b) => {
    const dateA = a.data.date?.valueOf() || 0;
    const dateB = b.data.date?.valueOf() || 0;
    return dateB - dateA;
  });
}

/**
 * Finds related blog posts based on tag and category similarity.
 * @param currentPost The post to find relations for.
 * @param allPosts The full collection of posts to search within.
 * @param limit Maximum number of related posts to return.
 * @returns Array of related post entries.
 */
export function getRelatedPosts(
  currentPost: CollectionEntry<'blog'>,
  allPosts: CollectionEntry<'blog'>[],
  limit = 5,
): CollectionEntry<'blog'>[] {
  const currentTags = currentPost.data.tags || [];
  const currentCats = currentPost.data.categories || [];

  return allPosts
    .filter((p) => p.id !== currentPost.id)
    .map((p) => {
      let score = 0;
      const pTags = p.data.tags || [];
      const pCats = p.data.categories || [];

      // Weights for matching
      currentCats.forEach((c) => {
        if (pCats.includes(c)) score += 100;
      });
      currentTags.forEach((t) => {
        if (pTags.includes(t)) score += 80;
      });

      return { post: p, score };
    })
    .filter((p) => p.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        (b.post.data.date?.valueOf() || 0) - (a.post.data.date?.valueOf() || 0),
    )
    .slice(0, limit)
    .map((p) => p.post);
}

/**
 * Gets the most recent posts, optionally excluding the current one.
 * @param posts Array of blog posts.
 * @param currentPostId Optional ID of the post to exclude.
 * @param limit Maximum number of posts to return.
 * @returns Array of recent post entries.
 */
export function getRecentPosts(
  posts: CollectionEntry<'blog'>[],
  currentPostId?: string,
  limit = 5,
): CollectionEntry<'blog'>[] {
  return sortByDate(posts.filter((p) => p.id !== currentPostId)).slice(0, limit);
}
