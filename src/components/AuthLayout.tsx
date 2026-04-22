"use client";

import { useAuthStore } from "@/authStore";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useOrderStore, useWarehouseStore, usePackageStore } from "@/store";
import { usePdfTaskStore } from "@/pdfTaskStore";
import LoginPage from "@/app/login/page"; // We'll create this next

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { currentUser, logout } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  
  const { isProcessing, processedFiles, totalFiles, currentFilename } = usePdfTaskStore();
  
  const [isUploadExpanded, setIsUploadExpanded] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const setOrders = useOrderStore(state => state.setOrders);

  useEffect(() => {
     if (pathname === '/upload-excel' || pathname === '/upload-pdf') {
         setIsUploadExpanded(true);
     }
  }, [pathname]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Kích hoạt Realtime Firebase Listener
  useEffect(() => {
    if (mounted && currentUser) {
      import('@/firebase').then(({ db }) => {
        import('firebase/firestore').then(({ collection, onSnapshot, setDoc, doc, writeBatch }) => {
          const unsubscribeOrders = onSnapshot(collection(db, 'orders'), (snapshot) => {
             let docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
             
             // Thuật toán parse và Sắp xếp đảo ngược để Đơn mới nhất nằm trên cùng
             docs.sort((a, b) => {
                const parseTime = (dateStr: string) => {
                    if (!dateStr || typeof dateStr !== 'string') return 0;
                    const parts = dateStr.trim().split(" ");
                    if (parts.length < 2) return 0;
                    const [hours, minutes] = parts[0].split(":");
                    const [day, month, year] = parts[1].split("/");
                    return new Date(Number(year), Number(month) - 1, Number(day), Number(hours), Number(minutes)).getTime() || 0;
                };
                
                // Trọng số 'createdAt' (chính xác đến ms) hoặc parse string lỏng lẻo cho các data cũ
                const valA = a.createdAt || parseTime(a.UploadDate || a["Ngày/Tháng"] || "");
                const valB = b.createdAt || parseTime(b.UploadDate || b["Ngày/Tháng"] || "");
                return valB - valA; // Xếp mới nhất lên trên
             });

             setOrders(docs.length > 0 ? docs : []);
          });
          
          // Lắng nghe dữ liệu Kho từ Firebase (Đồng bộ mọi máy)
          const unsubscribeWarehouses = onSnapshot(collection(db, 'warehouses'), (snapshot) => {
             let docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
             
             if (docs.length === 0) {
                 // Nếu Firebase trống, chủ động đưa 4 HUB mặc định lên mây tạo nền gốc!
                 const defaultHubs = [
                     { id: "HUB NY", name: "HUB NY", address: "", receiverName: "" },
                     { id: "HUB CA", name: "HUB CA", address: "", receiverName: "" },
                     { id: "HUB TX", name: "HUB TX", address: "", receiverName: "" },
                     { id: "HUB OR", name: "HUB OR", address: "", receiverName: "" }
                 ];
                 defaultHubs.forEach(hub => setDoc(doc(db, 'warehouses', hub.id), hub));
             } else {
                 useWarehouseStore.getState().setWarehouses(docs);
             }
          });

          // Lắng nghe dữ liệu Kiện Hàng (Packages)
          const unsubscribePackages = onSnapshot(collection(db, 'packages'), (snapshot) => {
             let docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
             
             // Firebase's onSnapshot already handles offline caching and pending writes natively. 
             // We use Firebase as the absolute source of truth to avoid zombie packages reappearing.
             
             // Sort kiện mới nhất lên trên
             docs.sort((a, b) => {
                const parseTime = (dateStr: string) => {
                    if (!dateStr || typeof dateStr !== 'string') return 0;
                    const parts = dateStr.trim().split(" ");
                    if (parts.length < 2) return 0;
                    const [hours, minutes] = parts[0].split(":");
                    const [day, month, year] = parts[1].split("/");
                    return new Date(Number(year), Number(month) - 1, Number(day), Number(hours), Number(minutes)).getTime() || 0;
                };
                return parseTime(b.createdAt) - parseTime(a.createdAt);
             });
             
             usePackageStore.getState().setPackages(docs);
          });
        });
      });
    }
  }, [mounted, currentUser, setOrders]);

  // Bảo vệ Route (RBAC)
  useEffect(() => {
     if (mounted && currentUser) {
         if (currentUser.role === 'warehouse' && pathname !== '/print' && pathname !== '/settings') {
             router.replace('/print');
         }
     }
  }, [mounted, currentUser, pathname, router]);

  if (!mounted) return null; // Tránh hydration error

  if (!currentUser) {
      return <LoginPage />;
  }

  return (
    <div className="flex w-full min-h-screen font-sans text-slate-800">
        {/* Sidebar */}
        <aside className={`border-r border-neutral-800 bg-[#1c2434] p-4 flex flex-col gap-6 sticky top-0 h-screen transition-all duration-300 print:hidden ${isSidebarCollapsed ? 'w-20 items-center' : 'w-64'}`}>
          <div className={`flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-between'} w-full`}>
            <div className="flex items-center gap-3">
               <button 
                  onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                  title="Mở rộng / Thu nhỏ menu"
                  className="w-8 h-8 shrink-0 rounded-lg bg-teal-500 hover:bg-teal-400 transition-colors flex items-center justify-center font-bold text-white shadow-sm cursor-pointer"
               >
                 T
               </button>
               {!isSidebarCollapsed && <h1 className="font-bold text-[18px] tracking-tight text-white shrink-0">THE - HUB</h1>}
            </div>
            {!isSidebarCollapsed && (
                <button onClick={() => setIsSidebarCollapsed(true)} className="text-slate-500 hover:text-white p-1 rounded transition-colors" title="Thu nhỏ menu">
                   <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7"></path></svg>
                </button>
            )}
          </div>
          <nav className="flex flex-col gap-2 mt-2 w-full flex-1">
            {(currentUser.role === 'admin' || currentUser.role === 'support') && (
              <>
                <Link title="Trang Chủ" href="/" className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all font-medium ${pathname === '/' ? 'bg-teal-500 text-white' : 'text-slate-400 hover:text-white hover:bg-white/10'} ${isSidebarCollapsed ? 'justify-center px-0' : ''}`}>
                  <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>
                  {!isSidebarCollapsed && <span className="truncate">Trang Chủ</span>}
                </Link>
                <Link title="Danh Sách Đơn" href="/orders" className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all font-medium ${pathname === '/orders' ? 'bg-teal-500 text-white' : 'text-slate-400 hover:text-white hover:bg-white/10'} ${isSidebarCollapsed ? 'justify-center px-0' : ''}`}>
                  <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
                  {!isSidebarCollapsed && <span className="truncate">Danh Sách Đơn</span>}
                </Link>
                <Link title="Tạo Kiện Hàng" href="/packages" className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all font-medium ${pathname.includes('/packages') ? 'bg-teal-500 text-white' : 'text-slate-400 hover:text-white hover:bg-white/10'} ${isSidebarCollapsed ? 'justify-center px-0' : ''}`}>
                  <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg>
                  {!isSidebarCollapsed && <span className="truncate">Tạo Kiện Hàng</span>}
                </Link>
              </>
            )}
            
            {currentUser.role === 'admin' && (
              <>
                <Link title="Quản Lý Kho Mỹ" href="/warehouses" className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all font-medium ${pathname === '/warehouses' ? 'bg-teal-500 text-white' : 'text-slate-400 hover:text-white hover:bg-white/10'} ${isSidebarCollapsed ? 'justify-center px-0' : ''}`}>
                  <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>
                  {!isSidebarCollapsed && <span className="truncate">Quản Lý Kho Mỹ</span>}
                </Link>
                <Link title="Quản Lý Tài Khoản" href="/accounts" className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all font-medium ${pathname === '/accounts' ? 'bg-teal-500 text-white shadow-lg shadow-teal-500/20' : 'text-slate-400 hover:text-white hover:bg-white/10'} ${isSidebarCollapsed ? 'justify-center px-0' : ''}`}>
                  <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                  {!isSidebarCollapsed && <span className="truncate">Quản Lý Tài Khoản</span>}
                </Link>
              </>
            )}
            
            {/* Upload Section Gộp (Accordion) */}
            {(currentUser.role === 'admin' || currentUser.role === 'support') && (
                <div className="flex flex-col mt-2 w-full">
                    <button 
                        title="Tải Lên Hệ Thống"
                        onClick={() => { if(isSidebarCollapsed) setIsSidebarCollapsed(false); setIsUploadExpanded(!isUploadExpanded); }}
                        className={`px-4 py-2.5 flex items-center w-full text-left bg-transparent hover:bg-white/5 text-slate-400 hover:text-white text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all ${isSidebarCollapsed ? 'justify-center px-0' : 'justify-between'}`}
                    >
                        {isSidebarCollapsed ? (
                            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                        ) : (
                            <>
                                <div className="flex items-center gap-3">
                                    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                                    <span>TẢI LÊN</span>
                                </div>
                                <svg className={`w-4 h-4 shrink-0 transition-transform duration-200 ${isUploadExpanded ? 'rotate-180 text-white' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                            </>
                        )}
                    </button>
                    {isUploadExpanded && !isSidebarCollapsed && (
                        <div className="flex flex-col mt-1 ml-3 border-l-2 border-slate-700 space-y-1 pl-3 overflow-hidden animate-in slide-in-from-top-2 fade-in duration-200">
                            <Link href="/upload-excel" className={`px-4 py-2 rounded-lg transition-colors text-[13px] font-medium ${pathname === '/upload-excel' ? 'bg-teal-500 text-white' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}>File Excel</Link>
                            <Link href="/upload-pdf" className={`px-4 py-2 rounded-lg transition-colors text-[13px] font-medium ${pathname === '/upload-pdf' ? 'bg-teal-500 text-white' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}>File PDF Label</Link>
                        </div>
                    )}
                </div>
            )}
            
            <div className="h-px bg-slate-800 my-2 w-full"></div>
            
            <Link title="In Nhãn Nhanh" href="/print" className={`px-4 py-2.5 rounded-lg transition-all font-medium flex items-center gap-3 ${pathname === '/print' ? 'bg-teal-500 text-white' : 'text-indigo-400 hover:text-white hover:bg-white/10'} ${isSidebarCollapsed ? 'justify-center px-0' : ''}`}>
               <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
               {!isSidebarCollapsed && <span className="truncate">In Nhãn Nhanh</span>}
            </Link>
            {(currentUser.role === 'admin' || currentUser.role === 'support') && (
              <Link title="In Barcode" href="/print-barcode" className={`px-4 py-2.5 rounded-lg transition-all font-medium flex items-center gap-3 ${pathname === '/print-barcode' ? 'bg-teal-500 text-white' : 'text-teal-400 hover:text-white hover:bg-white/10'} ${isSidebarCollapsed ? 'justify-center px-0' : ''}`}>
                 <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm14 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"></path></svg>
                 {!isSidebarCollapsed && <span className="truncate">In Barcode</span>}
              </Link>
            )}
          </nav>

          <div className="mt-auto border-t border-slate-700 pt-4 flex flex-col gap-2 w-full">
             <Link title="Cài Đặt" href="/settings" className={`px-4 py-2 rounded-lg transition-all flex items-center gap-3 ${pathname === '/settings' ? 'bg-teal-500 text-white' : 'text-slate-400 hover:text-white hover:bg-white/10'} ${isSidebarCollapsed ? 'justify-center px-0' : ''}`}>
                 <div className="w-8 h-8 shrink-0 rounded-full bg-slate-500/50 flex items-center justify-center font-bold text-xs text-white uppercase shadow-sm">
                     {currentUser.displayName.charAt(0)}
                 </div>
                 {!isSidebarCollapsed && (
                     <div className="flex flex-col truncate">
                         <span className="truncate text-sm font-bold tracking-wide leading-tight">{currentUser.displayName}</span>
                         <span className={`text-[11px] font-medium mt-0.5 truncate uppercase tracking-wider ${pathname === '/settings' ? 'text-teal-100' : 'text-slate-500'}`}>
                            {currentUser.role === 'admin' ? 'System Administrator' : currentUser.role === 'support' ? 'Customer Support' : 'US Warehouse'}
                         </span>
                     </div>
                 )}
             </Link>
             <button title="Đăng Xuất (Log out)" onClick={logout} className={`px-4 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-red-500 transition-all font-medium flex items-center gap-3 ${isSidebarCollapsed ? 'justify-center px-0' : ''}`}>
                 <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
                 {!isSidebarCollapsed && <span className="text-sm truncate">Đăng Xuất</span>}
             </button>
          </div>
        </aside>
        
        {/* Main Content */}
        <main className="flex-1 p-8 max-h-screen overflow-y-auto bg-[#fbfaf6] overflow-x-hidden text-slate-800 print:p-0 print:bg-none print:bg-white print:text-black">
          <div className="w-full max-w-[1800px] mx-auto relative">
            {children}
            
            {/* GLOBAL BACKGROUND TASK TOAST */}
            {isProcessing && pathname !== '/upload-pdf' && (
                <div className="fixed bottom-6 right-6 w-96 bg-white rounded-2xl shadow-2xl border border-indigo-200 overflow-hidden z-50 animate-in slide-in-from-bottom-5">
                    <div className="p-4 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between">
                        <h4 className="font-bold text-indigo-900 text-sm flex items-center gap-2">
                           <span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span></span>
                           Hệ Thống Phân Tích PDF
                        </h4>
                        <Link href="/upload-pdf" className="text-[11px] font-bold text-indigo-600 hover:underline">Xem Chi Tiết</Link>
                    </div>
                    <div className="p-4">
                        <div className="flex justify-between text-xs mb-1 font-medium text-slate-500">
                           <span>Tiến độ Quét:</span>
                           <span className="font-bold text-slate-700">{processedFiles} / {totalFiles} tệp</span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2 mb-3 overflow-hidden">
                           <div className="bg-amber-500 h-2 transition-all duration-300" style={{ width: `${(processedFiles / Math.max(1, totalFiles)) * 100}%` }}></div>
                        </div>
                        <p className="text-[11px] text-slate-500 truncate" title={currentFilename}>{currentFilename}</p>
                    </div>
                </div>
            )}
          </div>
        </main>
    </div>
  );
}
