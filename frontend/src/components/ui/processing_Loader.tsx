import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";

interface ProcessingLoaderProps {
  time?: number;
  statements?: string[];
}

const DEFAULT_STATEMENTS = [
  "Analyzing your document",
  "Extracting insights",
  "How was your day",
];

export default function ProcessingLoader({
  time = 3,
  statements = DEFAULT_STATEMENTS,
}: ProcessingLoaderProps) {
  const safeStatements =
    statements.length > 0 ? statements : DEFAULT_STATEMENTS;

  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((previous) =>
        (previous + 1) % safeStatements.length
      );
    }, time * 1000);

    return () => clearInterval(interval);
  }, [time, safeStatements.length]);

  const currentStatement = safeStatements[currentIndex];

  return (
    <main className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-slate-950 text-white">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0">
        <motion.div
          className="absolute left-1/2 -top-50 h-112.5 w-112.5 -translate-x-1/2 rounded-full bg-blue-600/10 blur-[130px]"
          animate={{
            scale: [1, 1.15, 1],
            opacity: [0.5, 0.8, 0.5],
          }}
          transition={{
            duration: 6,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        <motion.div
          className="absolute -right-25 -bottom-37.5 h-87.5 w-87.5 rounded-full bg-purple-600/10 blur-[120px]"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.4, 0.7, 0.4],
          }}
          transition={{
            duration: 7,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      </div>

      {/* Main content */}
      <div className="relative z-10 flex w-full max-w-lg flex-col items-center px-6 text-center">
        {/* Animated loader */}
        <div className="relative flex h-40 w-40 items-center justify-center">
          {/* Outer rotating ring */}
          <motion.div
            className="absolute inset-0 rounded-full border border-blue-400/20"
            animate={{ rotate: 360 }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: "linear",
            }}
          >
            <div className="absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-blue-400 shadow-[0_0_20px_rgba(96,165,250,0.9)]" />
          </motion.div>

          {/* Second ring */}
          <motion.div
            className="absolute inset-5 rounded-full border border-purple-400/20"
            animate={{ rotate: -360 }}
            transition={{
              duration: 5,
              repeat: Infinity,
              ease: "linear",
            }}
          >
            <div className="absolute -right-1 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-purple-400 shadow-[0_0_16px_rgba(192,132,252,0.9)]" />
          </motion.div>

          {/* Core */}
          <motion.div
            className="relative flex h-20 w-20 items-center justify-center rounded-full border border-blue-400/20 bg-blue-500/10 backdrop-blur-xl"
            animate={{
              scale: [1, 1.08, 1],
              boxShadow: [
                "0 0 20px rgba(59,130,246,0.15)",
                "0 0 45px rgba(59,130,246,0.35)",
                "0 0 20px rgba(59,130,246,0.15)",
              ],
            }}
            transition={{
              duration: 2.2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            <motion.div
              animate={{
                rotate: [0, 180, 360],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: "linear",
              }}
            >
              <Sparkles
                size={28}
                className="text-blue-400"
              />
            </motion.div>
          </motion.div>

          {/* Pulsing circles */}
          <motion.div
            className="absolute inset-0 rounded-full border border-blue-400/10"
            animate={{
              scale: [1, 1.35],
              opacity: [0.5, 0],
            }}
            transition={{
              duration: 2.5,
              repeat: Infinity,
              ease: "easeOut",
            }}
          />

          <motion.div
            className="absolute inset-0 rounded-full border border-purple-400/10"
            animate={{
              scale: [1, 1.55],
              opacity: [0.4, 0],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeOut",
              delay: 0.8,
            }}
          />
        </div>

        {/* Statement */}
        <div className="mt-10 h-14 w-full">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              initial={{
                opacity: 0,
                y: 12,
                filter: "blur(6px)",
              }}
              animate={{
                opacity: 1,
                y: 0,
                filter: "blur(0px)",
              }}
              exit={{
                opacity: 0,
                y: -12,
                filter: "blur(6px)",
              }}
              transition={{
                duration: 0.45,
                ease: "easeOut",
              }}
            >
              <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                {currentStatement}
                <span className="ml-1 inline-flex">
                  <motion.span
                    animate={{ opacity: [0, 1, 0] }}
                    transition={{
                      duration: 1.2,
                      repeat: Infinity,
                    }}
                  >
                    .
                  </motion.span>

                  <motion.span
                    animate={{ opacity: [0, 1, 0] }}
                    transition={{
                      duration: 1.2,
                      repeat: Infinity,
                      delay: 0.2,
                    }}
                  >
                    .
                  </motion.span>

                  <motion.span
                    animate={{ opacity: [0, 1, 0] }}
                    transition={{
                      duration: 1.2,
                      repeat: Infinity,
                      delay: 0.4,
                    }}
                  >
                    .
                  </motion.span>
                </span>
              </h1>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Progress */}
        <div className="mt-6 w-full max-w-xs">
          <div className="h-1 overflow-hidden rounded-full bg-white/5">
            <motion.div
              className="h-full rounded-full bg-blue-500"
              animate={{
                width: ["0%", "100%"],
              }}
              transition={{
                duration: time,
                repeat: Infinity,
                ease: "linear",
              }}
            />
          </div>

          <p className="mt-3 text-xs text-slate-600">
            Processing your request
          </p>
        </div>
      </div>
    </main>
  );
}