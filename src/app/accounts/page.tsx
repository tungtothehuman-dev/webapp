"use client";

import { useAuthStore, UserAccount } from "@/authStore";
import { db } from "@/firebase";
import { collection, doc, onSnapshot, setDoc, deleteDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Shield, ShieldAlert, Key, Trash2, PlusCircle, Edit2 } from "lucide-react";

export default function AccountsPage() {
    const { currentUser } = useAuthStore();
    const [accounts, setAccounts] = useState<UserAccount[]>([]);
    
    // Form States
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [id, setId] = useState("");
    const [password, setPassword] = useState("");
    const [displayName, setDisplayName] = useState("");
    const [role, setRole] = useState<'admin' | 'warehouse'>('warehouse');
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
       if (!currentUser || currentUser.role !== 'admin') return;
       
       const unsub = onSnapshot(collection(db, 'users'), (snap) => {
           const users = snap.docs.map(d => d.data() as UserAccount);
           setAccounts(users);
       });
       return () => unsub();
    }, [currentUser]);

    if (!currentUser || currentUser.role !== 'admin') {
        return (
           <div className="p-8 w-full max-w-7xl mx-auto flex items-center justify-center min-h-[500px]">
               <div className="text-center font-medium text-red-600 bg-red-50 p-6 rounded-2xl border border-red-100">
                   Bạn không có quyền truy cập trang này. Rời khỏi đây ngay.
               </div>
           </div>
        );
    }

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id || !password || !displayName) {
            alert("Vui lòng điền đủ các trường nội dung.");
            return;
        }

        try {
            const accRef = doc(db, 'users', id);
            await setDoc(accRef, {
                id,
                passwordHash: password,
                displayName,
                role
            });

            setIsFormOpen(false);
            setId("");
            setPassword("");
            setDisplayName("");
            setRole("warehouse");
            setIsEditing(false);
        } catch (e) {
            alert("Lỗi khi kết nối Cloud.");
        }
    };

    const handleEdit = (acc: UserAccount) => {
        setId(acc.id);
        setPassword(acc.passwordHash);
        setDisplayName(acc.displayName);
        setRole(acc.role);
        setIsEditing(true);
        setIsFormOpen(true);
    };

    const handleDelete = async (targetId: string) => {
        if (targetId === 'admin' || targetId === currentUser.id) {
            alert("Không thể xoá tài khoản Admin gốc của bạn!");
            return;
        }
        if (confirm(`Bạn chắc chắn muốn TIÊU DIỆT vĩnh viễn tài khoản: ${targetId} ?`)) {
             try {
                 await deleteDoc(doc(db, 'users', targetId));
             } catch (e) {
                 alert("Lỗi xoá dữ liệu trên mây.");
             }
        }
    };

    return (
        <div className="w-full max-w-7xl mx-auto p-8 font-sans animate-in fade-in zoom-in-95 duration-500 relative">
            <div className="flex items-center justify-between mb-8">
                <div>
                   <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight flex items-center gap-3">
                       <Shield className="w-8 h-8 text-teal-600" />
                       Hệ Thống Phân Quyền
                   </h2>
                   <p className="text-slate-500 mt-2 font-medium">Bảo mật cấp độ siêu việt - Quản lý nhân sự và Trạm Kho</p>
                </div>
                {!isFormOpen && (
                   <button 
                       onClick={() => {
                           setIsEditing(false); 
                           setId(""); setPassword(""); setDisplayName(""); setRole("warehouse");
                           setIsFormOpen(true);
                       }}
                       className="bg-[#1c2434] hover:bg-[#2b354b] text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-slate-900/20 transition-all hover:-translate-y-1 flex items-center gap-2"
                   >
                       <PlusCircle className="w-5 h-5" />
                       Cấp Thẻ Nhân Viên Mới
                   </button>
                )}
            </div>

            {isFormOpen && (
                <div className="bg-white p-6 rounded-3xl border-2 border-teal-100 shadow-xl shadow-teal-50 mb-10 animate-in slide-in-from-top-4 duration-300">
                    <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                        {isEditing ? <Edit2 className="w-5 h-5 text-amber-500" /> : <PlusCircle className="w-5 h-5 text-teal-500" />}
                        {isEditing ? `Sửa hồ sơ: ${id}` : "Đăng ký Khai sinh Tài khoản Mới"}
                    </h3>
                    <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div>
                            <label className="block text-sm font-bold text-slate-600 mb-2">Tên Đăng Nhập (ID)</label>
                            <input 
                                disabled={isEditing}
                                type="text" value={id} onChange={e => setId(e.target.value)}
                                className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-teal-400 focus:bg-white focus:outline-none transition-colors disabled:opacity-50"
                                placeholder="Ví dụ: nhanvien_1"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-600 mb-2">Mật Khẩu</label>
                            <input 
                                type="text" value={password} onChange={e => setPassword(e.target.value)}
                                className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-teal-400 focus:bg-white focus:outline-none transition-colors"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-600 mb-2">Tên Hiển Thị</label>
                            <input 
                                type="text" value={displayName} onChange={e => setDisplayName(e.target.value)}
                                className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-teal-400 focus:bg-white focus:outline-none transition-colors"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-600 mb-2">Chức Vụ (Role)</label>
                            <select 
                                value={role} onChange={e => setRole(e.target.value as any)}
                                className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-teal-400 focus:bg-white focus:outline-none transition-colors font-bold"
                            >
                                <option value="warehouse">Trạm Kho (Warehouse)</option>
                                <option value="admin">Quản Trị Viên (Admin)</option>
                            </select>
                        </div>
                        <div className="col-span-full flex gap-3 mt-2">
                           <button type="submit" className="flex-1 bg-teal-500 hover:bg-teal-600 text-white font-bold py-4 rounded-xl shadow-md transition-colors text-lg">
                               Lưu Lên Đám Mây
                           </button>
                           <button type="button" onClick={() => setIsFormOpen(false)} className="px-8 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl transition-colors">
                               Huỷ Bỏ
                           </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
                {accounts.map(acc => (
                    <div key={acc.id} className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xl shadow-slate-200/40 relative group overflow-hidden transition-all hover:border-teal-200 hover:shadow-teal-100/50">
                        <div className={`absolute top-0 left-0 w-1 h-full ${acc.role === 'admin' ? 'bg-teal-500' : 'bg-amber-500'}`}></div>
                        
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-3 ${acc.role === 'admin' ? 'bg-teal-50 text-teal-700' : 'bg-amber-50 text-amber-700'}`}>
                                    {acc.role === 'admin' ? <Shield className="w-3.5 h-3.5" /> : <ShieldAlert className="w-3.5 h-3.5" />}
                                    {acc.role}
                                </span>
                                <h3 className="text-xl font-bold text-slate-800">{acc.displayName}</h3>
                                <p className="text-slate-500 text-sm font-medium mt-1">ID: <span className="text-slate-700">{acc.id}</span></p>
                            </div>
                        </div>

                        <div className="bg-slate-50 p-4 rounded-2xl flex items-center justify-between mb-6 border border-slate-100">
                            <div className="flex items-center gap-3">
                                <Key className="w-5 h-5 text-slate-400" />
                                <div>
                                   <p className="text-xs text-slate-500 font-medium mb-1">Mật khẩu Đăng nhập</p>
                                   <p className="font-mono font-bold text-slate-700">{acc.passwordHash}</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button onClick={() => handleEdit(acc)} className="flex-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 py-2.5 rounded-xl text-sm font-bold transition-colors">
                                Sửa Quyền
                            </button>
                            <button onClick={() => handleDelete(acc.id)} className="px-4 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition-colors">
                                <Trash2 className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
