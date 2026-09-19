import { motion, type MotionValue } from 'framer-motion';
import { CheckCircle, Trash2 } from 'lucide-react';

export interface TaskSwipeBackgroundProps {
  isEffectivelyDone: boolean;
  leftBgOpacity: MotionValue<number>;
  leftIconScale: MotionValue<number>;
  leftIconX: MotionValue<number>;
  rightBgOpacity: MotionValue<number>;
  rightIconScale: MotionValue<number>;
  rightIconX: MotionValue<number>;
}

export function TaskSwipeBackground({
  isEffectivelyDone,
  leftBgOpacity,
  leftIconScale,
  leftIconX,
  rightBgOpacity,
  rightIconScale,
  rightIconX
}: TaskSwipeBackgroundProps) {
  return (
    <>
      {/* Left = Complete/Uncomplete */}
      <motion.div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          bottom: 0,
          width: '50%',
          background: isEffectivelyDone ? 'var(--accent-orange)' : 'var(--accent-green)',
          display: 'flex',
          alignItems: 'center',
          paddingLeft: 24,
          opacity: leftBgOpacity,
          zIndex: 0,
          overflow: 'hidden'
        }}
      >
        <motion.div style={{ scale: leftIconScale, x: leftIconX }}>
          {isEffectivelyDone ? (
            <CheckCircle color="white" size={26} style={{ opacity: 0.9 }} />
          ) : (
            <CheckCircle color="white" size={26} />
          )}
        </motion.div>
      </motion.div>

      {/* Right = Delete */}
      <motion.div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          width: '50%',
          background: 'var(--accent-red)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          paddingRight: 24,
          opacity: rightBgOpacity,
          zIndex: 0,
          overflow: 'hidden'
        }}
      >
        <motion.div style={{ scale: rightIconScale, x: rightIconX }}>
          <Trash2 color="white" size={26} />
        </motion.div>
      </motion.div>
    </>
  );
}
