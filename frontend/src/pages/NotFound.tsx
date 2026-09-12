import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Home } from "lucide-react";
import { useNavigate } from "react-router-dom";

type Direction = "UP" | "DOWN" | "LEFT" | "RIGHT";

interface Point {
  x: number;
  y: number;
}

const BOARD_SIZE = 20;
const INITIAL_SNAKE: Point[] = [
  { x: 10, y: 10 },
  { x: 9, y: 10 },
  { x: 8, y: 10 },
];

const INITIAL_FOOD = { x: 15, y: 8 };

const directionMap: Record<string, Direction> = {
  ArrowUp: "UP",
  ArrowDown: "DOWN",
  ArrowLeft: "LEFT",
  ArrowRight: "RIGHT",
};

const isOpposite = (
  current: Direction,
  next: Direction
): boolean => {
  return (
    (current === "UP" && next === "DOWN") ||
    (current === "DOWN" && next === "UP") ||
    (current === "LEFT" && next === "RIGHT") ||
    (current === "RIGHT" && next === "LEFT")
  );
};

const getRandomFood = (snake: Point[]): Point => {
  let food: Point;

  do {
    food = {
      x: Math.floor(Math.random() * BOARD_SIZE),
      y: Math.floor(Math.random() * BOARD_SIZE),
    };
  } while (
    snake.some(
      (part) => part.x === food.x && part.y === food.y
    )
  );

  return food;
};

export default function NotFound() {
  const navigate = useNavigate();

  const [snake, setSnake] = useState<Point[]>(INITIAL_SNAKE);
  const [food, setFood] = useState<Point>(INITIAL_FOOD);
  const [direction, setDirection] =
    useState<Direction>("RIGHT");

  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);

  const directionRef = useRef<Direction>("RIGHT");
  const gameOverRef = useRef(false);

  const changeDirection = useCallback(
    (nextDirection: Direction) => {
      if (gameOverRef.current) return;

      const currentDirection = directionRef.current;

      if (isOpposite(currentDirection, nextDirection)) {
        return;
      }

      directionRef.current = nextDirection;
      setDirection(nextDirection);
    },
    []
  );

  const resetGame = () => {
    const initialSnake = [...INITIAL_SNAKE];

    setSnake(initialSnake);
    setFood(INITIAL_FOOD);
    setScore(0);
    setGameOver(false);

    gameOverRef.current = false;
    directionRef.current = "RIGHT";
    setDirection("RIGHT");
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const nextDirection = directionMap[event.key];

      if (!nextDirection) return;

      event.preventDefault();
      changeDirection(nextDirection);
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [changeDirection]);

  useEffect(() => {
    if (gameOver) return;

    const interval = window.setInterval(() => {
      setSnake((currentSnake) => {
        if (gameOverRef.current) {
          return currentSnake;
        }

        const head = currentSnake[0];
        const currentDirection = directionRef.current;

        const newHead = { ...head };

        switch (currentDirection) {
          case "UP":
            newHead.y -= 1;
            break;

          case "DOWN":
            newHead.y += 1;
            break;

          case "LEFT":
            newHead.x -= 1;
            break;

          case "RIGHT":
            newHead.x += 1;
            break;
        }

        // Wall collision
        if (
          newHead.x < 0 ||
          newHead.x >= BOARD_SIZE ||
          newHead.y < 0 ||
          newHead.y >= BOARD_SIZE
        ) {
          gameOverRef.current = true;
          setGameOver(true);
          return currentSnake;
        }

        // Self collision
        if (
          currentSnake.some(
            (part) =>
              part.x === newHead.x &&
              part.y === newHead.y
          )
        ) {
          gameOverRef.current = true;
          setGameOver(true);
          return currentSnake;
        }

        const ateFood =
          newHead.x === food.x &&
          newHead.y === food.y;

        const nextSnake = [
          newHead,
          ...currentSnake,
        ];

        if (ateFood) {
          setScore((previous) => previous + 1);
          setFood(getRandomFood(nextSnake));

          return nextSnake;
        }

        nextSnake.pop();

        return nextSnake;
      });
    }, 120);

    return () => {
      window.clearInterval(interval);
    };
  }, [food, gameOver]);

  return (
    <main className="min-h-screen overflow-hidden bg-slate-950 text-white">
      {/* Background */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-1/2 top-[-200px] h-[450px] w-[450px] -translate-x-1/2 rounded-full bg-blue-600/10 blur-[130px]" />

        <div className="absolute bottom-[-150px] right-[-100px] h-[350px] w-[350px] rounded-full bg-purple-600/10 blur-[120px]" />
      </div>

      <div className="relative z-10 mx-auto pt-20 flex min-h-screen w-full max-w-5xl flex-col px-4 py-5 sm:px-6">
        {/* Home link */}
        <div className="flex items-center">
          <button
            onClick={() => navigate("/")}
            className="group flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-slate-400 backdrop-blur-xl transition-all duration-300 hover:border-blue-500/30 hover:bg-white/[0.06] hover:text-white"
          >
            <ArrowLeft
              size={16}
              className="transition-transform duration-300 group-hover:-translate-x-1"
            />

            <span>Back to Home</span>

            <Home
              size={15}
              className="ml-1 text-blue-400"
            />
          </button>
        </div>

        {/* Main */}
        <div className="flex flex-1 flex-col items-center justify-center py-8">
          {/* 404 */}
          <div className="mb-3 text-center">
            <h1 className="text-6xl font-black tracking-tight sm:text-7xl md:text-8xl">
              <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-purple-500 bg-clip-text text-transparent">
                404
              </span>
            </h1>

            <h2 className="mt-2 text-xl font-semibold sm:text-2xl">
              Looks like this page got lost.
            </h2>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
              Help the snake find its way. Use the arrow keys
              or the controls below.
            </p>
          </div>

          {/* Game container */}
          <div className="mt-7 w-full max-w-[620px]">
            {/* Score bar */}
            <div className="mb-3 flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.025] px-4 py-3 backdrop-blur-xl">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-600">
                  Snake.exe
                </p>

                <p className="mt-0.5 text-sm font-medium text-slate-300">
                  Find your way home
                </p>
              </div>

              <div className="text-right">
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-600">
                  Score
                </p>

                <p className="text-lg font-bold text-blue-400">
                  {score.toString().padStart(2, "0")}
                </p>
              </div>
            </div>

            {/* Board */}
            <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-white/10 bg-slate-900/80 p-2 shadow-2xl shadow-blue-950/20 backdrop-blur-xl sm:p-3">
              {/* Grid */}
              <div
                className="relative grid h-full w-full overflow-hidden rounded-xl bg-slate-950"
                style={{
                  gridTemplateColumns: `repeat(${BOARD_SIZE}, 1fr)`,
                  gridTemplateRows: `repeat(${BOARD_SIZE}, 1fr)`,
                }}
              >
                {/* Grid cells */}
                {Array.from({
                  length: BOARD_SIZE * BOARD_SIZE,
                }).map((_, index) => (
                  <div
                    key={index}
                    className="border-[0.5px] border-white/[0.025]"
                  />
                ))}

                {/* Food */}
                <div
                  className="absolute flex items-center justify-center"
                  style={{
                    width: `${100 / BOARD_SIZE}%`,
                    height: `${100 / BOARD_SIZE}%`,
                    left: `${(food.x * 100) / BOARD_SIZE}%`,
                    top: `${(food.y * 100) / BOARD_SIZE}%`,
                  }}
                >
                  <div className="h-[55%] w-[55%] animate-pulse rounded-full bg-purple-400 shadow-[0_0_18px_rgba(192,132,252,0.9)]" />
                </div>

                {/* Snake */}
                {snake.map((part, index) => (
                  <div
                    key={`${part.x}-${part.y}-${index}`}
                    className="absolute flex items-center justify-center"
                    style={{
                      width: `${100 / BOARD_SIZE}%`,
                      height: `${100 / BOARD_SIZE}%`,
                      left: `${(part.x * 100) / BOARD_SIZE}%`,
                      top: `${(part.y * 100) / BOARD_SIZE}%`,
                    }}
                  >
                    <div
                      className={[
                        "h-[72%] w-[72%] rounded-[5px] transition-all duration-75",
                        index === 0
                          ? "bg-blue-400 shadow-[0_0_14px_rgba(96,165,250,0.9)]"
                          : "bg-blue-500/70",
                      ].join(" ")}
                    >
                      {index === 0 && (
                        <div className="flex h-full items-center justify-center">
                          <div className="h-[25%] w-[25%] rounded-full bg-white" />
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* Game over */}
                {gameOver && (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-white">
                        Game Over
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        You scored {score}
                      </p>

                      <button
                        onClick={resetGame}
                        className="mt-4 rounded-xl bg-blue-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-400"
                      >
                        Try Again
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Controls */}
            <div className="mt-5 flex flex-col items-center gap-2">
              {/* Up */}
              <ControlButton
                direction="UP"
                onClick={() => changeDirection("UP")}
              >
                <ArrowUp size={19} />
              </ControlButton>

              <div className="flex gap-2">
                <ControlButton
                  direction="LEFT"
                  onClick={() =>
                    changeDirection("LEFT")
                  }
                >
                  <ArrowLeft size={19} />
                </ControlButton>

                <ControlButton
                  direction="DOWN"
                  onClick={() =>
                    changeDirection("DOWN")
                  }
                >
                  <ArrowDown size={19} />
                </ControlButton>

                <ControlButton
                  direction="RIGHT"
                  onClick={() =>
                    changeDirection("RIGHT")
                  }
                >
                  <ArrowRight size={19} />
                </ControlButton>
              </div>
            </div>

            {/* Hint */}
            <p className="mt-5 text-center text-[11px] text-slate-600">
              Use ↑ ↓ ← → on desktop
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

interface ControlButtonProps {
  direction: Direction;
  onClick: () => void;
  children: React.ReactNode;
}

function ControlButton({
  direction,
  onClick,
  children,
}: ControlButtonProps) {
  const isActive = direction === "RIGHT";

  return (
    <button
      type="button"
      aria-label={`Move ${direction.toLowerCase()}`}
      onClick={onClick}
      className={[
        "flex h-12 w-12 touch-manipulation  items-center justify-center rounded-xl border transition-all duration-200 active:scale-90 sm:h-11 sm:w-11",
        isActive
          ? "border-blue-500/30 bg-blue-500/10 text-blue-400"
          : "border-white/10 bg-white/[0.035] text-slate-400 hover:border-blue-500/30 hover:bg-blue-500/10 hover:text-blue-400",
      ].join(" ")}
    >
      {children}
    </button>
  );
}