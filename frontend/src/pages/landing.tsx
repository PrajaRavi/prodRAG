import { ArrowRight, BrainCircuit, Database, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { useUser } from "../context/Global";
import { useEffect } from "react";


export default function Landing() {
  const {setAnalyzerPageVisible}=useUser()

  useEffect(()=>{
setAnalyzerPageVisible(false)
  },[])
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      
      <main className="relative overflow-hidden pt-16">
<div className="absolute left-1/2 top-0 h-125 w-175 -translate-x-1/2 rounded-full bg-blue-600/10 blur-3xl" />
        <section className="relative mx-auto flex min-h-[calc(100vh-64px)] max-w-6xl flex-col items-center justify-center px-5 py-20 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/5 px-4 py-2 text-sm text-blue-300">
            <BrainCircuit size={16} />
            Production RAG Workspace
          </div>

          <h1 className="max-w-4xl text-4xl font-bold tracking-tight sm:text-6xl">
            Chat with your
            <span className="text-blue-400"> documents</span>
          </h1>

          <p className="mt-6 max-w-2xl text-base leading-7 text-slate-400 sm:text-lg">
            Upload your knowledge, retrieve relevant information and
            interact with your documents through an intelligent RAG
            pipeline.
          </p>

          <Link
            to="/analyze"
            className="mt-9 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 font-medium transition hover:bg-blue-500"
          >
            Start analyzing
            <ArrowRight size={18} />
          </Link>

          <div className="mt-20 grid w-full max-w-3xl gap-4 sm:grid-cols-3">
            {[
              {
                icon: Database,
                title: "Vector Search",
                description: "Semantic document retrieval",
              },
              {
                icon: BrainCircuit,
                title: "AI Answers",
                description: "Context-aware responses",
              },
              {
                icon: ShieldCheck,
                title: "Isolated Data",
                description: "Conversation-level retrieval",
              },
            ].map((item) => {
              const Icon = item.icon;

              return (
                <div
                  key={item.title}
                  className="rounded-2xl border border-white/10 bg-white/3 p-5 transition duration-300 hover:-translate-y-1"
                >
                  <Icon
                    size={22}
                    className="mx-auto text-blue-400"
                  />

                  <h3 className="mt-4 font-medium">
                    {item.title}
                  </h3>

                  <p className="mt-2 text-sm text-slate-500">
                    {item.description}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}