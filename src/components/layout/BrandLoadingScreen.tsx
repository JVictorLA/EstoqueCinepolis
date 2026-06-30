import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

import "@fontsource/space-grotesk/700.css";
import zyntraIcon from "@/icones/android-chrome-512x512.png";

const INTRO_COMPLETE_MS = 3200;
const WORDMARK_REVEAL_MS = 2550;
const DARK_ZYTREX = "#0b1020";
const DARK_ZYTREX_DEEP = "#080d1a";
const ZYTREX_GLOW = "#22d3ee";

export function BrandLoadingScreen({
  ready,
  onComplete,
}: {
  ready: boolean;
  onComplete: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const [sequenceDone, setSequenceDone] = useState(false);
  const [showWordmark, setShowWordmark] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const wordmarkTimer = window.setTimeout(
      () => setShowWordmark(true),
      reduceMotion ? 500 : WORDMARK_REVEAL_MS,
    );
    const doneTimer = window.setTimeout(
      () => setSequenceDone(true),
      reduceMotion ? 900 : INTRO_COMPLETE_MS,
    );

    return () => {
      window.clearTimeout(wordmarkTimer);
      window.clearTimeout(doneTimer);
    };
  }, [reduceMotion]);

  useEffect(() => {
    if (ready && sequenceDone) {
      setVisible(false);
    }
  }, [ready, sequenceDone]);

  return (
    <AnimatePresence onExitComplete={onComplete}>
      {visible && (
        <motion.main
          className="fixed inset-0 z-[100] overflow-hidden bg-white"
          aria-busy="true"
          aria-live="polite"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        >
          <motion.svg
            className="absolute inset-0 h-full w-full"
            viewBox="0 0 1440 900"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="zytrexIntroWave" x1="0" x2="1" y1="0" y2="1">
                <stop offset="0%" stopColor={DARK_ZYTREX} />
                <stop offset="58%" stopColor="#0d1730" />
                <stop offset="100%" stopColor={DARK_ZYTREX_DEEP} />
              </linearGradient>
              <radialGradient id="zytrexIntroGlow" cx="50%" cy="42%" r="64%">
                <stop offset="0%" stopColor={ZYTREX_GLOW} stopOpacity="0.2" />
                <stop offset="58%" stopColor={ZYTREX_GLOW} stopOpacity="0.05" />
                <stop offset="100%" stopColor={ZYTREX_GLOW} stopOpacity="0" />
              </radialGradient>
            </defs>
            <motion.path
              d="M0 650 C185 590 290 730 455 655 C650 568 755 585 910 662 C1088 750 1236 584 1440 642 L1440 1800 L0 1800 Z"
              fill="url(#zytrexIntroWave)"
              initial={reduceMotion ? { y: 0 } : { y: 430 }}
              animate={{ y: reduceMotion ? 0 : -665 }}
              transition={{
                delay: reduceMotion ? 0 : 0.25,
                duration: reduceMotion ? 0 : 1.3,
                ease: [0.65, 0, 0.35, 1],
              }}
            />
            <motion.circle
              cx="720"
              cy="450"
              r="520"
              fill="url(#zytrexIntroGlow)"
              initial={{ opacity: 0 }}
              animate={{ opacity: reduceMotion ? 0.2 : 1 }}
              transition={{
                delay: reduceMotion ? 0 : 1.55,
                duration: reduceMotion ? 0.2 : 0.45,
                ease: [0.22, 1, 0.36, 1],
              }}
            />
          </motion.svg>

          <motion.div
            className="absolute inset-0"
            initial={{ backgroundColor: "rgba(11, 16, 32, 0)" }}
            animate={{ backgroundColor: DARK_ZYTREX }}
            transition={{
              delay: reduceMotion ? 0 : 1.55,
              duration: reduceMotion ? 0.2 : 0.3,
              ease: [0.22, 1, 0.36, 1],
            }}
          />

          <div className="relative z-10 flex min-h-screen items-center justify-center px-6">
            <motion.div
              className="flex items-center justify-center"
              animate={
                ready || !sequenceDone || reduceMotion
                  ? { scale: 1 }
                  : { scale: [1, 1.025, 1], opacity: [1, 0.94, 1] }
              }
              transition={
                ready || !sequenceDone || reduceMotion
                  ? { duration: 0 }
                  : { duration: 1.8, repeat: Infinity, ease: "easeInOut" }
              }
            >
              <motion.div
                className="flex items-center overflow-hidden rounded-[2rem] px-4 py-3"
                layout
                transition={{ layout: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } }}
              >
                <motion.img
                  src={zyntraIcon}
                  alt="Zytrex"
                  className="h-20 w-20 shrink-0 object-contain sm:h-24 sm:w-24"
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{
                    delay: reduceMotion ? 0.1 : 1.85,
                    duration: reduceMotion ? 0.2 : 0.4,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                />

                <AnimatePresence>
                  {showWordmark && (
                    <motion.span
                      className="ml-4 block origin-left text-4xl font-bold tracking-[0.12em] text-white sm:ml-5 sm:text-5xl"
                      style={{
                        fontFamily: '"Space Grotesk", var(--font-sans)',
                        textShadow: `0 0 24px ${ZYTREX_GLOW}33`,
                      }}
                      initial={{ opacity: 0, width: 0, x: -10, filter: "blur(6px)" }}
                      animate={{ opacity: 1, width: "auto", x: 0, filter: "blur(0px)" }}
                      exit={{ opacity: 0, width: 0 }}
                      transition={{
                        duration: reduceMotion ? 0.2 : 0.5,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                    >
                      ZYTREX
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.div>
            </motion.div>
          </div>
        </motion.main>
      )}
    </AnimatePresence>
  );
}
