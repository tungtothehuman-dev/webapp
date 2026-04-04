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
             DASHBOARD
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
         {/* Biểu đồ Thống kê React + Tailwind */}
         <div className="lg:col-span-2 bg-white border border-slate-200 shadow-sm rounded-2xl p-6 min-h-[350px] flex flex-col relative overflow-hidden">
             <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2 relative z-10">
                <Activity className="w-5 h-5 text-indigo-500" />
                Phân Tích Dòng Chảy Đơn Hàng
             </h3>
             
             {/* Dữ liệu lấy trực tiếp từ Orders Store */}
             {(() => {
                 const chartData = [
                     { name: "Tổng Số", value: totalOrders, color: "bg-indigo-500 hover:bg-indigo-400" },
                     { name: "Chưa Có PDF", value: noLabelCount, color: "bg-amber-400 hover:bg-amber-300" },
                     { name: "Đã Quét Kho", value: usScannedCount, color: "bg-emerald-500 hover:bg-emerald-400" },
                     { name: "Đã Hủy", value: canceledCount, color: "bg-rose-500 hover:bg-rose-400" },
                 ];
                 const maxVal = Math.max(...chartData.map(d => d.value), 5);
                 
                 return (
                     <div className="flex-1 flex flex-col w-full">
                         <div className="flex-1 flex items-end justify-around gap-2 sm:gap-8 mt-2 lg:pt-10 border-b-2 border-slate-100 pb-0 px-2 sm:px-8 relative z-10">
                             {/* Lưới ngang nền */}
                             <div className="absolute inset-0 flex flex-col justify-between pb-0 z-0 pointer-events-none opacity-40">
                                 {[100, 75, 50, 25, 0].map(pct => (
                                     <div key={pct} className="w-full border-t-2 border-dashed border-slate-200 flex items-center relative">
                                         <span className="absolute -left-1 sm:-left-4 -translate-y-1/2 text-[10px] text-slate-400 w-8 text-right bg-white pr-1">
                                             {Math.ceil(maxVal * pct / 100)}
                                         </span>
                                     </div>
                                 ))}
                             </div>
                             
                             {/* Cột Bar Chart */}
                             {chartData.map((d, i) => (
                                 <div key={i} className="relative flex flex-col items-center group w-12 sm:w-20 z-10 h-full justify-end cursor-pointer">
                                     <div 
                                         className={`w-full rounded-t-lg transition-all duration-1000 ease-out relative ${d.color} shadow-md`}
                                         style={{ height: `${Math.max((d.value / maxVal) * 100, 2)}%` }}
                                     >
                                        <div className="absolute -top-10 left-1/2 -translate-x-1/2 flex-col items-center opacity-0 group-hover:opacity-100 transition-opacity min-w-max hidden md:flex">
                                            <span className="font-bold text-slate-700 text-xs sm:text-sm bg-white px-2.5 py-1 rounded-lg shadow-lg border border-slate-200">
                                                {d.value} đơn
                                            </span>
                                            <div className="w-2 h-2 bg-white border-b border-r border-slate-200 rotate-45 -mt-1.5"></div>
                                        </div>
                                     </div>
                                     <span className="absolute -bottom-6 text-[10px] sm:text-xs font-bold text-slate-500 text-center leading-tight whitespace-nowrap group-hover:text-slate-800 transition-colors">
                                         {d.name}
                                     </span>
                                 </div>
                             ))}
                         </div>
                         <div className="mt-10 flex justify-center gap-4 sm:gap-6">
                              {chartData.map((d, idx) => (
                                  <div key={idx} className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs font-medium text-slate-500">
                                      <span className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full ${d.color.split(' ')[0]}`}></span>
                                      <span className="hidden sm:inline">{d.name.replace(' Kho', '')}</span>
                                  </div>
                              ))}
                         </div>
                     </div>
                 );
             })()}
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
