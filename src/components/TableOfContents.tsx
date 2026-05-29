import { useEffect, useState, useRef } from 'react';
import ErrorBoundary from './ErrorBoundary';

interface Heading {
  depth: number;
  slug: string;
  text: string;
}

interface Props {
  headings: Heading[];
  isMobile?: boolean;
}

/**
 * TableOfContents component renders a list of headings that highlights the current section
 * as the user scrolls. It supports both desktop and mobile views.
 */
function TableOfContentsInner({ headings, isMobile = false }: Props) {
  const [activeId, setActiveId] = useState<string>('');
  const [open, setOpen] = useState(false);
  const headingElementsRef = useRef<{ [key: string]: IntersectionObserverEntry }>({});

  if (!headings || headings.length === 0) return null;

  // Show only h2 and h3
  const toc = headings.filter((h) => h.depth <= 3);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          headingElementsRef.current[entry.target.id] = entry;
        });

        const visibleHeadings = Object.values(headingElementsRef.current).filter(
          (entry) => entry.isIntersecting
        );

        if (visibleHeadings.length > 0) {
          visibleHeadings.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
          setActiveId(visibleHeadings[0].target.id);
        }
      },
      { rootMargin: '0px 0px -70% 0px', threshold: 0 }
    );

    toc.forEach((h) => {
      const element = document.getElementById(h.slug);
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, [toc]);

  const list = (
    <ul className="space-y-[0.65rem] text-base font-medium font-outfit text-zinc-400 border-l-[3px] border-zinc-800/60 transition-colors">
      {toc.map((heading) => {
        const isActive = activeId === heading.slug;
        return (
          <li key={heading.slug} className={heading.depth === 3 ? 'pl-6' : 'pl-4'}>
            <a
              href={`#${heading.slug}`}
              onClick={() => isMobile && setOpen(false)}
              className={`block line-clamp-2 leading-snug rounded-lg py-1 px-2 -ml-1 hover-lift ${isActive ? 'text-primary bg-primary/10' : 'hover:text-primary/90'}`}
            >
              {heading.text}
            </a>
          </li>
        );
      })}
    </ul>
  );

  if (isMobile) {
    return (
      <nav>
        <button
          onClick={() => setOpen((v) => !v)}
          className={`w-full flex items-center justify-between text-left text-base font-bold py-1 focus:outline-none transition-colors font-outfit ${open ? 'text-primary' : 'text-white hover:text-primary'}`}
          aria-expanded={open}
        >
          <span>What&apos;s on this page</span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`w-4 h-4 transition-transform duration-200 ${open ? 'rotate-180 text-primary' : 'text-zinc-400'}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {open && <div className="mt-4">{list}</div>}
      </nav>
    );
  }

  return (
    <nav>
      <h3 className="text-lg font-bold font-outfit text-white mb-4 tracking-tight">Table of Contents</h3>
      {list}
    </nav>
  );
}

export default function TableOfContents(props: Props) {
  return (
    <ErrorBoundary>
      <TableOfContentsInner {...props} />
    </ErrorBoundary>
  );
}

