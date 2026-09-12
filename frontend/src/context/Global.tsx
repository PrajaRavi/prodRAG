import React, { createContext, useContext,Dispatch,SetStateAction } from 'react';
import type { Conversation, User } from '../types';


// Define the shape of the Context type
export interface UserContextType {
  IsLogin:boolean;
  setIsLogin:Dispatch<SetStateAction<boolean>>;
  user:User
  setuser:Dispatch<SetStateAction<User>>;
  GetUserSignal:boolean;
  setGetUserSignal:Dispatch<SetStateAction<boolean>>;
  // AnalyzerPageVisible,setAnalyzerPageVisible
  AnalyzerPageVisible:boolean;
  setAnalyzerPageVisible:Dispatch<SetStateAction<boolean>>;
  ConversationHistory:Conversation[];
  setConversationHistory:Dispatch<SetStateAction<Conversation[]>>;
  ActiveConversation:Conversation;
  setActiveConversation:Dispatch<SetStateAction<Conversation>>;
}

// Create the context with an initial value of undefined
export const UserContext = createContext<UserContextType | undefined>(undefined);

// Custom hook to consume the UserContext safely
export const useUser = (): UserContextType => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserContext Provider');
  }
  return context;
};