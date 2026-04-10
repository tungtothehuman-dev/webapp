"use client";

import { useState, useRef, useEffect } from "react";
import { useOrderStore, usePackageStore, useWarehouseStore, PackageRow } from "@/store";
import { useAuthStore } from "@/authStore";
import { useRouter } from "next/navigation";
import { useModalStore } from "@/modalStore";
import { db } from '@/firebase';
import { doc, getDoc, setDoc, deleteDoc, writeBatch, collection, getDocs } from 'firebase/firestore';

export default function PackagesPage() {
  const router = useRouter();
  const { orders, updateOrder } = useOrderStore();
  const { packages, addPackage, deletePackage, clearPackages, updatePackage } = usePackageStore();
  const { warehouses } = useWarehouseStore();
  const { currentUser } = useAuthStore();
  const { showAlert, showConfirm } = useModalStore();

  // Modals & Filters
  const [isCreating, setIsCreating] = useState(false);
  const [filterDest, setFilterDest] = useState("All");
  const [editingTrackId, setEditingTrackId] = useState<string | null>(null);
  
  
  // Data for Create Modal
  const firstWarehouse = warehouses.length > 0 ? (typeof warehouses[0] === 'string' ? warehouses[0] : warehouses[0].name) : "";
  const [destination, setDestination] = useState(firstWarehouse);



  // Handle Create Package
  const handleCreatePackage = async () => {
      const now = new Date();
      const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')} ${now.getDate().toString().padStart(2, '0')}/${(now.getMonth()+1).toString().padStart(2, '0')}/${now.getFullYear()}`;
      
      // Format: TX03042026-1
      const destCode = destination.replace("HUB ", "").trim();
      const datePart = `${now.getDate().toString().padStart(2, '0')}${(now.getMonth()+1).toString().padStart(2, '0')}${now.getFullYear()}`;
      const prefix = `${destCode}${datePart}`;
      
      // Đếm số lượng kiện được tạo trong ngày hôm nay cho kho này để tính số thứ tự
      const countToday = packages.filter(p => p.id.startsWith(prefix)).length;
      let sequence = countToday + 1;
      let newId = `${prefix}-${sequence}`;

      // Bốc số thứ tự an toàn: Lên mây check xem có ai vừa tạo mã này không, nếu có thì tăng số lên 1
      let isIdUsed = true;
      try {
          while (isIdUsed) {
              const docSnap = await getDoc(doc(db, 'packages', newId));
              if (docSnap.exists()) {
                  sequence++;
                  newId = `${prefix}-${sequence}`;
              } else {
                  isIdUsed = false;
              }
          }
      } catch (e) {
          console.error("Lỗi getDoc rà trùng lặp:", e);
      }

      const newPkg: PackageRow = {
          id: newId,
          destination,
          labelType: "Label FedEx", // Lõi ẩn, không dùng trên UI
          description: "",
          createdAt: timeString,
          status: 'Khởi tạo',
          orderDescriptions: []
      };

      addPackage(newPkg);
      // Đẩy lên Firebase để đồng bộ sang các máy khác
      setDoc(doc(db, 'packages', newId), newPkg).catch(e => console.error("Lỗi tạo kiện trên mây:", e));
      
      setIsCreating(false);
      router.push(`/packages/${newId}`);
  };



  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Reset page when filter changes
  useEffect(() => {
      setCurrentPage(1);
  }, [filterDest]);

  const displayedPackages = [...packages].filter(p => filterDest === "All" || p.destination === filterDest);
  const totalPages = Math.ceil(displayedPackages.length / itemsPerPage);
  const paginatedPackages = displayedPackages.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleClearPackages = async () => {
      const hasData = packages.some(p => p.orderDescriptions && p.orderDescriptions.length > 0);
      if (hasData) {
          await showAlert("Lệnh bị từ chối: Đang có kiện chứa dữ liệu đơn hàng!\n\nBạn chỉ được phép ấn Xóa tất cả khi mọi kiện đều là kiện rỗng để tránh thất thoát dữ liệu.");
          return;
      }
      if (await showConfirm("Chắc chắn muốn xóa sạch danh sách tất cả các kiện RỖNG hiện tại không?")) {
          clearPackages();
          // Xóa toàn bộ kiện trên Firebase
          try {
              const snapshot = await getDocs(collection(db, 'packages'));
              const batch = writeBatch(db);
              snapshot.docs.forEach(d => batch.delete(d.ref));
              await batch.commit();
          } catch (e) {
              console.error("Lỗi xóa hàng loạt kiện:", e);
          }
      }
  };

  return (
    <div className="flex flex-col h-full">
        {/* Header & Controls Dashboard Style */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-8">
            <div className="flex-1">
               <h2 className="text-3xl font-bold text-slate-800 tracking-tight">Danh Sách Kiện Hàng</h2>

            </div>
            
            <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
                <div className="flex items-center bg-white border border-slate-200 p-1.5 rounded-2xl shadow-sm overflow-x-auto max-w-full custom-scrollbar">
                    <button 
                        onClick={() => setFilterDest("All")}
                        className={`px-5 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${filterDest === "All" ? 'bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-200' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
                    >
                        Tất Cả
                    </button>
                    {warehouses.map(wh => {
                        const whName = typeof wh === 'string' ? wh : wh.name;
                        return (
                            <button 
                                key={whName}
                                onClick={() => setFilterDest(whName)}
                                className={`px-5 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${filterDest === whName ? 'bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-200' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
                            >
                                {whName}
                            </button>
                        );
                    })}
                </div>
                
                <div className="flex items-center gap-3 shrink-0">
                   <button 
                       onClick={async () => {
                           try {
                               const snapshot = await getDocs(collection(db, 'packages'));
                               const firebaseIds = new Set(snapshot.docs.map(d => d.id));
                               const missingPackages = packages.filter(p => !firebaseIds.has(p.id));
                               
                               if (missingPackages.length === 0) {
                                   await showAlert("Mọi kiện hàng trên máy này đều đã được đồng bộ lên Mây!");
                                   return;
                               }
                               
                               const batch = writeBatch(db);
                               missingPackages.forEach(pkg => batch.set(doc(db, 'packages', pkg.id), pkg));
                               await batch.commit();
                               await showAlert(`Đã cứu hộ và Đẩy Thành Công ${missingPackages.length} kiện lên hệ thống đám mây! Giờ các máy khác đã có thể nhìn thấy.`);
                           } catch (e: any) {
                               await showAlert("Lỗi đồng bộ: " + e.message);
                           }
                       }}
                       className="px-4 py-2.5 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-xl font-bold border border-amber-200 transition-colors flex items-center gap-2 shadow-sm"
                       title="Ấn nút này nếu tạo kiện rồi mà trình duyệt khác không thấy"
                   >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                        Ép Đồng Bộ Lên Mây
                   </button>
                   <button 
                      onClick={() => setIsCreating(true)}
                      className="px-6 py-2.5 bg-[#4F46E5] hover:bg-[#4338CA] text-white rounded-xl font-bold shadow-md shadow-indigo-500/30 transition-transform active:scale-95 flex items-center gap-2 border border-indigo-400"
                   >
                       <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                       Tạo Kiện Mới
                   </button>
                </div>
            </div>
        </div>

        {/* Danh sách Kiện hàng */}
        {displayedPackages.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center mt-4 shadow-sm">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-200">
                    <svg className="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg>
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-2">Chưa có Kiện hàng nào</h3>
                <p className="text-slate-500 text-sm font-medium">Bấm Tạo Kiện Mới để mở mã Kiện, sau đó quét các đơn lẻ vào trong Kiện.</p>
            </div>
        ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col min-h-0">
                <div className="overflow-x-auto overflow-y-auto custom-scrollbar flex-1">
                    <table className="w-full text-left border-collapse min-w-[900px]">
                        <thead className="sticky top-0 z-20 bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-5 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Tên kiện</th>
                                <th className="px-5 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Kho đến</th>
                                <th className="px-5 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Ngày tạo</th>
                                <th className="px-5 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Ngày đóng</th>
                                <th className="px-5 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap text-center">Số lượng đơn</th>
                                <th className="px-5 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Trạng thái kiện</th>
                                <th className="px-5 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Track kiện</th>
                                {currentUser?.role !== 'support' && (
                                    <th className="px-5 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap text-center">Thao tác</th>
                                )}
                            </tr>
                        </thead>
                        <tbody className="bg-white">
                            {paginatedPackages.map((pkg) => {
                                const orderCount = pkg.orderDescriptions.filter((code: string) => {
                                    const orderData = orders.find(x => x.Description === code);
                                    if (!orderData) return false;
                                    const pkgContainingOrder = packages.find(p => p.id !== pkg.id && p.orderDescriptions.includes(code));
                                    return !pkgContainingOrder && (orderData.Status === 'Đóng kiện' || orderData.Status === 'Kho Mỹ đã scan');
                                }).length;

                                return (
                                    <tr 
                                        key={pkg.id} 
                                        onClick={() => router.push(`/packages/${pkg.id}`)}
                                        className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors cursor-pointer group"
                                    >
                                        <td className="px-5 py-3 whitespace-nowrap">
                                            <span className="font-bold text-slate-800 font-mono text-sm">{pkg.id}</span>
                                        </td>
                                        <td className="px-5 py-3 whitespace-nowrap">
                                            <span className="font-bold text-indigo-700 text-sm leading-none bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-100">{pkg.destination}</span>
                                        </td>
                                        <td className="px-5 py-3 whitespace-nowrap text-sm font-medium text-slate-600">
                                            {pkg.createdAt}
                                        </td>
                                        <td className="px-5 py-3 whitespace-nowrap text-sm font-medium text-slate-600">
                                            {pkg.status.includes('Đã xuất kho') ? ((pkg as any).closedAt || "Đã đóng") : "-"}
                                        </td>
                                        <td className="px-5 py-3 whitespace-nowrap text-center">
                                            <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 font-extrabold text-xs">
                                                {orderCount}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3 whitespace-nowrap">
                                            <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider whitespace-nowrap border ${pkg.status.includes('Đã xuất kho') ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                                                {pkg.status.includes('Đã xuất kho') ? 'ĐÃ XUẤT KHO' : pkg.status}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                                            {editingTrackId === pkg.id ? (
                                                <div className="relative flex items-center min-w-[220px] max-w-[240px]">
                                                    <input
                                                        autoFocus
                                                        type="text"
                                                        placeholder="Nhập track..."
                                                        defaultValue={pkg.masterTracking || ''}
                                                        className="w-full px-3 py-1.5 text-[13px] font-mono font-bold text-slate-800 bg-white border border-indigo-500 rounded ring-1 ring-indigo-500 outline-none shadow-sm transition-all pr-8"
                                                        onBlur={(e) => {
                                                            const newVal = e.target.value.trim();
                                                            setEditingTrackId(null);
                                                            if (newVal !== (pkg.masterTracking || '')) {
                                                                updatePackage(pkg.id, { masterTracking: newVal });
                                                                import('@/firebase').then(({ db }) => {
                                                                    import('firebase/firestore').then(({ doc, updateDoc }) => {
                                                                       updateDoc(doc(db, 'packages', pkg.id), { masterTracking: newVal }).catch(err => {
                                                                            console.error("Lỗi đồng bộ mã kiện:", err);
                                                                       });
                                                                    });
                                                                });
                                                            }
                                                        }}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                e.currentTarget.blur();
                                                            } else if (e.key === 'Escape') {
                                                                setEditingTrackId(null);
                                                            }
                                                        }}
                                                    />
                                                    <div className="absolute right-2.5 text-indigo-500 pointer-events-none">
                                                        <svg className="w-4 h-4 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M5 13l4 4L19 7"></path></svg>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 max-w-[240px] group/track">
                                                    <span className={`text-[13px] font-mono font-bold truncate ${pkg.masterTracking ? 'text-slate-800' : 'text-slate-400 italic font-normal'}`}>
                                                        {pkg.masterTracking || "Nhập mã track..."}
                                                    </span>
                                                    <button 
                                                        onClick={() => setEditingTrackId(pkg.id)} 
                                                        className="p-1.5 text-slate-400 hover:text-indigo-600 opacity-0 group-hover/track:opacity-100 transition-all rounded-md hover:bg-indigo-50 shrink-0"
                                                        title="Sửa track kiện"
                                                    >
                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                        {currentUser?.role !== 'support' && (
                                            <td className="px-5 py-3 whitespace-nowrap text-center">
                                                <button 
                                                    onClick={async (e) => {
                                                        e.stopPropagation();
                                                        if (pkg.orderDescriptions && pkg.orderDescriptions.length > 0) {
                                                            await showAlert("Lệnh bị từ chối: Kiện hàng này đang chứa dữ liệu đơn hàng!\n\nVui lòng nhấp vào kiện để xem chi tiết và phải gỡ hết đơn thao tác ra thì mới có quyền xóa kiện này.");
                                                            return;
                                                        }
                                                        if (await showConfirm(`Bạn có chắc muốn xóa vĩnh viễn kiện rỗng ${pkg.id} không?`)) {
                                                            deletePackage(pkg.id);
                                                            deleteDoc(doc(db, 'packages', pkg.id)).catch(e => console.error("Lỗi xóa kiện trên mây:", e));
                                                        }
                                                    }} 
                                                    className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-xl transition-all border border-transparent hover:border-red-100 opacity-60 group-hover:opacity-100"
                                                    title="Xóa kiện"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Phân trang */}
                {totalPages > 1 && (
                    <div className="bg-slate-50 border-t border-slate-200 p-4 flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-500">
                            Hiển thị từ <strong className="text-slate-800">{(currentPage - 1) * itemsPerPage + 1}</strong> đến <strong className="text-slate-800">{Math.min(currentPage * itemsPerPage, displayedPackages.length)}</strong> trong tổng số <strong className="text-slate-800">{displayedPackages.length}</strong> kiện
                        </span>
                        <div className="flex gap-1.5 items-center">
                            <button 
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm font-bold flex items-center gap-1"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
                                Trước
                            </button>
                            
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                <button
                                    key={page}
                                    onClick={() => setCurrentPage(page)}
                                    className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-bold transition-all ${currentPage === page ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 border border-indigo-500' : 'text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 border border-transparent'}`}
                                >
                                    {page}
                                </button>
                            ))}

                            <button 
                                disabled={currentPage === totalPages}
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm font-bold flex items-center gap-1"
                            >
                                Sau
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        )}

        {/* Modal Tạo Kiện Nhỏ (Giống thiết kế yêu cầu) */}
        {isCreating && (
           <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <div className="bg-white rounded-xl w-full max-w-[500px] overflow-hidden shadow-2xl flex flex-col">
                 <div className="px-6 py-4 flex justify-between items-center border-b border-gray-200">
                    <h3 className="font-bold text-gray-800 text-lg">Tạo kiện hàng</h3>
                    <button onClick={() => setIsCreating(false)} className="text-gray-400 hover:text-gray-800 transition">
                       <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                 </div>

                 <div className="p-6">
                    <div>
                        <label className="block text-sm font-bold text-gray-800 mb-2">Kho:</label>
                        <select 
                            value={destination}
                            onChange={(e) => setDestination(e.target.value)}
                            className="w-full bg-white border-2 border-indigo-400 rounded-lg px-3 py-2 text-indigo-900 font-bold outline-none focus:border-indigo-600 transition-colors shadow-sm cursor-pointer"
                        >
                            {warehouses.length === 0 && <option value="">(Chưa có Kho nào - Vào mục Quản Lý Kho Mỹ để thêm)</option>}
                            {warehouses.map(wh => {
                                const whName = typeof wh === 'string' ? wh : wh.name;
                                return <option key={whName} value={whName}>{whName}</option>
                            })}
                        </select>
                    </div>
                 </div>

                 <div className="px-6 py-4 flex justify-end gap-3 border-t border-gray-100 bg-gray-50">
                    <button onClick={() => setIsCreating(false)} className="px-5 py-2 rounded-lg font-bold bg-white border border-gray-300 text-gray-700 hover:bg-gray-100 transition">
                       Bỏ qua
                    </button>
                    <button onClick={handleCreatePackage} className="px-5 py-2 rounded-lg font-bold bg-[#009688] hover:bg-[#00796B] text-white transition">
                       Tạo
                    </button>
                 </div>
              </div>
           </div>
        )}

    </div>
  );
}
