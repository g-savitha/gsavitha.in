import { useMemo, useState, type ReactNode } from 'react';

export interface SearchableItem {
  title: string;
  href: string;
  date?: string;
  description?: string;
  tags?: string[];
  categories?: string[];
  external?: boolean;
}

function itemMatchesQuery(item: SearchableItem, query: string) {
  if (item.title.toLowerCase().includes(query)) return true;
  if (item.tags?.some((tag) => tag.toLowerCase().includes(query))) return true;
  if (item.categories?.some((category) => category.toLowerCase().includes(query))) {
    return true;
  }
  return false;
}

interface SearchableListProps {
  title: string;
  items: SearchableItem[];
  itemLabel: string;
  children?: ReactNode;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-us', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function highlightTitle(title: string, term: string) {
  if (!term) return title;

  const lowerTitle = title.toLowerCase();
  const lowerTerm = term.toLowerCase();
  const index = lowerTitle.indexOf(lowerTerm);
  if (index === -1) return title;

  return (
    <>
      {title.slice(0, index)}
      <mark className="bg-primary text-zinc-900 rounded-[3px] px-1">
        {title.slice(index, index + term.length)}
      </mark>
      {title.slice(index + term.length)}
    </>
  );
}

function ChevronIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="w-5 h-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function ExternalLinkIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="w-4 h-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

export default function SearchableList({ title, items, itemLabel, children }: SearchableListProps) {
  const [term, setTerm] = useState('');

  const filteredItems = useMemo(() => {
    const query = term.trim().toLowerCase();
    if (!query) return items;
    return items.filter((item) => itemMatchesQuery(item, query));
  }, [items, term]);

  return (
    <>
      <div className="mb-12 border-b border-zinc-800/80 pb-8">
        <h1 className="text-4xl sm:text-[2.75rem] font-bold tracking-tight text-white mb-4">
          {title}
        </h1>
        {children}
        <div className="relative max-w-sm">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <span className="text-zinc-400">🔍</span>
          </div>
          <input
            type="text"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder={`Search ${items.length} ${itemLabel} by title, tag, or category...`}
            autoComplete="off"
            className="block w-full pl-10 pr-3 py-2.5 border border-zinc-700/80 rounded-xl leading-5 bg-zinc-900/50 text-zinc-300 placeholder-zinc-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all sm:text-base"
          />
        </div>
      </div>

      <ul className="flex flex-col">
        {filteredItems.map((item) => (
          <li key={item.href} className="border-b border-zinc-800/80 last:border-0">
            <a
              href={item.href}
              target={item.external ? '_blank' : undefined}
              rel={item.external ? 'noopener noreferrer' : undefined}
              className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 py-3 -mx-3 px-3 rounded-xl hover-lift group font-outfit"
            >
              <span className="text-zinc-400 group-hover:text-zinc-200 text-base shrink-0 w-32 mt-1 sm:mt-0 transition-colors">
                {item.date ? <time dateTime={item.date}>{formatDate(item.date)}</time> : 'Recent'}
              </span>
              <div className="flex-1">
                <span className="text-primary group-hover:text-primary-hover font-medium font-outfit transition-colors text-xl mb-2 block">
                  {highlightTitle(item.title, term.trim())}
                </span>
                {item.description && (
                  <p className="text-zinc-400 group-hover:text-zinc-300 text-base line-clamp-2 leading-relaxed max-w-2xl transition-colors">
                    {item.description}
                  </p>
                )}
              </div>
              <div className="hidden sm:flex text-zinc-500 opacity-0 group-hover:opacity-100 transition-all duration-300 shrink-0 transform translate-x-[-10px] group-hover:translate-x-0 items-center justify-center">
                {item.external ? <ExternalLinkIcon /> : <ChevronIcon />}
              </div>
            </a>
          </li>
        ))}
      </ul>
    </>
  );
}
