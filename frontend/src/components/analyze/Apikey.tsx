import { ArrowRight, KeyRound } from "lucide-react";
import Input from "../ui/Input";
import Button from "../ui/button"

interface ApiKeysProps {
  pinecone: string;
  groq: string;
  gemini: string;

  onChange: (
    key: "pinecone" | "groq" | "gemini",
    value: string
  ) => void;
}

export default function ApiKeys({
  pinecone,
  groq,
  gemini,
  onChange,
}: ApiKeysProps) {
  return (
    <section className="border-b border-white/10 p-4">
      <div className="mb-4 flex items-center gap-2">
        <KeyRound size={17} className="text-blue-400" />

        <h2 className="text-sm font-semibold text-white">
          API Configuration
        </h2>
      </div>

      <div className="space-y-3">
        <Input
          type="password"
          placeholder="Pinecone API key"
          value={pinecone}
          onChange={(e) =>
            onChange("pinecone", e.target.value)
          }
        />

        <Input
          type="password"
          placeholder="Groq API key"
          value={groq}
          onChange={(e) =>
            onChange("groq", e.target.value)
          }
        />

        <Input
          type="password"
          placeholder="Gemini API key"
          value={gemini}
          onChange={(e) =>
            onChange("gemini", e.target.value)
          }
        />
        <Button
            // onClick={handleLogin}
            disabled={!gemini.trim() || !groq.trim() || !pinecone.trim()}
            className="w-full gap-2 bg-blue-600 text-white hover:bg-blue-500"
          >
            Configure
            <ArrowRight size={17} />
          </Button>
      </div>
    </section>
  );
}