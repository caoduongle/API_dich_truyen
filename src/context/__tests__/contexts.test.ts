import React from 'react';
import { describe, it, expect } from 'vitest';
import { AIConfigProvider, useAIConfigContext } from '../AIConfigContext';
import { ProjectProvider, useProjectContext } from '../ProjectContext';

describe('Global React Contexts Architecture', () => {
  it('exports valid Provider React components', () => {
    expect(typeof AIConfigProvider).toBe('function');
    expect(typeof ProjectProvider).toBe('function');
  });

  it('exports valid hook consumers', () => {
    expect(typeof useAIConfigContext).toBe('function');
    expect(typeof useProjectContext).toBe('function');
  });
});
