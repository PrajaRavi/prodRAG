import {
  Plus,
  Upload,
  Sparkles,
  MessageCircle,
  Lightbulb,
  ArrowRight,
  // ArrowDown,
  FileText,
  Search,
  Brain,
} from "lucide-react";

interface Step {
  number: string;
  title: string;
  description: string;
  icon: React.ElementType;
  details: string[];
}

const steps: Step[] = [
  {
    number: "01",
    title: "Click the + Icon",
    description:
      "Start by clicking the plus button beside the chat input.",
    icon: Plus,
    details: ["Located beside the input box"],
  },
  {
    number: "02",
    title: "Upload Document",
    description:
      "Choose a PDF or TXT document you want to analyze.",
    icon: Upload,
    details: ["PDF supported", "TXT supported"],
  },
  {
    number: "03",
    title: "AI Understands It",
    description:
      "Our AI automatically reads, processes, and indexes your document.",
    icon: Sparkles,
    details: ["Reads content", "Organizes knowledge", "Makes it searchable"],
  },
  {
    number: "04",
    title: "Ask Anything",
    description:
      "Ask questions about your document using natural language.",
    icon: MessageCircle,
    details: ["Ask questions", "Follow up naturally"],
  },
  {
    number: "05",
    title: "Discover Insights",
    description:
      "Get useful answers, summaries, key points, and deeper analysis.",
    icon: Lightbulb,
    details: ["Answers", "Summaries", "Analysis"],
  },
];

export default function DocumentOnboarding() {
  return (
    <section className="relative flex  h-full   min-h-0 w-full items-center justify-center hide-scrollbar overflow-y-auto bg-slate-950 px-4 py-10 sm:px-6 lg:px-8">
      {/* Background decoration */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 -top-45 h-100 w-100 -translate-x-1/2 rounded-full bg-blue-600/10 blur-[120px]" />

<div className="absolute -right-25 -bottom-50 h-100 w-100 rounded-full bg-purple-600/10 blur-[120px]" />      </div>

      <div className="relative z-10 w-full max-w-7xl pt-10">
        {/* Header */}
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-400">
            <Sparkles size={15} />
            Get Started
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
            Turn Your Documents into{" "}
            <span className="bg-linear-to-r from-blue-400 via-cyan-400 to-purple-400 bg-clip-text text-transparent">
              Insights
            </span>
          </h1>

          <p className="mt-4 text-sm leading-6 text-slate-400 sm:text-base">
            Upload a document, let AI understand it, and start asking
            questions in seconds.
          </p>
        </div>

        {/* Desktop / Tablet Flow */}
        <div className="hidden md:block">
          <div className="flex items-stretch justify-center">
            {steps.map((step, index) => {
              const Icon = step.icon;

              return (
                <div
                  key={step.number}
                  className="flex min-w-0 flex-1 items-center"
                >
                  {/* Step card */}
                  <div className="group relative flex w-full flex-col rounded-2xl border border-white/10 bg-white/2.5 p-5 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-blue-500/40 hover:bg-white/4">
                    {/* Number */}
                    <div className="absolute -top-4 left-1/2 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full border border-blue-400/30 bg-slate-900 text-xs font-bold text-blue-400 shadow-lg shadow-blue-500/10">
                      {step.number}
                    </div>

                    {/* Icon */}
                    <div className="mx-auto mt-2 flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10 text-blue-400 transition-all duration-300 group-hover:scale-110 group-hover:bg-blue-500/15">
                      <Icon size={25} strokeWidth={1.8} />
                    </div>

                    {/* Content */}
                    <div className="mt-5 text-center">
                      <h3 className="text-base font-semibold text-white">
                        {step.title}
                      </h3>

                      <p className="mt-2 min-h-15 text-sm leading-5 text-slate-400">
                        {step.description}
                      </p>
                    </div>

                    {/* Details */}
                    <div className="mt-4 space-y-2 border-t border-white/5 pt-4">
                      {step.details.map((detail) => (
                        <div
                          key={detail}
                          className="flex items-center justify-center gap-2 text-xs text-slate-500"
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                          {detail}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Connector */}
                  {index < steps.length - 1 && (
                    <div className="flex shrink-0 items-center px-2 lg:px-3">
                      <ArrowRight
                        size={20}
                        className="text-blue-500/50"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Mobile Flow */}
        <div className="md:hidden">
          <div className="relative mx-auto max-w-md">
            {/* Vertical line */}
            <div className="absolute bottom-8 left-6.75 top-8 w-px bg-linear-to-b from-blue-500/50 via-purple-500/30 to-transparent" />

            <div className="space-y-5 pt-30">
              {steps.map((step, index) => {
                const Icon = step.icon;

                return (
                  <div
                    key={step.number}
                    className="relative flex gap-4"
                  >
                    {/* Timeline node */}
                    <div className="relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-blue-500/30 bg-slate-950 shadow-lg shadow-blue-500/5">
                      <Icon
                        size={21}
                        className="text-blue-400"
                        strokeWidth={1.8}
                      />

                      {/* Step number */}
                      <span className="absolute -right-1 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full border border-slate-800 bg-blue-500 px-1 text-[9px] font-bold text-white">
                        {index + 1}
                      </span>
                    </div>

                    {/* Card */}
                    <div className="flex-1 rounded-2xl border border-white/10 bg-white/2.5 p-4 backdrop-blur-xl">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-sm font-semibold text-white">
                          {step.title}
                        </h3>

                        <span className="text-[10px] font-medium tracking-wider text-slate-600">
                          {step.number}
                        </span>
                      </div>

                      <p className="mt-2 text-xs leading-5 text-slate-400">
                        {step.description}
                      </p>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {step.details.map((detail) => (
                          <span
                            key={detail}
                            className="rounded-md border border-white/5 bg-white/3 px-2 py-1 text-[10px] text-slate-500"
                          >
                            {detail}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Bottom CTA / Hint */}
        <div className="mx-auto mt-12 flex max-w-lg flex-col items-center justify-center gap-3 text-center sm:flex-row">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <FileText size={16} />
            <span>Upload</span>
          </div>

          <ArrowRight
            size={15}
            className="hidden text-slate-700 sm:block"
          />

          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Brain size={16} />
            <span>AI Understands</span>
          </div>

          <ArrowRight
            size={15}
            className="hidden text-slate-700 sm:block"
          />

          <div className="flex items-center gap-2 text-sm text-blue-400">
            <Search size={16} />
            <span>Ask & Discover</span>
          </div>
        </div>

        <p className="mt-5 text-center text-xs text-slate-600">
          You're just 5 steps away from exploring your document.
        </p>
      </div>
    </section>
  );
}