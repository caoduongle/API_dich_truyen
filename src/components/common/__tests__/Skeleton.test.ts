import React from 'react';
import { describe, it, expect } from 'vitest';
import {
  SkeletonBlock,
  SkeletonProjectCard,
  SkeletonChapterRow,
  SkeletonGlossaryRow,
  TabSkeleton,
} from '../Skeleton';

describe('Skeleton Components', () => {
  it('exports valid React skeleton components', () => {
    expect(typeof SkeletonBlock).toBe('function');
    expect(typeof SkeletonProjectCard).toBe('function');
    expect(typeof SkeletonChapterRow).toBe('function');
    expect(typeof SkeletonGlossaryRow).toBe('function');
    expect(typeof TabSkeleton).toBe('function');
  });

  it('instantiates SkeletonBlock properly with default and custom classes', () => {
    const defaultBlock = SkeletonBlock({});
    expect(defaultBlock.props.className).toContain('animate-pulse');

    const customBlock = SkeletonBlock({ className: 'h-6 w-32' });
    expect(customBlock.props.className).toContain('h-6 w-32');
  });

  it('instantiates TabSkeleton with custom title', () => {
    const tab = TabSkeleton({ title: 'Đang tải dự án...' });
    expect(tab).not.toBeNull();
  });
});
