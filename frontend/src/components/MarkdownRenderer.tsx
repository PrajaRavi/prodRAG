import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Props {
  content: string;
}

export default function MarkdownRenderer({ content }: Props) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => (
          <h1 className="mb-2 mt-4 text-3xl font-bold">{children}</h1>
        ),

        h2: ({ children }) => (
          <h2 className="mb-2 mt-3 text-2xl font-semibold">{children}</h2>
        ),

        h3: ({ children }) => (
          <h3 className="mb-1 mt-2 text-xl font-semibold">{children}</h3>
        ),

        p: ({ children }) => (
          <p className="mb-2 leading-7 text-white">{children}</p>
        ),

        // List wrappers
        ul: ({ children }) => (
          <ul className="mb-4 list-disc pl-6 space-y-1 text-white">
            {children}
          </ul>
        ),

        ol: ({ children }) => (
          <ol className="mb-4 list-decimal pl-6 space-y-1 text-white">
            {children}
          </ol>
        ),

        // Custom list item rendering
        li: ({ children }) => (
          <li className="leading-6">{children}</li>
        ),

        blockquote: ({ children }) => (
          <blockquote className="my-4 border-l-4 border-blue-500 bg-blue-50 px-4 py-3 italic text-neutral-700">
            {children}
          </blockquote>
        ),

        // Updated code renderer compatible with react-markdown v9+
        code({ node, className, children, ...props }) {
          // const match = /language-(\w+)/.exec(className || "");
          // const codeString = String(children).replace(/\n$/, "");

          // // Check if code block contains newlines or has language specification
          // const isCodeBlock = match || codeString.includes("\n");

          
          return (
            <code
              {...props}
              className="rounded-md bg-transparent px-1.5 py-0.5 text-white font-mono text-sm"
            >
              {children}
            </code>
          );
        },
      }}
    >
      {content}
     
    </ReactMarkdown>
  );
}