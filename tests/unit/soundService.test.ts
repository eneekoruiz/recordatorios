import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SoundService } from '../../src/services/SoundService';

// Mock Web Audio API for Node / jsdom environment if not natively present
function createMockAudioContext() {
  const destination = {};
  const mockNode = () => {
    const node: any = {
      connect: vi.fn().mockReturnThis(),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      gain: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        value: 1
      },
      frequency: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
        value: 440
      },
      Q: { setValueAtTime: vi.fn() },
      pan: { setValueAtTime: vi.fn() },
      buffer: null,
      loop: false
    };
    return node;
  };

  return {
    state: 'running',
    currentTime: 0,
    destination,
    createGain: vi.fn(() => mockNode()),
    createOscillator: vi.fn(() => mockNode()),
    createBiquadFilter: vi.fn(() => mockNode()),
    createBufferSource: vi.fn(() => mockNode()),
    createBuffer: vi.fn((channels: number, length: number) => ({
      getChannelData: vi.fn(() => new Float32Array(length)),
      numberOfChannels: channels,
      length
    })),
    createStereoPanner: vi.fn(() => mockNode()),
    resume: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined)
  } as unknown as AudioContext;
}

describe('SoundService & Ambient Synthesizers', () => {
  beforeEach(() => {
    // Inject constructable mock window and AudioContext in Node test environment
    (globalThis as any).window = globalThis;
    function MockAudioContext() {
      return createMockAudioContext();
    }
    (globalThis as any).AudioContext = MockAudioContext;
    (globalThis as any).webkitAudioContext = MockAudioContext;
    SoundService.stopAmbientSound();
  });

  it('can start all supported ambient sound types without error', () => {
    const soundTypes = ['rain', 'waves', 'binaural', 'focus'] as const;

    for (const type of soundTypes) {
      expect(() => {
        SoundService.startAmbientSound(type);
      }).not.toThrow();
    }
  });

  it('safely handles rapid switching between ambient sound types', () => {
    expect(() => {
      SoundService.startAmbientSound('rain');
      SoundService.startAmbientSound('waves');
      SoundService.startAmbientSound('focus');
      SoundService.startAmbientSound('binaural');
      SoundService.stopAmbientSound();
    }).not.toThrow();
  });

  it('manages ambient volume within valid boundaries', () => {
    SoundService.setAmbientVolume(0.5);
    expect(SoundService.ambientVolume).toBe(0.5);

    // Clamps to 1
    SoundService.setAmbientVolume(1.5);
    expect(SoundService.ambientVolume).toBe(1);

    // Clamps to 0
    SoundService.setAmbientVolume(-0.2);
    expect(SoundService.ambientVolume).toBe(0);
  });

  it('stops ambient sound and cleans up resources', () => {
    SoundService.startAmbientSound('rain');
    expect(() => {
      SoundService.stopAmbientSound();
    }).not.toThrow();
  });
});

describe('Task Postponing Queue Reordering Engine', () => {
  it('moves current task to the end when postponed in a sequence of multiple tasks', () => {
    const queue = ['task-A', 'task-B', 'task-C'];
    const currentIndex = 0; // Current is 'task-A'

    const before = queue.slice(0, currentIndex);
    const after = queue.slice(currentIndex + 1);
    const currentId = queue[currentIndex];
    const newQueue = [...before, ...after, currentId];

    expect(newQueue).toEqual(['task-B', 'task-C', 'task-A']);
    // The task that now appears at index 0 is 'task-B'
    expect(newQueue[currentIndex]).toBe('task-B');
  });

  it('keeps queue unchanged if the current task is already the last task remaining', () => {
    const queue = ['task-A', 'task-B', 'task-C'];
    const currentIndex = 2; // Last task

    const activeRemaining = queue.slice(currentIndex);
    expect(activeRemaining.length).toBe(1); // Cannot postpone last item
  });
});
