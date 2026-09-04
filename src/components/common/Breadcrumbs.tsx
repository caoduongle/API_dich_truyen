import React from 'react';
import { Home, ChevronRight } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
  current?: boolean;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

/**
 * Thanh điều hướng phân cấp Breadcrumb ngữ nghĩa kèm Microdata Schema.org
 */
export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ items, className = '' }) => {
  return (
    <nav aria-label="Breadcrumb" className={`py-1.5 text-xs font-serif text-text-muted ${className}`}>
      <ol
        className="flex items-center gap-1.5 flex-wrap"
        itemScope
        itemType="https://schema.org/BreadcrumbList"
      >
        <li
          className="flex items-center gap-1"
          itemProp="itemListElement"
          itemScope
          itemType="https://schema.org/ListItem"
        >
          <span className="flex items-center gap-1 text-polish font-medium">
            <Home className="w-3.5 h-3.5 shrink-0" />
            <span itemProp="name">Trang Chủ</span>
          </span>
          <meta itemProp="position" content="1" />
        </li>

        {items.map((item, index) => {
          const position = index + 2;
          return (
            <li
              key={`${item.label}-${index}`}
              className="flex items-center gap-1.5"
              itemProp="itemListElement"
              itemScope
              itemType="https://schema.org/ListItem"
            >
              <ChevronRight className="w-3 h-3 text-parchment-2 shrink-0" />
              {item.current ? (
                <span
                  className="font-medium text-text-main truncate max-w-[200px]"
                  aria-current="page"
                  itemProp="name"
                >
                  {item.label}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={item.onClick}
                  className="hover:text-text-main hover:underline truncate max-w-[160px] cursor-pointer focus:outline-none"
                  itemProp="name"
                >
                  {item.label}
                </button>
              )}
              <meta itemProp="position" content={String(position)} />
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

export default Breadcrumbs;

