"use client";

import { useAuthStore } from "@/authStore";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
   const login = useAuthStore(state => state.login);
   const router = useRouter();
   
   const [id, setId] = useState("");
   const [pass, setPass] = useState("");
   const [error, setError] = useState("");
   const [rememberMe, setRememberMe] = useState(true);

   const [showPassword, setShowPassword] = useState(false);
   const [loading, setLoading] = useState(false);

   const handleLogin = async (e: React.FormEvent) => {
       e.preventDefault();
       if (!id || !pass) {
           setError("Vui lòng điền đủ Tên Đăng Nhập và Mật Khẩu");
           return;
       }

       setLoading(true);
       setError("");
       const success = await login(id, pass);
       setLoading(false);
       
       if (success) {
           router.push('/'); 
       } else {
           setError("Tài khoản hoặc mật khẩu không chính xác.");
       }
   };

   return (
       <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 relative overflow-hidden text-slate-800 font-sans">
           {/* Background Deco */}
           <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-teal-500/10 blur-[100px] rounded-full pointer-events-none"></div>

           <div className="w-full max-w-md p-8 bg-white/90 backdrop-blur-xl border border-slate-200 rounded-3xl shadow-xl shadow-slate-200/50 relative z-10">
               <div className="text-center mb-8">
                   <div className="w-16 h-16 rounded-2xl bg-teal-500 shadow-md shadow-teal-500/30 flex items-center justify-center font-bold text-3xl mx-auto mb-4 text-white">
                      T
                   </div>
                   <h2 className="text-2xl font-bold text-slate-800">Đăng nhập</h2>
               </div>

               <form onSubmit={handleLogin} className="space-y-5">
                   <div>
                       <label className="block text-sm font-bold text-slate-600 mb-2">Tên đăng nhập (ID)</label>
                       <input 
                           type="text" 
                           value={id}
                           onChange={e => setId(e.target.value)}
                           className="w-full px-4 py-3 flex-1 rounded-xl bg-white border-2 border-slate-200 text-slate-800 focus:outline-none focus:border-teal-400 focus:ring-4 focus:ring-teal-50 transition-all font-medium shadow-sm"
                           placeholder="Ví dụ: admin hoặc us_warehouse"
                       />
                   </div>

                   <div>
                       <label className="block text-sm font-bold text-slate-600 mb-2">Mật khẩu</label>
                       <div className="relative">
                           <input 
                               type={showPassword ? "text" : "password"}
                               value={pass}
                               onChange={e => setPass(e.target.value)}
                               className="w-full px-4 py-3 pr-12 rounded-xl bg-white border-2 border-slate-200 text-slate-800 focus:outline-none focus:border-teal-400 focus:ring-4 focus:ring-teal-50 transition-all font-mono shadow-sm"
                               placeholder="••••••••"
                           />
                           <button 
                               type="button"
                               onClick={() => setShowPassword(!showPassword)}
                               className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-teal-600 focus:outline-none"
                           >
                               {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                           </button>
                       </div>
                   </div>

                   <div className="flex items-center gap-2 pt-1 pb-1">
                       <input 
                           type="checkbox" 
                           id="remember"
                           checked={rememberMe}
                           onChange={e => setRememberMe(e.target.checked)}
                           className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer accent-teal-500"
                       />
                       <label htmlFor="remember" className="text-sm font-medium text-slate-600 cursor-pointer select-none">
                           Ghi nhớ đăng nhập
                       </label>
                   </div>

                   {error && <div className="text-red-600 text-sm font-bold bg-red-50 border border-red-200 p-3 rounded-xl shadow-sm">{error}</div>}

                   <button disabled={loading} type="submit" className="w-full py-3.5 mt-2 rounded-xl bg-teal-500 hover:bg-teal-600 text-white font-bold transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed">
                       {loading ? "Đang xác thực..." : "Vào Hệ Thống"}
                   </button>
               </form>
           </div>
       </div>
   )
}
