import { BrowserRouter, Routes, Route } from "react-router-dom";

import Landing from "./pages/landing"
import Login from "./pages/Login";
import Analyze from "./pages/Analyze"
import Navbar from "./components/layout/Navbar";
import Signup from "./pages/signup";
import {UserContext} from "./context/Global"
import { useEffect, useState } from "react";
import {  localUsre } from "./utils/const";
import { supabase } from "./utils/supabase";
import { toast } from "react-toastify";
import type { Conversation, FetchConversationOptions, PaginationConversationOptions, User } from "./types";
import NotFound from "./pages/NotFound";


function App() {
  let [IsLogin,setIsLogin]=useState<boolean>(false)
  let [user,setuser]=useState<User>({email:"",id:0,name:""})
  let [GetUserSignal,setGetUserSignal]=useState<boolean>(false)
  let [AnalyzerPageVisible,setAnalyzerPageVisible]=useState<boolean>(false)
  let [ConversationHistory,setConversationHistory]=useState<Conversation[]>([])
  let [ActiveConversation,setActiveConversation]=useState<Conversation>({id:"",doc_name:""})
  let [ConversationHistorySignal,setConversationHistorySignal]=useState<boolean>(false)
  let [ConversationHistoryPagination,setConversationHistoryPagination]=useState<PaginationConversationOptions>({page:1,total_page:1})
  
  




  async function handleShowMoreConversationHistory(){
    try {
      if(Number(ConversationHistoryPagination.page)>Number(ConversationHistoryPagination.total_page)){
        toast.warn("you are at end")
        return 
      }
      await getConversationHistory({page:Number(ConversationHistoryPagination.page),pageSize:6,user_id:user.id})
    } catch (error) {
      console.log(error)
    }
  }
  async function getConversationHistory({ page = 1, pageSize = 10 ,user_id}: FetchConversationOptions = {}) {
  // Calculate zero-based offsets for range query
  try {
    setConversationHistorySignal(true)
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
  console.log("get-conversation-history")
  console.log(user)
  const { data, error, count } = await supabase
    .from('conversation_history')
    .select('*', { count: 'exact' }) // Fetch data along with the total row count
    .eq("user_id",user_id)
    .order('created_at', { ascending: false }) // Sort newest first (change 'created_at' if your column name differs)
    .range(from, to);

  if (error) {
    console.error('Error fetching conversation history:', error);
    throw error;
  }
  if(page==1){
    setConversationHistory(data)
  }

  else if(page<=Number(count)){
    setConversationHistory([...ConversationHistory,...data])
  }
    
    
  setConversationHistoryPagination({page:page+1,total_page:count ? Math.ceil(count / pageSize) : 0})
  console.log(count ? Math.ceil(count / pageSize) : 0)
  // return {
  //   data,
  //   page,
  //   pageSize,
  //   totalCount: count ?? 0,
  //   totalPages: count ? Math.ceil(count / pageSize) : 0,
  //   hasMore: count ? to < count - 1 : false,
  // };
} catch (error) {
  console.log(error)
  throw new Error("something went wrong in getConversationHistory")
}finally{
    setConversationHistorySignal(false)

}
}
  
   async function GetUser(email:string){
    try {
      let {data,error}:{data:any,error:any}=await supabase.from("users").select("id,email,name,count,GROQ_API_KEY,GEMINI_API_KEY,PINECONE_API_KEY,api_configured")
                                .eq('email', email) // Filters where the email column matches
                                 // Optional: Returns a single object instead of an array of objects
        console.log(data)//->array-->empty
        if(data?.length==0){
          toast.error("You have not created an account please create an account first")
        }
        else if(error){
          console.log(error)
          toast.error("signin failed")
        }
        else{
          if(data[0].email){
            console.log(data[0])
      setuser(data[0])
          }
        }
    } catch (error) {
      console.log(error)
    }
  }

  useEffect(()=>{
    if(localStorage.getItem(localUsre)){
      GetUser(String(localStorage.getItem(localUsre)))
      setIsLogin(true)
    }

  },[IsLogin])

  useEffect(()=>{
    
if(localStorage.getItem(localUsre) && user.id!=0){
  console.log("chala")
  getConversationHistory({page:1,pageSize:6,user_id:user.id});
  
  
}
  },[user])
  return (
    <UserContext.Provider value={{IsLogin,setIsLogin,user,setuser,GetUserSignal,setGetUserSignal,AnalyzerPageVisible,setAnalyzerPageVisible,ConversationHistory,setConversationHistory,ActiveConversation,setActiveConversation}}>

    <BrowserRouter>
    {AnalyzerPageVisible==false && <Navbar />}

      <Routes>
        {/* / → Landing Page */}
        <Route path="/" element={<Landing />} />

        {/* /login → Login Page */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup/>} />

        {/* /analyze → RAG Chat Page */}
        <Route path="/analyze" element={<Analyze  ConversationHistorySignal={ConversationHistorySignal} handleShowMoreConversationHistory={handleShowMoreConversationHistory}/>} />
        {/* Must be last */}
  <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
    </UserContext.Provider>
  );
}

export default App;