import { Link } from "react-router-dom";
import { BrainCircuit } from "lucide-react";
import { localUsre } from "../../utils/const";
import { useUser } from "../../context/Global";

export default function Navbar() {
  const {IsLogin}=useUser()
  return (
    <header className="fixed left-0 right-0 top-0 z-50 border-b border-white/10 bg-slate-950/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5">
        <Link
          to="/"
          className="flex items-center gap-2 font-semibold text-white"
        >
          <div className="rounded-lg bg-blue-500/10 p-2">
            <BrainCircuit size={20} className="text-blue-400" />
          </div>

          <span>RAG<span className="text-blue-400">Flow</span></span>
        </Link>

        <nav className="flex items-center gap-2">
          {IsLogin==false&&
          <div>

          <Link
            to="/login"
            className="rounded-lg px-4 py-2 text-sm text-slate-300 transition hover:bg-white/5 hover:text-white"
          >
            Login
          </Link>
          <Link
            to="/signup"
            className="rounded-lg px-4 py-2 text-sm text-slate-300 transition hover:bg-white/5 hover:text-white"
            >
            Signup
          </Link>
            </div>
          }

          <Link
            to="/analyze"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500"
          >
            Analyze
          </Link>
        </nav>
      </div>
    </header>
  );
}