import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  enqueueProjectSave,
  waitForQueueIdle,
  resetProjectWriteQueueForTest,
} from '../projectStorageQueue';
import * as db from '../db';
import { StoryProject } from '../../types';

vi.mock('../db', () => ({
  saveProjectToDB: vi.fn(),
  waitForProjectWrites: vi.fn(async () => {}),
  resetProjectWriteChainsForTest: vi.fn(),
}));

describe('projectStorageQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetProjectWriteQueueForTest();
  });

  const createDummyProject = (id: string, title: string): StoryProject => ({
    id,
    title,
    author: 'Author',
    genre: 'Tiên Hiệp',
    tone: 'Cổ phong',
    description: 'Description',
    glossary: [],
    pendingGlossary: [],
    chapters: [],
    createdAt: new Date().toISOString(),
  });

  it('delegates enqueueProjectSave directly to saveProjectToDB', async () => {
    vi.mocked(db.saveProjectToDB).mockResolvedValue(undefined);

    const p1 = createDummyProject('proj_1', 'P1');
    const promise = enqueueProjectSave(p1);
    
    expect(db.saveProjectToDB).toHaveBeenCalledWith(p1);
    expect(db.saveProjectToDB).toHaveBeenCalledTimes(1);
    await promise;
  });

  it('does not crash if saveProjectToDB rejects and waitForQueueIdle handles it gracefully', async () => {
    vi.mocked(db.saveProjectToDB).mockRejectedValue(new Error('Simulated DB error'));

    const pFaulty = createDummyProject('p2', 'FAULTY');
    
    // The returned promise rejects
    await expect(enqueueProjectSave(pFaulty)).rejects.toThrow('Simulated DB error');
    
    // But waitForQueueIdle still resolves gracefully
    await expect(waitForQueueIdle()).resolves.toBeUndefined();
    expect(db.waitForProjectWrites).toHaveBeenCalled();
  });

  it('waitForQueueIdle delegates to waitForProjectWrites', async () => {
    vi.mocked(db.waitForProjectWrites).mockResolvedValue(undefined);

    await waitForQueueIdle('proj_1');
    expect(db.waitForProjectWrites).toHaveBeenCalledWith('proj_1');
  });

  it('resetProjectWriteQueueForTest delegates to resetProjectWriteChainsForTest', () => {
    resetProjectWriteQueueForTest();
    expect(db.resetProjectWriteChainsForTest).toHaveBeenCalled();
  });
});
