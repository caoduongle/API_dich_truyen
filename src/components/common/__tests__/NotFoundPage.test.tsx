import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { NotFoundPage } from '../NotFoundPage';

describe('NotFoundPage Component Suite', () => {
  it('exports valid React NotFoundPage component', () => {
    expect(typeof NotFoundPage).toBe('function');
  });

  it('renders default classical message and 404 structure', () => {
    const element = NotFoundPage({}) as React.ReactElement<{ className: string }>;
    expect(element).not.toBeNull();
    expect(element.type).toBe('div');
    expect(element.props.className).toContain('min-h-[60vh]');
  });

  it('renders custom message when provided', () => {
    const customMsg = 'Bản thảo thất lạc trong hư không';
    const element = NotFoundPage({ message: customMsg });
    expect(element).not.toBeNull();
  });

  it('accepts onGoHome callback without crashing', () => {
    const onGoHomeMock = vi.fn();
    const element = NotFoundPage({ onGoHome: onGoHomeMock });
    expect(element).not.toBeNull();
  });
});

