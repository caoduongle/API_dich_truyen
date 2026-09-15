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

  it('executes queued saves in strict FIFO sequential order', async () => {
    const executionOrder: string[] = [];

    vi.mocked(db.saveProjectToDB).mockImplementation(async (project: StoryProject) => {
      // Simulate variable network / I/O latency (earlier write takes longer than later write)
      const delay = project.title === 'P1' ? 40 : 10;
      await new Promise((r) => setTimeout(r, delay));
      executionOrder.push(project.title);
    });

    const p1 = createDummyProject('proj_1', 'P1');
    const p2 = createDummyProject('proj_1', 'P2');
    const p3 = createDummyProject('proj_1', 'P3');

    // Enqueue in rapid succession without awaiting
    const promise1 = enqueueProjectSave(p1);
    const promise2 = enqueueProjectSave(p2);
    const promise3 = enqueueProjectSave(p3);

    await Promise.all([promise1, promise2, promise3]);

    // Execution must strictly follow FIFO queue order: P1, then P2, then P3
    expect(executionOrder).toEqual(['P1', 'P2', 'P3']);
    expect(db.saveProjectToDB).toHaveBeenCalledTimes(3);
  });

  it('does not break subsequent writes if a prior write encounters an error', async () => {
    const executionOrder: string[] = [];

    vi.mocked(db.saveProjectToDB).mockImplementation(async (project: StoryProject) => {
      if (project.title === 'FAULTY') {
        throw new Error('Disk quota exceeded or database locked');
      }
      executionOrder.push(project.title);
    });

    const p1 = createDummyProject('p1', 'FIRST');
    const pFaulty = createDummyProject('p2', 'FAULTY');
    const p3 = createDummyProject('p3', 'THIRD');

    enqueueProjectSave(p1);
    enqueueProjectSave(pFaulty);
    const lastPromise = enqueueProjectSave(p3);

    await lastPromise;

    // FIRST and THIRD must succeed even though FAULTY failed
    expect(executionOrder).toEqual(['FIRST', 'THIRD']);
    expect(db.saveProjectToDB).toHaveBeenCalledTimes(3);
  });

  it('waitForQueueIdle resolves when all in-flight and queued saves are complete', async () => {
    let completed = false;

    vi.mocked(db.saveProjectToDB).mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 25));
      completed = true;
    });

    enqueueProjectSave(createDummyProject('p', 'Async Project'));
    expect(completed).toBe(false);

    await waitForQueueIdle();
    expect(completed).toBe(true);
  });
});
