export interface Conversation {
  id: string;
  doc_name: string;
  user_id?: string
}

export interface ChatHistory {
  id: string;
  content: string;
  role: "user" | "assistant";
}

export interface ApiKeys {
  pinecone: string;
  groq: string;
  gemini: string;
}

export interface User {
  id: number;
  count?: number;
  name: string;
  email: string;
  groq?: string;
  pinecone?: string;
  gemini?: string;
  api_configured?: boolean
}

export interface ImageKitAuthResponse {
  token: string;
  expire: number;
  signature: string;
  imagekit_id?: string;
}

// Response schema returned by ImageKit Upload API
export interface ImageKitUploadResponse {
  fileId: string;
  name: string;
  url: string;
  thumbnailUrl: string;
  height: number;
  width: number;
  size: number;
  filePath: string;
  fileType: string;
  isPrivateFile: boolean;
  customCoordinates: string | null;
}


export interface FetchConversationOptions {
  page?: number;      // 1-based page index (default: 1)
  pageSize?: number;  // Number of records per page (default: 10)
  user_id?: number
}
export interface PaginationConversationOptions {
  page?: number;      // 1-based page index (default: 1)
  total_page?: number;  // Number of records per page (default: 10)
}