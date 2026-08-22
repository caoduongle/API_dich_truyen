import { describe, it, expect } from 'vitest';
import { useDropdownPosition } from '../useDropdownPosition';

describe('useDropdownPosition hook', () => {
  it('exports valid useDropdownPosition function', () => {
    expect(typeof useDropdownPosition).toBe('function');
  });
});
