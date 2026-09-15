import ApiKeyOnboarding from "../../pages/ApiKeyOnBoarding";
import DocumentOnboarding from "../../pages/DocumentOnBording";
import type { ChatHistory } from "../../types";
import {useEffect, useRef, useState,type RefObject}  from "react"
import ChatMessage from "../analyze/ChatMessage";
import { useUser } from "../../context/Global";

interface Props {
  messages: ChatHistory[];
  IsStreaming:boolean;
  messagesContainerRef:RefObject<HTMLDivElement | null>;
}

 const ChatList=({IsStreaming,messages,messagesContainerRef}:Props)=>{
  const {user}=useUser();
  const [isAtBottom, setIsAtBottom] =
    useState(true);

  const bottomRef =useRef<HTMLDivElement | null>(null);
  
  /*
     * Detect whether the bottom sentinel
     * is currently visible.
     */
    useEffect(() => {
  
      const sentinel =
        bottomRef.current;
  
      const container =
        messagesContainerRef?.current;
  
      if (!sentinel || !container) {
        return;
      }
  
  
      const observer =
        new IntersectionObserver(
          ([entry]) => {
  
            setIsAtBottom(
              entry.isIntersecting
            );
  
          },
          {
            root: container,
  
            threshold: 0.1,
          }
        );
  
  
      observer.observe(sentinel);
  
  
      return () => {
        observer.disconnect();
      };
  
    }, [messagesContainerRef]);
    /*
     * New message or streaming chunk arrived.
     */
    useEffect(() => {
      if (!isAtBottom) {
        return;
      }
  
      bottomRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
  
    }, [messages, isAtBottom]);
  
  
    if((messages.length==0 && Number(user.count)<2) || (String(user.api_configured)=="true" && messages.length==0) ){
      return (
        <DocumentOnboarding/>
      )
    }
    else if(Number(user.count)>1 && String(user.api_configured)=="false"){
      return (
        <ApiKeyOnboarding/>
      )
    }
    else{
return (
  <div
  ref={messagesContainerRef} 
  className="flex-1 overflow-y-auto hide-scrollbar ">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6">
          {messages.map((message) => (
            <ChatMessage
            
            IsStreaming={IsStreaming}
              key={message.id}
              message={message}
            />
          ))}
          {/* IntersectionObserver sentinel */}
      <div
        ref={bottomRef}
        className="h-3  bg-none relative top-24"
      />
        </div>
      </div>
)
    }
  }

export default ChatList;