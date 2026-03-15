import { ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface BottomSheetProps {
  children: ReactNode;
}

export default function BottomSheet({ children }: BottomSheetProps) {
  return (
    <AnimatePresence>
      <motion.div 
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="absolute bottom-0 left-0 right-0 z-[1000] bg-gray-900/95 backdrop-blur-xl text-white rounded-t-3xl shadow-[0_-8px_30px_rgba(0,0,0,0.4)] border-t border-white/10 overflow-hidden flex flex-col max-h-[85vh]"
      >
        <div className="w-full flex justify-center py-4 shrink-0">
          <div className="w-12 h-1.5 bg-gray-600/50 rounded-full" />
        </div>
        <div className="px-6 pb-8 overflow-y-auto">
          {children}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
