import { useState } from "react";
import { BrainCircuit, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {toast} from "react-toastify"
import Input from "../components/ui/Input";
import Button from "../components/ui/button"
import { supabase } from "../utils/supabase";
import { localUsre } from "../utils/const";
import { useUser } from "../context/Global";
// import ProcessingLoader from "../components/ui/processing_Loader";

export default function Signup() {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const {setIsLogin}=useUser()
  let [password,setpassword]=useState("")

  const handleLogin = async (e:any) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;

  
    let {data,error}=await supabase.from("users").insert({name:name,email:email,password:password})
      // let {data}=await axios.post(`http://localhost:4500/user/signup`,form)
      console.log(data)
      if(error){
        if(error.code=="23505"){
          navigate("/login");
          toast.error("This user already exist in database please login ")

        }
        else{
          
          toast.error(error?.message)
        }
  
      }
      else{
        navigate("/analyze");
        localStorage.setItem(localUsre,email)
        
        setIsLogin(true)
        
        toast.success("signup successfullly!!!")
        setName("")
        setEmail("")
        setpassword("")
        
      
    }
  
  };

  return (
    <>
    
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
            Sign UP
          </h1>

          {/* <p className="mt-2 text-sm text-slate-400">
            Enter your details to access your RAG workspace.
          </p> */}
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <Input
            label="Name"
            placeholder="Enter your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required={true}
          />

          <Input
            label="Email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required={true}
          />
          <Input
            label="Password"
            type="password"
            placeholder="ravipraj"
            value={password}
            onChange={(e) => setpassword(e.target.value)}
            required={true}
          />

          <Button
          type="submit"
            
            disabled={!name.trim() || !email.trim()}
            className="w-full gap-2 bg-blue-600 text-white hover:bg-blue-500"
          >
            Continue
            <ArrowRight size={17} />
          </Button>
        </form>
      </div>
    </main>
    </>

  );
}