import { describe, it, expect } from 'vitest';
import { getLastSessionWeightAndReps, calculateSessionVolume } from '../../src/utils/weightHistory';
import type { TaskItem } from '../../src/models/Task';

describe('weightHistory', () => {
  const now = new Date('2026-10-30T10:00:00Z');
  const yesterday = new Date('2026-10-29T10:00:00Z');

  it('returns null if task has no weightLogs', () => {
    const task: TaskItem = { id: 't1', title: 'Press banca', status: 'pending' };
    expect(getLastSessionWeightAndReps(task, 1, now)).toBeNull();
  });

  it('returns previous session weight and reps for specific set', () => {
    const task: TaskItem = {
      id: 't1',
      title: 'Press banca',
      status: 'pending',
      weightLogs: [
        { set: 1, weightKg: 70, reps: 10, date: yesterday.toISOString() },
        { set: 2, weightKg: 75, reps: 8, date: yesterday.toISOString() },
      ]
    };

    const hint = getLastSessionWeightAndReps(task, 2, now);
    expect(hint).not.toBeNull();
    expect(hint?.weightKg).toBe(75);
    expect(hint?.reps).toBe(8);
    expect(hint?.isPreviousSession).toBe(true);
  });

  it('correctly calculates session volume in kg across multiple exercises', () => {
    const tasks: TaskItem[] = [
      {
        id: 't1',
        title: 'Press banca',
        status: 'pending',
        weightLogs: [
          { set: 1, weightKg: 70, reps: 10, date: now.toISOString() }, // 700 kg
          { set: 2, weightKg: 80, reps: 5, date: now.toISOString() },  // 400 kg
        ]
      },
      {
        id: 't2',
        title: 'Remo con barra',
        status: 'pending',
        weightLogs: [
          { set: 1, weightKg: 60, reps: 10, date: now.toISOString() }, // 600 kg
        ]
      },
      {
        id: 't_rest',
        title: 'Descanso entre ejercicios',
        isRest: true,
        status: 'pending'
      }
    ];

    const volume = calculateSessionVolume(tasks, now);
    expect(volume.totalVolumeKg).toBe(1700);
    expect(volume.setsCount).toBe(3);
    expect(volume.exercisesCount).toBe(2);
  });
});
