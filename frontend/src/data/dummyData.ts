import type {
  ChatHistory,
  Conversation,
  User,
} from "../types";

export const dummyUser: User = {
  name: "Ravi Prajapati",
  email: "ravi@example.com",
  id: 2
};

export const dummyConversations: Conversation[] = [
  {
    id: "conv_001",
    doc_name: "machine-learning.pdf",
  },
  {
    id: "conv_002",
    doc_name: "system-design.txt",
  },
  {
    id: "conv_003",
    doc_name: "rag-architecture.pdf",
  },
  {
    id: "conv_004",
    doc_name: "langgraph-notes.txt",
  },
];

export const dummyChatHistory: ChatHistory[] = [
  // {
  //   id: Date.now() - 5000,
  //   role: "user",
  //   content: "What is retrieval augmented generation?",
  // },
  // {
  //   id: Date.now() - 4000,
  //   role: "assistant",
  //   content:
  //     "Retrieval Augmented Generation (RAG) is an architecture that combines information retrieval with a language model. Instead of relying only on the model's pretrained knowledge, the system retrieves relevant information from an external knowledge base and provides it to the model as context.",
  // },
  // {
  //   id: Date.now() - 3000,
  //   role: "user",
  //   content: "Why is RAG useful for private documents?",
  // },
  // {
  //   id: Date.now() - 2000,
  //   role: "assistant",
  //   content:
  //     "RAG allows an application to retrieve information from private or frequently changing documents without requiring the language model to memorize that information during training. The retrieved document chunks are supplied as context when generating the answer.",
  // },
];