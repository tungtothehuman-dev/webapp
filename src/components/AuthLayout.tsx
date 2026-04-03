"use client";

import { useAuthStore } from "@/authStore";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useOrderStore } from "@/store";
import { usePdfTaskStore } from "@/pdfTaskStore";
import LoginPage from "@/app/login/page"; // We'll create this next

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { currentUser, logout } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  
  const { isProcessing, processedFiles, totalFiles, currentFilename } = usePdfTaskStore();
  
  const [isUploadExpanded, setIsUploadExpanded] = useState(false);
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
        import('firebase/firestore').then(({ collection, onSnapshot }) => {
          const unsubscribe = onSnapshot(collection(db, 'orders'), (snapshot) => {
             let docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
             
             // Thuật toán parse và Sắp xếp đảo ngược để Đơn mới nhất nằm trên cùng
             docs.sort((a, b) => {
                const parseTime = (dateStr: string) => {
                    if (!dateStr || typeof dateStr !== 'string') return 0;
                    const parts = dateStr.trim().split(" ");
                    if (parts.length < 2) return 0;
                    const [hours, minutes] = parts[0].split(":");
                    const [day, month, year] = parts[1].split("/");
                    // Date.UTC hoặc Date constructor để ra số milliseconds
                    return new Date(Number(year), Number(month) - 1, Number(day), Number(hours), Number(minutes)).getTime() || 0;
                };
                return parseTime(b["Ngày/Tháng"]) - parseTime(a["Ngày/Tháng"]);
             });

             setOrders(docs.length > 0 ? docs : []);
          });
          // Lưu ý: unsubscribe hiện được chạy kín trong block này
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
        <aside className="w-64 border-r border-neutral-800 bg-[#1c2434] p-6 flex flex-col gap-6 sticky top-0 h-screen print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-teal-500 flex items-center justify-center font-bold text-white shadow-sm">T</div>
            <h1 className="font-bold text-xl tracking-tight text-white">THE - HUB</h1>
          </div>
          <nav className="flex flex-col gap-2 mt-4 flex-1">
            {currentUser.role === 'admin' && (
              <>
                <Link href="/" className={`px-4 py-2 rounded-lg transition-colors font-medium ${pathname === '/' ? 'bg-teal-500 text-white' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}>Trang Chủ</Link>
                <Link href="/orders" className={`px-4 py-2 rounded-lg transition-colors font-medium ${pathname === '/orders' ? 'bg-teal-500 text-white' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}>Danh Sách Đơn</Link>
                <Link href="/packages" className={`px-4 py-2 rounded-lg transition-colors font-medium ${pathname.includes('/packages') ? 'bg-teal-500 text-white' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}>Tạo Kiện Hàng</Link>
                <Link href="/warehouses" className={`px-4 py-2 rounded-lg transition-colors font-medium ${pathname === '/warehouses' ? 'bg-teal-500 text-white' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}>Quản Lý Kho Mỹ</Link>
                <Link href="/accounts" className={`px-4 py-2 rounded-lg transition-colors font-medium ${pathname === '/accounts' ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}>Quản Lý Tài Khoản</Link>
                
                {/* Upload Section Gộp (Accordion) */}
                <div className="flex flex-col mt-2">
                    <button 
                        onClick={() => setIsUploadExpanded(!isUploadExpanded)}
                        className="px-4 py-2.5 flex justify-between items-center w-full text-left bg-transparent hover:bg-white/5 text-slate-400 hover:text-white text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all"
                    >
                        TẢI LÊN HỆ THỐNG
                        <svg className={`w-4 h-4 transition-transform duration-200 ${isUploadExpanded ? 'rotate-180 text-white' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                    </button>
                    {isUploadExpanded && (
                        <div className="flex flex-col mt-1 ml-3 border-l-2 border-slate-700 space-y-1 pl-3 overflow-hidden animate-in slide-in-from-top-2 fade-in duration-200">
                            <Link href="/upload-excel" className={`px-4 py-2 rounded-lg transition-colors text-sm font-medium ${pathname === '/upload-excel' ? 'bg-teal-500 text-white' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}>File Excel</Link>
                            <Link href="/upload-pdf" className={`px-4 py-2 rounded-lg transition-colors text-sm font-medium ${pathname === '/upload-pdf' ? 'bg-teal-500 text-white' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}>File PDF Labels</Link>
                        </div>
                    )}
                </div>
                <div className="h-px bg-slate-800 my-2 w-full"></div>
              </>
            )}
            
            <Link href="/print" className={`px-4 py-2 rounded-lg transition-colors font-medium flex items-center gap-2 ${pathname === '/print' ? 'bg-teal-500 text-white' : 'text-indigo-400 hover:text-white hover:bg-white/10'}`}>
               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
               In Nhãn Nhanh
            </Link>
            {currentUser.role === 'admin' && (
              <Link href="/print-barcode" className={`px-4 py-2 mt-2 rounded-lg transition-colors font-medium flex items-center gap-2 ${pathname === '/print-barcode' ? 'bg-teal-500 text-white' : 'text-teal-400 hover:text-white hover:bg-white/10'}`}>
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm14 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"></path></svg>
                 In Barcode
              </Link>
            )}
          </nav>

          <div className="mt-auto border-t border-slate-700 pt-4 flex flex-col gap-2">
             <Link href="/settings" className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium ${pathname === '/settings' ? 'bg-teal-500 text-white' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}>
                 <div className="w-6 h-6 rounded-full bg-slate-600 flex items-center justify-center font-bold text-[10px] text-white">
                     {currentUser.displayName.charAt(0).toUpperCase()}
                 </div>
                 <span className="truncate">{currentUser.displayName}</span>
             </Link>
             <button onClick={logout} className="px-4 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-red-500 transition-colors text-left text-sm font-medium flex items-center gap-2">
                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
                 Đăng Xuất (Log out)
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
