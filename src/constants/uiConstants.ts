/**
 * UI Constants & Design System Tokens (Apple HIG Standard)
 * Eradicating Magic Numbers and Hardcoded String Literals
 */

export const UI_CONSTANTS = {
  SWIPE: {
    COMPLETE_THRESHOLD_PX: 65,
    DELETE_THRESHOLD_PX: -65,
    HAPTIC_VIBRATION_SHORT_MS: 5,
    HAPTIC_VIBRATION_LONG_PATTERN: [5, 50, 5],
  },
  ANIMATION: {
    SPRING_BOUNCE_STIFFNESS: 500,
    SPRING_BOUNCE_DAMPING: 35,
    POPOVER_STIFFNESS: 450,
    POPOVER_DAMPING: 25,
    STRIKE_THROUGH_DURATION_SEC: 0.28,
  },
  TIMINGS: {
    DEBOUNCE_SYNC_MS: 1000,
    SYNC_INTERVAL_MS: 30000,
    LONG_PRESS_MS: 400,
  },
  COLORS: {
    IOS_RED: '#FF3B30',
    IOS_ORANGE: '#FF9500',
    IOS_GREEN: '#34C759',
    IOS_BLUE: '#0A84FF',
  },
} as const;
