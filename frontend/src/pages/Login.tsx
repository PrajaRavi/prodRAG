import { useState } from "react";
import { BrainCircuit, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {toast} from "react-toastify"
import Input from "../components/ui/Input";
import Button from "../components/ui/button"
import { supabase } from "../utils/supabase";
import { localUsre } from "../utils/const";
import { useUser } from "../context/Global";

export default function Login() {
  const navigate = useNavigate();

  const [password, setpassword] = useState("");
  const {setIsLogin}=useUser()
  const [email, setEmail] = useState("");

  const handleLogin = async (e:any) => {
    e.preventDefault();
    if (!password.trim() || !email.trim()) return;


  
    
    let {data,error}:{data:any,error:any}=await supabase.from("users").select("*")
                          .eq('email', email) // Filters where the email column matches
                           // Optional: Returns a single object instead of an array of objects
  console.log(data)//->array-->empty
  if(data?.length==0){
    toast.error("You have not created an account please create an account first")
    navigate("/signup")
  }
  else if(error){
    console.log(error)
    toast.error("signin failed")
  }
  else{
    if(data[0].email){
      if(data[0].password==password){
        localStorage.setItem(localUsre,email)
        setIsLogin(true)
        
        navigate("/analyze");
}
else{
  toast.warn("invalid credentials")
}
      // toast.warn("this emal alre")
    }
    
  }
  console.log(error)//->null-->null
  
  
  };

  return (
    <main className="flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-5">
      {/* Background decoration */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/4 top-1/4 h-72 w-72 rounded-full bg-blue-600/10 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 h-72 w-72 rounded-full bg-violet-600/10 blur-3xl" />
      </div>

      <div
        className="relative w-full max-w-md animate-[fadeIn_0.5s_ease-out]
        rounded-2xl border border-white/10 bg-white/3
        p-7 shadow-2xl backdrop-blur-xl sm:p-9"
      >
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/10">
            <BrainCircuit className="text-blue-400" size={28} />
          </div>

          <h1 className="text-2xl font-semibold text-white">
            Welcome back
          </h1>

          <p className="mt-2 text-sm text-slate-400">
            Enter your details to access your RAG workspace.
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          
          <Input
            label="Email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            label="Password"
            type="password"
            placeholder="you@example.com"
            value={password}
            onChange={(e) => setpassword(e.target.value)}
          />

          <Button
            type="submit"
            disabled={!password.trim() || !email.trim()}
            className="w-full gap-2 bg-blue-600 text-white hover:bg-blue-500"
          >
            Continue
            <ArrowRight size={17} />
          </Button>
        </form>
      </div>
    </main>
  );
}