"use client";

import { useAuthStore } from "@/authStore";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
    const { currentUser, updateProfile } = useAuthStore();
    const router = useRouter();
    
    const [displayName, setDisplayName] = useState("");
    const [password, setPassword] = useState("");
    const [message, setMessage] = useState<{ type: 'success'|'error', text: string } | null>(null);

    useEffect(() => {
        if (currentUser) {
            setDisplayName(currentUser.displayName);
        }
    }, [currentUser]);

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!displayName.trim()) {
            setMessage({ type: 'error', text: 'Tên hiển thị không được để trống' });
            return;
        }

        updateProfile(displayName, password);
        setMessage({ type: 'success', text: 'Cập nhật tài khoản thành công! Đang chuyển hướng...' });
        setPassword(""); // Xóa pass rỗng để khỏi bối rối
        
        setTimeout(() => {
            router.push('/');
        }, 1000); // 1 giây delay trước khi ẩn (thoát ra trang chủ)
    };

    if (!currentUser) return null;

    return (
        <div className="max-w-3xl mx-auto mt-10">
            <h2 className="text-3xl font-bold mb-8 flex items-center gap-3 text-slate-800">
               <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/30">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
               </div>
               Cài đặt Tài khoản
            </h2>

            <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm relative overflow-hidden">
                {/* Trang trí tĩnh */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 blur-3xl rounded-full pointer-events-none -translate-y-1/2 translate-x-1/2"></div>
                
                <div className="flex items-center gap-6 mb-8 border-b border-slate-200 pb-8 relative z-10">
                    <div className="w-24 h-24 rounded-full bg-slate-100 flex items-center justify-center text-4xl font-bold border-4 border-white shadow-md text-indigo-600">
                       {displayName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <p className="text-xl font-bold text-slate-800">{currentUser.id}</p>
                        <p className="text-slate-500 capitalize flex items-center gap-2 mt-1 font-medium">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                            Vai trò: {currentUser.role === 'admin' ? 'Quản Trị Viên' : currentUser.role === 'support' ? 'Chăm sóc Khách hàng' : 'Kho US'}
                        </p>
                    </div>
                </div>

                <form onSubmit={handleSave} className="space-y-6 max-w-xl relative z-10">
                    <div>
                        <label className="block text-sm font-bold text-slate-600 mb-2">Tên hiển thị (Tự do)</label>
                        <input 
                            type="text" 
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl bg-white border-2 border-slate-200 text-slate-800 focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 transition-all font-medium shadow-sm"
                            placeholder="Nhập tên hiển thị..."
                        />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-bold text-slate-600 mb-2">Cập nhật Mật khẩu mới</label>
                        <input 
                            type="password" 
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl bg-white border-2 border-slate-200 text-slate-800 focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 transition-all font-mono shadow-sm"
                            placeholder="Chỉ nhập khi muốn đổi mật khẩu mới..."
                        />
                        <p className="text-xs text-slate-500 mt-2 font-medium">Bỏ trống ô này nếu sếp chỉ muốn giữ nguyên mật khẩu cũ nghen.</p>
                    </div>

                    {message && (
                        <div className={`p-4 rounded-xl text-sm font-bold shadow-sm ${message.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
                            {message.text}
                        </div>
                    )}

                    <div className="pt-4">
                        <button type="submit" className="px-8 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all shadow-md flex items-center gap-2">
                            Lưu cấu hình
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
