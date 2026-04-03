"use client";

import { useOrderStore } from "@/store";
import { 
  Package, 
  FileWarning, 
  MapPin, 
  XOctagon, 
  TrendingUp,
  Activity
} from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";

export default function Home() {
  const { orders } = useOrderStore();
  const [mounted, setMounted] = useState(false);
  const [currentTime, setCurrentTime] = useState("");

  useEffect(() => {
    setMounted(true);
    setCurrentTime(new Date().toLocaleTimeString());
    const timer = setInterval(() => setCurrentTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(timer);
  }, []);
  
  if (!mounted) return null; // Tránh hydration mismatch

  const totalOrders = orders.length;
  const noLabelCount = orders.filter((o) => !(o.TrackingNumber && o.pdfUrl) && o.Status !== 'Đã Hủy').length;
  const usScannedCount = orders.filter((o) => o.Status === 'Kho Mỹ đã scan').length;
  const canceledCount = orders.filter((o) => o.Status === 'Đã Hủy').length;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-700 to-cyan-600 tracking-tight">
             Trang Chủ Bảng Phân Tích
          </h1>
          <p className="text-slate-500 mt-2 flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            Hệ thống trạng thái hoạt động ổn định
          </p>
        </div>
        <div className="text-sm bg-white border border-slate-200 px-5 py-2.5 rounded-xl text-slate-600 shadow-sm font-mono tracking-widest flex items-center gap-2">
           <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
           {currentTime}
        </div>
      </div>

      {/* Thông số tổng quan (Dashboard Metric Cards) */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {/* Card 1 */}
        <Link href="/orders?filter=ALL" className="block bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-2xl p-6 relative overflow-hidden group hover:shadow-xl hover:shadow-indigo-500/30 transition-all duration-300 border border-indigo-400/50">
          <div className="absolute -right-4 -top-4 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-all duration-500"></div>
          <div className="absolute top-1/2 -right-8 w-16 h-16 bg-indigo-400/20 rounded-full blur-xl"></div>
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div>
              <p className="text-indigo-100 font-bold text-[11px] uppercase tracking-wider">Tổng Số Đơn</p>
              <h3 className="text-4xl font-black text-white mt-2">{totalOrders}</h3>
            </div>
            <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center text-white border border-white/20 group-hover:scale-110 transition-transform shadow-sm">
              <Package size={24} />
            </div>
          </div>
          <div className="mt-5 flex items-center text-xs font-medium text-indigo-100 relative z-10">
            <TrendingUp size={14} className="mr-1.5 text-indigo-200" /> Thống kê toàn bộ dữ liệu
          </div>
        </Link>

        {/* Card 2 */}
        <Link href="/orders?filter=NO_LABEL" className="block bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl p-6 relative overflow-hidden group hover:shadow-xl hover:shadow-amber-500/30 transition-all duration-300 border border-amber-300/50">
          <div className="absolute -right-4 -top-4 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-all duration-500"></div>
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div>
              <p className="text-amber-50 font-bold text-[11px] uppercase tracking-wider">Chưa Có Label PDF</p>
              <h3 className="text-4xl font-black text-white mt-2">{noLabelCount}</h3>
            </div>
            <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center text-white border border-white/20 group-hover:scale-110 transition-transform shadow-sm">
              <FileWarning size={24} />
            </div>
          </div>
          <div className="mt-5 flex items-center text-xs font-medium text-amber-50 relative z-10">
            <span className="text-amber-100 mr-1.5 font-bold">●</span> Cần nạp PDF ghép nhãn
          </div>
        </Link>

        {/* Card 3 */}
        <Link href="/orders?filter=Kho Mỹ đã scan" className="block bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-6 relative overflow-hidden group hover:shadow-xl hover:shadow-emerald-500/30 transition-all duration-300 border border-emerald-400/50">
          <div className="absolute -right-4 -top-4 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-all duration-500"></div>
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div>
              <p className="text-emerald-50 font-bold text-[11px] uppercase tracking-wider">Kho Mỹ Đã Scan</p>
              <h3 className="text-4xl font-black text-white mt-2">{usScannedCount}</h3>
            </div>
            <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center text-white border border-white/20 group-hover:scale-110 transition-transform shadow-sm">
              <MapPin size={24} />
            </div>
          </div>
          <div className="mt-5 flex items-center text-xs font-medium text-emerald-50 relative z-10">
             <span className="text-emerald-100 mr-1.5 font-bold">●</span> Nhập kho trung chuyển thành công
          </div>
        </Link>

        {/* Card 4 */}
        <Link href="/orders?filter=Đã Hủy" className="block bg-gradient-to-br from-rose-500 to-red-600 rounded-2xl p-6 relative overflow-hidden group hover:shadow-xl hover:shadow-rose-500/30 transition-all duration-300 border border-rose-400/50">
          <div className="absolute -right-4 -top-4 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-all duration-500"></div>
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div>
              <p className="text-rose-50 font-bold text-[11px] uppercase tracking-wider">Đơn Đã Cancel</p>
              <h3 className="text-4xl font-black text-white mt-2">{canceledCount}</h3>
            </div>
            <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center text-white border border-white/20 group-hover:scale-110 transition-transform shadow-sm">
              <XOctagon size={24} />
            </div>
          </div>
          <div className="mt-5 flex items-center text-xs font-medium text-rose-50 relative z-10">
            <span className="text-rose-100 mr-1.5 font-bold">●</span> Đã bị hủy bỏ bởi Quản trị viên
          </div>
        </Link>
      </div>
      
      {/* Phân vùng Widget */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
         {/* Biểu đồ giả lập */}
         <div className="lg:col-span-2 bg-white border border-slate-200 shadow-sm rounded-2xl p-8 min-h-[350px] flex flex-col items-center justify-center relative overflow-hidden group">
             <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:20px_20px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-60"></div>
             
             <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mb-6 shadow-[0_8px_30px_rgb(0,0,0,0.08)] relative z-10 border border-slate-100">
                 <Activity className="w-10 h-10 text-indigo-500 animate-pulse" />
             </div>
             
             <h3 className="text-2xl font-bold text-slate-800 z-10 mb-2">Phân Tích Dòng Chảy Đơn Hàng</h3>
             <p className="text-slate-500 z-10 text-center max-w-md text-sm leading-relaxed">
                 Hệ thống biểu đồ trực quan thống kê tăng trưởng và trạng thái chi tiết của từng kiện hàng đang được phát triển.
             </p>
         </div>
         
         {/* Phím tắt thao tác */}
         <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 flex flex-col">
             <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                Thao tác nhanh
             </h3>
             <div className="space-y-3 flex-1 flex flex-col justify-center">
                 <Link href="/upload-excel" className="group flex items-center justify-between px-5 py-4 bg-slate-50 hover:bg-white text-slate-700 hover:text-indigo-600 border border-slate-200 hover:border-indigo-300 rounded-xl transition-all shadow-sm hover:shadow-md hover:shadow-indigo-500/10">
                     <span className="font-medium text-sm">Tải lên Excel đơn hàng</span>
                     <svg className="w-4 h-4 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                 </Link>
                 <Link href="/upload-pdf" className="group flex items-center justify-between px-5 py-4 bg-slate-50 hover:bg-white text-slate-700 hover:text-amber-600 border border-slate-200 hover:border-amber-300 rounded-xl transition-all shadow-sm hover:shadow-md hover:shadow-amber-500/10">
                     <span className="font-medium text-sm">Tải lên PDF / Ghép nhãn gốc</span>
                     <svg className="w-4 h-4 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                 </Link>
                 <Link href="/print-barcode" className="group flex items-center justify-between px-5 py-4 bg-slate-50 hover:bg-white text-slate-700 hover:text-teal-600 border border-slate-200 hover:border-teal-300 rounded-xl transition-all shadow-sm hover:shadow-md hover:shadow-teal-500/10">
                     <span className="font-medium text-sm">In Mã Barcode Hàng Loạt</span>
                     <svg className="w-4 h-4 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                 </Link>
             </div>
         </div>
      </div>
    </div>
  );
}
