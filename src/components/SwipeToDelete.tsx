import { useRef, useState, type ReactNode } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { Trash2 } from 'lucide-react';

interface SwipeToDeleteProps {
  onDelete: () => void;
  children: ReactNode;
}

const DELETE_THRESHOLD = -80;

export default function SwipeToDelete({ onDelete, children }: SwipeToDeleteProps) {
  const x = useMotionValue(0);
  const bgOpacity = useTransform(x, [0, DELETE_THRESHOLD], [0, 1]);
  const iconScale = useTransform(x, [0, DELETE_THRESHOLD], [0.5, 1]);
  const [swiping, setSwiping] = useState(false);

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Delete background */}
      <motion.div
        style={{ opacity: bgOpacity }}
        className="absolute inset-0 bg-destructive flex items-center justify-end pr-6 rounded-xl"
      >
        <motion.div style={{ scale: iconScale }}>
          <Trash2 className="w-5 h-5 text-destructive-foreground" />
        </motion.div>
      </motion.div>

      {/* Swipeable content */}
      <motion.div
        style={{ x }}
        drag="x"
        dragConstraints={{ left: DELETE_THRESHOLD * 1.2, right: 0 }}
        dragElastic={0.1}
        dragDirectionLock
        onDragStart={() => setSwiping(true)}
        onDragEnd={(_, info) => {
          setSwiping(false);
          if (info.offset.x < DELETE_THRESHOLD) {
            animate(x, -300, { duration: 0.2 });
            setTimeout(onDelete, 200);
          } else {
            animate(x, 0, { type: 'spring', stiffness: 300, damping: 30 });
          }
        }}
        className="relative z-10 cursor-grab active:cursor-grabbing"
      >
        {children}
      </motion.div>
    </div>
  );
}
