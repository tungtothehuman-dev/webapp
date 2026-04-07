"use client";

import { useState, useEffect } from "react";
import { useWarehouseStore, WarehouseItem } from "@/store";
import { doc, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/firebase";
import { useAuthStore } from "@/authStore";
import { useModalStore } from "@/modalStore";

export default function WarehousesPage() {
  const { warehouses, addWarehouse, updateWarehouse, deleteWarehouse } = useWarehouseStore();
  const { showAlert, showConfirm } = useModalStore();
  
  const [newWarehouseName, setNewWarehouseName] = useState("");
  const [newWarehouseAddress, setNewWarehouseAddress] = useState("");
  const [newReceiverName, setNewReceiverName] = useState("");
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAddress, setEditAddress] = useState("");
  const [editReceiverName, setEditReceiverName] = useState("");

  const [mounted, setMounted] = useState(false);
  const { currentUser } = useAuthStore();
  
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  if (!currentUser || currentUser.role !== 'admin') {
      return (
         <div className="p-8 w-full max-w-7xl mx-auto flex items-center justify-center min-h-[500px]">
             <div className="text-center font-medium text-red-600 bg-red-50 p-6 rounded-2xl border border-red-100">
                 Bạn không có quyền quản lý Trạm Kho.
             </div>
         </div>
      );
  }

  // Xử lý chuẩn hóa data (Vì trước đây lưu mảng string)
  const normalizedWarehouses = warehouses.map(w => {
      if (typeof w === 'string') {
          return { id: w, name: w, address: "", receiverName: "" } as WarehouseItem;
      }
      return w;
  });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newWarehouseName.trim();
    if (!name) return;
    
    if (normalizedWarehouses.find(w => w.name === name)) {
        await showAlert("Tên kho này đã tồn tại!");
        return;
    }
    
    const newData = {
       id: name,
       name: name,
       address: newWarehouseAddress.trim(),
       receiverName: newReceiverName.trim()
    };
    addWarehouse(newData);
    
    // Đồng bộ lên hệ thống
    try {
        setDoc(doc(db, 'warehouses', name), newData);
    } catch(err) { console.error("Lỗi Firebase:", err); }
    setNewWarehouseName("");
    setNewWarehouseAddress("");
    setNewReceiverName("");
  };

  const handleDelete = async (id: string) => {
    if (await showConfirm(`Bạn có chắc chắn muốn xóa kho "${id}" khỏi danh sách?`)) {
        deleteWarehouse(id);
        deleteDoc(doc(db, 'warehouses', id));
    }
  };

  const startEdit = (w: WarehouseItem) => {
      setEditingId(w.id);
      setEditAddress(w.address || "");
      setEditReceiverName(w.receiverName || "");
  };

  const saveEdit = (id: string) => {
      const updates = { address: editAddress.trim(), receiverName: editReceiverName.trim() };
      updateWarehouse(id, updates);
      setEditingId(null);
      
      // Đẩy lên Firebase để đồng bộ sang PC khác
      const wh = warehouses.find(w => w.id === id);
      if (wh) {
          setDoc(doc(db, 'warehouses', id), { ...wh, ...updates }, { merge: true });
      }
  };

  return (
    <div className="flex flex-col h-full max-w-5xl mx-auto mt-8">
        {/* Header */}
        <div className="mb-8 border-b border-neutral-800 pb-6">
            <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-teal-600 to-teal-400 flex items-center gap-3">
               <svg className="w-8 h-8 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>
               Quản Lý Thông Tin Kho Mỹ
            </h2>
            <p className="text-neutral-400 mt-2">Đăng ký mới hoặc thiết lập địa chỉ chi tiết cho từng trạm HUB nhận hàng.</p>
        </div>

        {/* Form Thêm Kho */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-8 shadow-sm">
            <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-400 mb-4">Thêm Kho Mới</h3>
            <form onSubmit={handleAdd} className="flex flex-col lg:flex-row gap-4 items-end">
                <div className="flex-1 w-full">
                    <label className="block text-xs font-bold text-slate-500 mb-2">Tên Kho</label>
                    <input 
                        type="text" 
                        value={newWarehouseName}
                        onChange={(e) => setNewWarehouseName(e.target.value)}
                        placeholder="VD: HUB Cali..." 
                        className="w-full bg-white border-2 border-indigo-400 rounded-xl px-4 py-3 text-indigo-900 font-bold outline-none focus:border-indigo-600 transition-colors shadow-sm placeholder-slate-400"
                    />
                </div>
                <div className="flex-1 w-full">
                    <label className="block text-xs font-bold text-slate-500 mb-2">Tên Người Nhận (Tùy chọn)</label>
                    <input 
                        type="text" 
                        value={newReceiverName}
                        onChange={(e) => setNewReceiverName(e.target.value)}
                        placeholder="VD: John Doe..." 
                        className="w-full bg-white border-2 border-indigo-400 rounded-xl px-4 py-3 text-indigo-900 font-bold outline-none focus:border-indigo-600 transition-colors shadow-sm placeholder-slate-400"
                    />
                </div>
                <div className="flex-[1.5] w-full">
                    <label className="block text-xs font-bold text-slate-500 mb-2">Địa Chỉ (Tùy chọn)</label>
                    <input 
                        type="text" 
                        value={newWarehouseAddress}
                        onChange={(e) => setNewWarehouseAddress(e.target.value)}
                        placeholder="123 ABC Street, City, ZIP..." 
                        className="w-full bg-white border-2 border-indigo-400 rounded-xl px-4 py-3 text-indigo-900 font-bold outline-none focus:border-indigo-600 transition-colors shadow-sm placeholder-slate-400"
                    />
                </div>
                <button type="submit" className="w-full lg:w-auto px-6 py-3 bg-teal-500 hover:bg-teal-600 text-white font-bold rounded-xl shadow-md transition flex items-center justify-center gap-2 border border-teal-600/50">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                    Thêm
                </button>
            </form>
        </div>

        {/* Danh Sách Các Kho */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-6 py-5 bg-slate-50 border-b border-slate-200">
                <h3 className="font-bold text-slate-800 text-lg">Danh Sách Hiện Tại ({normalizedWarehouses.length})</h3>
            </div>
            
            {normalizedWarehouses.length === 0 ? (
                <div className="p-12 text-center text-slate-400">
                    Chưa có kho nào được thiết lập. Vui lòng thêm kho mới!
                </div>
            ) : (
                <ul className="divide-y divide-slate-100">
                    {normalizedWarehouses.map((wh, idx) => (
                        <li key={wh.id} className="p-6 hover:bg-slate-50 transition group flex flex-col md:flex-row md:items-start justify-between gap-4">
                            <div className="flex gap-5 flex-1">
                                <div className="w-12 h-12 rounded-full bg-teal-50 text-teal-600 flex items-center justify-center font-bold border border-teal-200 flex-shrink-0 mt-1 shadow-sm">
                                    {idx + 1}
                                </div>
                                <div className="flex-1">
                                    <h4 className="font-bold text-xl text-slate-800">{wh.name}</h4>
                                    
                                    {/* Edit Mode */}
                                    {editingId === wh.id ? (
                                        <div className="mt-3 flex flex-col items-start xl:flex-row gap-3">
                                            <input 
                                                type="text" 
                                                value={editReceiverName}
                                                onChange={(e) => setEditReceiverName(e.target.value)}
                                                placeholder="Người nhận..." 
                                                className="w-full xl:w-48 bg-white border-2 border-indigo-400 rounded-lg px-3 py-2 text-sm text-indigo-900 font-bold outline-none focus:border-indigo-600 transition-colors shadow-sm"
                                            />
                                            <input 
                                                type="text" 
                                                autoFocus
                                                value={editAddress}
                                                onChange={(e) => setEditAddress(e.target.value)}
                                                placeholder="Nhập địa chỉ nhà kho..." 
                                                className="flex-1 w-full bg-white border-2 border-indigo-400 rounded-lg px-3 py-2 text-sm text-indigo-900 font-bold outline-none focus:border-indigo-600 transition-colors shadow-sm"
                                            />
                                            <div className="flex gap-2 w-full xl:w-auto xl:justify-end">
                                                <button onClick={() => saveEdit(wh.id)} className="flex-1 xl:flex-none px-4 py-2 bg-teal-500 hover:bg-teal-600 border border-teal-600/50 text-white rounded-lg text-sm font-bold transition shadow-sm">
                                                    Lưu
                                                </button>
                                                <button onClick={() => setEditingId(null)} className="flex-1 xl:flex-none px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-600 rounded-lg text-sm font-bold transition shadow-sm">
                                                    Hủy
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="mt-2 space-y-1">
                                            <div className="flex items-start gap-2 text-slate-500 group/address cursor-pointer" onClick={() => startEdit(wh)}>
                                                <svg className="w-4 h-4 mt-0.5 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                                                <span className="text-sm font-medium">
                                                    {wh.receiverName ? <strong className="text-slate-700">{wh.receiverName}</strong> : <span className="italic opacity-70">Chưa có tên Người nhận (Nhấn để sửa)</span>}
                                                </span>
                                            </div>
                                            <div className="flex items-start gap-2 text-slate-500 group/address cursor-pointer" onClick={() => startEdit(wh)}>
                                                <svg className="w-4 h-4 mt-0.5 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                                                <span className="text-sm font-medium">
                                                    {wh.address ? wh.address : <span className="italic opacity-70">Chưa có địa chỉ (Nhấp để sửa)</span>}
                                                </span>
                                                <svg className="w-4 h-4 opacity-0 group-hover/address:opacity-100 text-teal-500 transition ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <button 
                                onClick={() => handleDelete(wh.id)}
                                className="md:self-start p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition opacity-0 group-hover:opacity-100 mt-2 md:mt-0 outline-none"
                                title="Xóa Kho này"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    </div>
  );
}
