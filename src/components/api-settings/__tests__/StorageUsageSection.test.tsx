import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { StorageUsageSection } from '../StorageUsageSection';
import * as db from '../../../services/db';

describe('StorageUsageSection Component Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exports valid StorageUsageSection component function', () => {
    expect(typeof StorageUsageSection).toBe('function');
  });

  it('returns empty string on initial render when estimate is null (preventing 0% flash)', () => {
    vi.spyOn(db, 'estimateStorageUsage').mockResolvedValue(null);

    const html = renderToString(<StorageUsageSection />);
    expect(html).toBe('');
  });

  it('gracefully renders nothing when storage estimation is unsupported', () => {
    vi.spyOn(db, 'estimateStorageUsage').mockResolvedValue(null);

    const html = renderToString(<StorageUsageSection />);
    expect(html).toBe('');
  });
});
