import { useMemo, useState, type ReactNode } from 'react';
import { ChevronRight, ExternalLink, Search } from 'lucide-react';

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

export default function SearchableList({ title, items, itemLabel, children }: SearchableListProps) {
  const [term, setTerm] = useState('');

  const filteredItems = useMemo(() => {
    const query = term.trim().toLowerCase();
    if (!query) return items;
    return items.filter((item) => itemMatchesQuery(item, query));
  }, [items, term]);

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">{title}</h1>
        {children}
        <div className="relative max-w-sm">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-zinc-400" aria-hidden="true" />
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

      <ul className="list-rows">
        {filteredItems.map((item) => (
          <li key={item.href} className="list-row">
            <a
              href={item.href}
              target={item.external ? '_blank' : undefined}
              rel={item.external ? 'noopener noreferrer' : undefined}
              className="list-row__link"
            >
              <span className="list-row__date list-row__date--offset">
                {item.date ? <time dateTime={item.date}>{formatDate(item.date)}</time> : 'Recent'}
              </span>
              <div className="list-row__body">
                <span className="list-row__title">{highlightTitle(item.title, term.trim())}</span>
                {item.description && <p className="list-row__description">{item.description}</p>}
              </div>
              <div className="list-row__chevron">
                {item.external ? (
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <ChevronRight className="h-5 w-5" aria-hidden="true" />
                )}
              </div>
            </a>
          </li>
        ))}
      </ul>
    </>
  );
}
