import { motion } from "framer-motion";

export default function TypingIndicator({text="Thinking..."}:{text:string}) {
  return (
        <div className="rounded-2xl  flex flex-row gap-2 rounded-bl-md mt-2 bg-transparent">
          <div className="flex items-center gap-2">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="h-2.5 w-2.5 rounded-full bg-neutral-400"
                animate={{
                  y: [0, -6, 0],
                  opacity: [0.4, 1, 0.4],
                }}
                transition={{
                  duration: 0.8,
                  repeat: Infinity,
                  delay: i * 0.2,
                  ease: "easeInOut",
                }}
              />
            ))}
          </div>
            <p>{text}</p>
        
        </div>
    
  );
}