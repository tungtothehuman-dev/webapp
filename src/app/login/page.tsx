"use client";

import { useAuthStore } from "@/authStore";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
   const login = useAuthStore(state => state.login);
   const register = useAuthStore(state => state.register);
   const router = useRouter();
   
   const [id, setId] = useState("");
   const [pass, setPass] = useState("");
   const [error, setError] = useState("");
   const [successMsg, setSuccessMsg] = useState("");
   const [rememberMe, setRememberMe] = useState(true);

   const [showPassword, setShowPassword] = useState(false);
   const [loading, setLoading] = useState(false);

   // Registration state
   const [isRegistering, setIsRegistering] = useState(false);
   const [regId, setRegId] = useState("");
   const [regName, setRegName] = useState("");
   const [regPass, setRegPass] = useState("");
   const [regEmail, setRegEmail] = useState("");
   const [regPhone, setRegPhone] = useState("");

   const handleLogin = async (e: React.FormEvent) => {
       e.preventDefault();
       if (!id || !pass) {
           setError("Vui lòng điền đủ Tên Đăng Nhập và Mật Khẩu");
           return;
       }

       setLoading(true);
       setError("");
       setSuccessMsg("");
       const res = await login(id, pass);
       setLoading(false);
       
       if (res === 'PENDING') {
           setError("Tài khoản đang chờ Admin phê duyệt.");
       } else if (res === true) {
           router.push('/'); 
       } else {
           setError("Tài khoản hoặc mật khẩu không chính xác.");
       }
   };

   const handleRegister = async (e: React.FormEvent) => {
       e.preventDefault();
       if (!regId || !regName || !regPass || !regEmail || !regPhone) {
           setError("Vui lòng nhập đầy đủ các trường thông tin bắt buộc.");
           return;
       }
       
       if (!/^\d{10}$/.test(regPhone.trim())) {
           setError("Số điện thoại không hợp lệ, vui lòng nhập đủ 10 số (không chứa chữ).");
           return;
       }

       setLoading(true);
       setError("");
       setSuccessMsg("");
       const res = await register(regId.trim(), regPass.trim(), regName.trim(), regEmail.trim(), regPhone.trim());
       setLoading(false);

       if (res === 'EXISTS') {
           setError("Tài khoản ID này đã tồn tại!");
       } else if (res === 'ERROR') {
           setError("Lỗi kết nối máy chủ khi đăng ký.");
       } else {
           setSuccessMsg("Đăng ký thành công! Vui lòng chờ Admin duyệt quyền.");
           setIsRegistering(false);
           // Reset forms
           setRegId("");
           setRegPass("");
           setRegName("");
           setRegEmail("");
           setRegPhone("");
       }
   };

   return (
       <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 relative overflow-hidden text-slate-800 font-sans py-12 px-4">
           {/* Background Deco */}
           <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-teal-500/10 blur-[100px] rounded-full pointer-events-none"></div>

           <div className="w-full max-w-md p-8 bg-white/90 backdrop-blur-xl border border-slate-200 rounded-3xl shadow-xl shadow-slate-200/50 relative z-10 transition-all duration-300">
               <div className="text-center mb-8">
                   <div className="w-16 h-16 rounded-2xl bg-teal-500 shadow-md shadow-teal-500/30 flex items-center justify-center font-bold text-3xl mx-auto mb-4 text-white">
                      T
                   </div>
                   <h2 className="text-2xl font-bold text-slate-800">{isRegistering ? "Đăng ký thành viên" : "Đăng nhập"}</h2>
               </div>

               {successMsg && <div className="text-teal-700 text-sm font-bold bg-teal-50 border border-teal-200 p-3 mb-5 rounded-xl shadow-sm text-center">{successMsg}</div>}
               {error && <div className="text-red-600 text-sm font-bold bg-red-50 border border-red-200 p-3 mb-5 rounded-xl shadow-sm text-center">{error}</div>}

               {isRegistering ? (
                   <form onSubmit={handleRegister} className="space-y-4">
                       <div>
                           <label className="block text-sm font-bold text-slate-600 mb-1">ID đăng nhập <span className="text-red-500">*</span></label>
                           <input 
                               type="text" 
                               value={regId}
                               onChange={e => setRegId(e.target.value)}
                               className="w-full px-4 py-2.5 rounded-xl bg-white border-2 border-slate-200 focus:outline-none focus:border-teal-400 focus:ring-4 focus:ring-teal-50 transition-all font-medium text-sm"
                               placeholder="vd: nhanvien123"
                           />
                       </div>
                       
                       <div>
                           <label className="block text-sm font-bold text-slate-600 mb-1">Tên hiển thị <span className="text-red-500">*</span></label>
                           <input 
                               type="text" 
                               value={regName}
                               onChange={e => setRegName(e.target.value)}
                               className="w-full px-4 py-2.5 rounded-xl bg-white border-2 border-slate-200 focus:outline-none focus:border-teal-400 focus:ring-4 focus:ring-teal-50 transition-all font-medium text-sm"
                               placeholder="vd: Nguyễn Văn A"
                           />
                       </div>

                       <div>
                           <label className="block text-sm font-bold text-slate-600 mb-1">Mật khẩu <span className="text-red-500">*</span></label>
                           <input 
                               type="text" 
                               value={regPass}
                               onChange={e => setRegPass(e.target.value)}
                               className="w-full px-4 py-2.5 rounded-xl bg-white border-2 border-slate-200 focus:outline-none focus:border-teal-400 focus:ring-4 focus:ring-teal-50 transition-all font-mono text-sm"
                               placeholder="Nhập mật khẩu"
                           />
                       </div>

                       <div className="grid grid-cols-2 gap-3">
                           <div>
                               <label className="block text-sm font-bold text-slate-600 mb-1">Email <span className="text-red-500">*</span></label>
                               <input 
                                   type="email" 
                                   value={regEmail}
                                   onChange={e => setRegEmail(e.target.value)}
                                   className="w-full px-4 py-2.5 rounded-xl bg-white border-2 border-slate-200 focus:outline-none focus:border-teal-400 focus:ring-4 focus:ring-teal-50 transition-all font-medium text-sm"
                                   placeholder="vd: abc@gmail.com"
                               />
                           </div>
                           <div>
                               <label className="block text-sm font-bold text-slate-600 mb-1">Số Điện Thoại <span className="text-red-500">*</span></label>
                               <input 
                                   type="tel" 
                                   value={regPhone}
                                   onChange={e => setRegPhone(e.target.value)}
                                   className="w-full px-4 py-2.5 rounded-xl bg-white border-2 border-slate-200 focus:outline-none focus:border-teal-400 focus:ring-4 focus:ring-teal-50 transition-all font-medium text-sm"
                                   placeholder="vd: 09..."
                               />
                           </div>
                       </div>

                       <div className="pt-2 flex gap-3">
                           <button type="button" disabled={loading} onClick={() => { setIsRegistering(false); setError(""); setSuccessMsg(""); }} className="flex-1 py-3 mt-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold transition-all shadow-sm">
                               Huỷ Bỏ
                           </button>
                           <button type="submit" disabled={loading} className="flex-[2] py-3 mt-2 rounded-xl bg-teal-500 hover:bg-teal-600 text-white font-bold transition-all shadow-md disabled:opacity-50">
                               {loading ? "Đang xử lý..." : "Tạo Tài Khoản"}
                           </button>
                       </div>
                   </form>
               ) : (
                   <>
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

                           <button disabled={loading} type="submit" className="w-full py-3.5 mt-2 rounded-xl bg-teal-500 hover:bg-teal-600 text-white font-bold transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed">
                               {loading ? "Đang xác thực..." : "Vào Hệ Thống"}
                           </button>
                       </form>
                       
                       <div className="mt-6 text-center text-sm font-medium text-slate-500">
                           Bạn chưa có tài khoản?{' '}
                           <span 
                               onClick={() => { setIsRegistering(true); setError(""); setSuccessMsg(""); }}
                               className="text-teal-600 hover:text-teal-700 font-bold cursor-pointer hover:underline"
                           >
                               Đăng ký ngay
                           </span>
                       </div>
                   </>
               )}
           </div>
       </div>
   )
}
