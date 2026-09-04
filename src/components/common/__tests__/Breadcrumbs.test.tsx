import { describe, it, expect } from 'vitest';
import { Breadcrumbs } from '../Breadcrumbs';

describe('Breadcrumbs Component Suite', () => {
  it('exports valid Breadcrumbs component', () => {
    expect(typeof Breadcrumbs).toBe('function');
  });

  it('renders breadcrumb list elements with microdata properties', () => {
    const items = [
      { label: 'Dự án', onClick: () => {} },
      { label: 'Đấu Phá Thương Khung', current: true },
    ];

    const element = Breadcrumbs({ items }) as React.ReactElement<{ 'aria-label'?: string }>;
    expect(element).not.toBeNull();
    expect(element.type).toBe('nav');
    expect(element.props['aria-label']).toBe('Breadcrumb');
  });
});

