
interface CircularLoaderProps {
  /** Progress percentage (0 - 100). If omitted, displays an indeterminate spinning animation. */
  progress?: number;
  /** Stroke width in pixels relative to SVG viewBox (default: 8) */
  strokeWidth?: number;
  className?: string;
  color?:string
}

export function CircularLoader({
  progress,
  strokeWidth = 8,
  className = "",
  color="#4E9DF8"
}: CircularLoaderProps) {
  const isDeterminate = typeof progress === "number";
  const normalizedProgress = isDeterminate
    ? Math.min(100, Math.max(0, progress))
    : 0;

  // Circle dimensions relative to viewBox (100x100)
  const radius = (100 - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (normalizedProgress / 100) * circumference;

  return (
    <div className={`relative w-full h-full flex items-center justify-center ${className}`}>
      <svg
        className={`w-full h-full transform -rotate-90 ${
          !isDeterminate ? "animate-spin" : ""
        }`}
        viewBox="0 0 100 100"
      >
        {/* Background Track Circle */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeOpacity="0.15"
          fill="transparent"
        />

        {/* Animated Progress Circle */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={isDeterminate ? strokeDashoffset : circumference * 0.75}
          strokeLinecap="round"
          fill="transparent"
          className="transition-all duration-300 ease-out"
        />
      </svg>
    </div>
  );
}