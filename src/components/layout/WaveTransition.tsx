import { motion, useReducedMotion } from "framer-motion";

const DARK_ZYTREX = "#0b1020";
const DARK_ZYTREX_DEEP = "#080d1a";
const ZYTREX_GLOW = "#22d3ee";

export function WaveTransition({ onComplete }: { onComplete: () => void }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className="fixed inset-0 z-[110] overflow-hidden bg-white"
      aria-hidden="true"
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1440 900"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="zytrexLoginWave" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor={DARK_ZYTREX} />
            <stop offset="58%" stopColor="#0d1730" />
            <stop offset="100%" stopColor={DARK_ZYTREX_DEEP} />
          </linearGradient>
          <radialGradient id="zytrexLoginGlow" cx="50%" cy="42%" r="64%">
            <stop offset="0%" stopColor={ZYTREX_GLOW} stopOpacity="0.18" />
            <stop offset="62%" stopColor={ZYTREX_GLOW} stopOpacity="0.04" />
            <stop offset="100%" stopColor={ZYTREX_GLOW} stopOpacity="0" />
          </radialGradient>
        </defs>
        <motion.path
          d="M0 650 C185 590 290 730 455 655 C650 568 755 585 910 662 C1088 750 1236 584 1440 642 L1440 1800 L0 1800 Z"
          fill="url(#zytrexLoginWave)"
          initial={reduceMotion ? { y: 0 } : { y: 430 }}
          animate={{ y: reduceMotion ? 0 : -665 }}
          transition={{
            delay: reduceMotion ? 0 : 0.04,
            duration: reduceMotion ? 0 : 0.78,
            ease: [0.65, 0, 0.35, 1],
          }}
          onAnimationComplete={onComplete}
        />
        <motion.circle
          cx="720"
          cy="450"
          r="520"
          fill="url(#zytrexLoginGlow)"
          initial={{ opacity: 0 }}
          animate={{ opacity: reduceMotion ? 0.2 : 1 }}
          transition={{
            delay: reduceMotion ? 0 : 0.48,
            duration: reduceMotion ? 0.2 : 0.25,
            ease: [0.22, 1, 0.36, 1],
          }}
        />
      </motion.svg>
    </motion.div>
  );
}
