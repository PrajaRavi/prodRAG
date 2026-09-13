import {
  KeyRound,
  Database,
  Sparkles,
  Brain,
  Settings2,
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
  MessageCircle,
  ExternalLink,
} from "lucide-react";

interface ApiKeyOnboardingProps {
  onConfigure?: () => void;
}

const steps = [
  {
    number: "01",
    title: "Create Your API Keys",
    description:
      "Create API keys for Pinecone, Gemini, and Groq from their respective platforms.",
    icon: KeyRound,
  },
  {
    number: "02",
    title: "Configure Your Keys",
    description:
      "Open the API configuration panel from the left sidebar and securely add your keys.",
    icon: Settings2,
  },
  {
    number: "03",
    title: "Start Chatting",
    description:
      "Once your keys are configured, upload your documents and start asking questions.",
    icon: MessageCircle,
  },
];

const services = [
  {
    name: "Pinecone",
    description: "Vector database",
    icon: Database,
    url: "https://app.pinecone.io/",
  },
  {
    name: "Gemini",
    description: "Embeddings & AI",
    icon: Brain,
    url: "https://aistudio.google.com/app/apikey",
  },
  {
    name: "Groq",
    description: "Fast LLM inference",
    icon: Sparkles,
    url: "https://console.groq.com/keys",
  },
];

export default function ApiKeyOnboarding({
  onConfigure,
}: ApiKeyOnboardingProps) {
  return (
    <main className="flex h-full flex-1 items-center hide-scrollbar justify-center overflow-y-auto bg-slate-950 px-5 py-10 text-white md:px-10">
      <div className="w-full max-w-5xl relative  top-20">

        {/* Header */}
        <div className="mx-auto max-w-2xl text-center ">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-400/20 bg-blue-500/10">
            <KeyRound
              size={26}
              className="text-blue-400"
            />
          </div>

          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Configure Your AI Workspace
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-400 sm:text-base">
            Create your API keys, configure them from the sidebar,
            and start chatting with your documents.
          </p>
        </div>

        {/* Required Services */}
        <div className="mx-auto mt-10 max-w-3xl">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-medium text-slate-300">
              Required Services
            </h2>

            <span className="text-xs text-slate-500">
              3 services
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {services.map((service) => {
              const Icon = service.icon;

              return (
                <div
                  key={service.name}
                  className="group relative rounded-2xl border border-white/10 bg-white/3 p-4 transition hover:border-blue-400/20 hover:bg-white/4"
                >
                  {/* External link */}
                  <a
                    href={service.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Create ${service.name} API key`}
                    title={`Create ${service.name} API key`}
                    className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white/10 hover:text-blue-400"
                    onClick={(event) => {
                      event.stopPropagation();
                    }}
                  >
                    <ExternalLink size={15} />
                  </a>

                  {/* Service */}
                  <div className="flex items-center gap-3 pr-8">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5 text-slate-300">
                      <Icon size={19} />
                    </div>

                    <div>
                      <p className="text-sm font-medium text-white">
                        {service.name}
                      </p>

                      <p className="mt-0.5 text-xs text-slate-500">
                        {service.description}
                      </p>
                    </div>
                  </div>

                  {/* Create key hint */}
                  <div className="mt-4 flex items-center gap-1.5 text-[11px] text-slate-600 transition group-hover:text-slate-500">
                    <KeyRound size={12} />
                    <span>Click ↗ to create API key</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Steps */}
        <div className="mx-auto mt-10 max-w-4xl">
          <div className="grid gap-4 md:grid-cols-3">
            {steps.map((step, index) => {
              const Icon = step.icon;

              return (
                <div
                  key={step.number}
                  className="relative rounded-2xl border border-white/10 bg-white/3 p-5"
                >
                  <div className="mb-5 flex items-center justify-between">
                    <span className="text-xs font-semibold tracking-widest text-blue-400">
                      {step.number}
                    </span>

                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
                      <Icon size={18} />
                    </div>
                  </div>

                  <h3 className="text-sm font-semibold text-white">
                    {step.title}
                  </h3>

                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    {step.description}
                  </p>

                  {index < steps.length - 1 && (
                    <ArrowRight
                      size={17}
                      className="absolute -right-5 top-1/2 z-10 hidden -translate-y-1/2 text-slate-600 md:block"
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Configure CTA */}
        <div className="mx-auto mt-8 max-w-4xl">
          <button
            type="button"
            onClick={onConfigure}
            className="group flex w-full items-center justify-between rounded-2xl border border-blue-400/20 bg-blue-500/10 p-5 text-left transition hover:border-blue-400/30 hover:bg-blue-500/15"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-500/15">
                <Settings2
                  size={20}
                  className="text-blue-400"
                />
              </div>

              <div>
                <p className="text-sm font-semibold text-white">
                  API keys ready?
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  Click the API Keys button in the left sidebar to configure them.
                </p>
              </div>
            </div>

            <ArrowRight
              size={20}
              className="shrink-0 text-blue-400 transition-transform group-hover:translate-x-1"
            />
          </button>
        </div>

        {/* Security */}
        <div className="mx-auto mt-5 flex max-w-4xl items-center justify-center gap-2 text-center text-xs text-slate-600">
          <ShieldCheck size={14} />
          <span>
            Your API keys are used to connect your configured AI services.
          </span>
        </div>

        {/* Flow */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-2 text-xs text-slate-600">
          <span className="text-slate-400">Create keys</span>
          <ArrowRight size={13} />

          <span className="text-slate-400">Configure</span>
          <ArrowRight size={13} />

          <span className="text-slate-400">Upload documents</span>
          <ArrowRight size={13} />

          <span className="text-slate-400">Chat</span>

          <CheckCircle2
            size={14}
            className="text-emerald-500/70"
          />
        </div>
      </div>
    </main>
  );
}