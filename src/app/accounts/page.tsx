"use client";

import { useAuthStore, UserAccount } from "@/authStore";
import { db } from "@/firebase";
import { collection, doc, onSnapshot, setDoc, deleteDoc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { useModalStore } from "@/modalStore";
import { Shield, ShieldAlert, Key, Trash2, PlusCircle, Edit2, Headset, Mail, Phone, Clock } from "lucide-react";

export default function AccountsPage() {
    const { currentUser } = useAuthStore();
    const { showAlert, showConfirm } = useModalStore();
    const [accounts, setAccounts] = useState<UserAccount[]>([]);
    
    // Form States
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [id, setId] = useState("");
    const [password, setPassword] = useState("");
    const [displayName, setDisplayName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [role, setRole] = useState<'admin' | 'warehouse' | 'support' | 'pending_approval'>('warehouse');
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
       if (!currentUser || currentUser.role !== 'admin') return;
       
       const unsub = onSnapshot(collection(db, 'users'), (snap) => {
           const users = snap.docs.map(d => d.data() as UserAccount);
           users.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
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
            await showAlert("Vui lòng điền đủ các trường nội dung.");
            return;
        }

        try {
            const accRef = doc(db, 'users', id.trim());
            
            if (!isEditing) {
                const exists = accounts.some(u => u.id.toLowerCase() === id.trim().toLowerCase());
                if (exists) {
                    await showAlert("Cảnh báo: ID đăng nhập này ĐÃ TỒN TẠI trong hệ thống (như Admin, ADMIN)! Vui lòng chọn ID khác.");
                    return;
                }
            }

            const payload: any = {
                id: id.trim(),
                passwordHash: password.trim(),
                displayName: displayName.trim(),
                role,
                email: email.trim(),
                phone: phone.trim()
            };
            if (!isEditing) {
                payload.createdAt = Date.now();
            }
            await setDoc(accRef, payload, { merge: true });

            setIsFormOpen(false);
            setId("");
            setPassword("");
            setDisplayName("");
            setEmail("");
            setPhone("");
            setRole("warehouse");
            setIsEditing(false);
        } catch (e) {
            await showAlert("Lỗi khi kết nối Cloud.");
        }
    };

    const handleEdit = (acc: UserAccount) => {
        setId(acc.id);
        setPassword(acc.passwordHash);
        setDisplayName(acc.displayName);
        setEmail(acc.email || "");
        setPhone(acc.phone || "");
        setRole(acc.role);
        setIsEditing(true);
        setIsFormOpen(true);
    };

    const handleDelete = async (targetId: string) => {
        if (targetId === 'admin' || targetId === currentUser.id) {
            await showAlert("Không thể xoá tài khoản Admin gốc của bạn!");
            return;
        }
        if (await showConfirm(`Bạn chắc chắn muốn Hủy vĩnh viễn tài khoản: ${targetId} ?`)) {
             try {
                 await deleteDoc(doc(db, 'users', targetId));
             } catch (e) {
                 await showAlert("Lỗi xoá dữ liệu trên mây.");
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
                           setId(""); setPassword(""); setDisplayName(""); setEmail(""); setPhone(""); setRole("warehouse");
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
                            <label className="block text-sm font-bold text-slate-600 mb-2">Số điện thoại</label>
                            <input 
                                type="text" value={phone} onChange={e => setPhone(e.target.value)}
                                className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-teal-400 focus:bg-white focus:outline-none transition-colors"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-600 mb-2">Email</label>
                            <input 
                                type="email" value={email} onChange={e => setEmail(e.target.value)}
                                className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-teal-400 focus:bg-white focus:outline-none transition-colors"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-600 mb-2">Chức Vụ (Role)</label>
                            <select 
                                value={role} onChange={e => setRole(e.target.value as any)}
                                className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-teal-400 focus:bg-white focus:outline-none transition-colors font-bold"
                            >
                                <option value="pending_approval" disabled>-- Trạng Thái: Đang Chờ Duyệt --</option>
                                <option value="warehouse">Trạm Kho (Warehouse)</option>
                                <option value="support">Chăm Sóc Khách Hàng (Support)</option>
                                <option value="admin">Quản Trị Viên (Admin)</option>
                            </select>
                        </div>
                        <div className="col-span-full flex gap-3 mt-2">
                           <button type="submit" className="flex-1 bg-teal-500 hover:bg-teal-600 text-white font-bold py-4 rounded-xl shadow-md transition-colors text-lg">
                               Lưu Thông Tin
                           </button>
                           <button type="button" onClick={() => setIsFormOpen(false)} className="px-8 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl transition-colors">
                               Huỷ Bỏ
                           </button>
                        </div>
                    </form>
                </div>
            )}

        <div className="flex flex-col gap-4 mt-8">
            {accounts.map(acc => (
                <div key={acc.id} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4 relative overflow-hidden transition-all hover:border-teal-300 hover:shadow-md">
                    <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${acc.role === 'admin' ? 'bg-teal-500' : acc.role === 'support' ? 'bg-indigo-500' : acc.role === 'pending_approval' ? 'bg-rose-500' : 'bg-amber-500'}`}></div>
                    
                    <div className="flex-1 flex flex-col md:flex-row items-center gap-4 pl-3 w-full">
                        <div className="w-full md:w-64 shrink-0 flex flex-col justify-center">
                            <div className="flex items-center gap-2 mb-1.5 relative group">
                                <span className={`inline-flex items-center justify-center gap-1.5 px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${acc.role === 'admin' ? 'bg-teal-50 text-teal-700 border border-teal-100' : acc.role === 'support' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : acc.role === 'pending_approval' ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-amber-50 text-amber-700 border border-amber-100'}`}>
                                    {acc.role === 'admin' ? <Shield className="w-3 h-3" /> : acc.role === 'support' ? <Headset className="w-3 h-3" /> : acc.role === 'pending_approval' ? <ShieldAlert className="w-3 h-3" /> : <ShieldAlert className="w-3 h-3" />}
                                    {acc.role === 'support' ? 'Support' : acc.role === 'pending_approval' ? 'Chờ Duyệt' : acc.role === 'admin' ? 'Admin' : 'Warehouse'}
                                </span>
                                {acc.createdAt && (
                                    <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1 ml-2">
                                        <Clock className="w-3 h-3" />
                                        {new Date(acc.createdAt).toLocaleString('vi-VN')}
                                    </span>
                                )}
                            </div>
                            <h3 className="text-lg font-bold text-slate-800 truncate">{acc.displayName}</h3>
                            <div className="flex flex-col gap-[2px]">
                                <p className="text-slate-500 text-xs font-semibold">ID: <span className="text-slate-700">{acc.id}</span></p>
                                <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-4 text-[11px] text-slate-500 font-medium mt-1">
                                    <span className="flex items-center gap-1 pr-2 border-r border-slate-200"><Phone className="w-3 h-3 text-emerald-500" /> {acc.phone || 'Chưa cập nhật SĐT'}</span>
                                    <span className="flex items-center gap-1"><Mail className="w-3 h-3 text-rose-400" /> {acc.email || 'Chưa cập nhật Email'}</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-50 px-5 py-2.5 rounded-xl flex items-center justify-between gap-3 border border-slate-200 flex-1 w-full md:max-w-xs transition-colors hover:bg-white hover:border-teal-300">
                            <div className="flex items-center gap-3 truncate">
                                <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center shrink-0">
                                    <Key className="w-4 h-4 text-slate-400" />
                                </div>
                                <div className="truncate">
                                   <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-0.5">Mật khẩu</p>
                                   <p className="font-mono font-bold text-slate-700 text-sm tracking-widest truncate">{acc.passwordHash}</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => handleEdit(acc)} 
                                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors shrink-0"
                                title="Sửa nhanh thông tin"
                            >
                                <Edit2 className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 w-full md:w-auto px-3 md:px-0">
                        <button onClick={() => handleEdit(acc)} className="flex-1 md:flex-none px-6 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white py-3 md:py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm">
                            Sửa Quyền
                        </button>
                        <button onClick={() => handleDelete(acc.id)} className="p-3 md:p-2.5 bg-red-50 hover:bg-red-600 text-red-600 hover:text-white rounded-xl transition-all shadow-sm">
                            <Trash2 className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            ))}
        </div>
        </div>
    );
}
