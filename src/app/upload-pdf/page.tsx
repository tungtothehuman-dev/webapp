"use client";

import { useOrderStore } from '@/store';
import { useAuthStore } from '@/authStore';
import { usePdfTaskStore, LogItem } from '@/pdfTaskStore';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function UploadPDFPage() {
  const orders = useOrderStore((state) => state.orders);
  const { currentUser } = useAuthStore();
  const router = useRouter();
  
  const { isProcessing, totalFiles, processedFiles, currentFilename, logs, startProcessing, clearTask } = usePdfTaskStore();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    if (orders.length === 0) {
      alert("Bạn chưa tải lên file Excel. Vui lòng quay lại tab 'Tải Lên Excel' trước.");
      return;
    }

    if (isProcessing) {
      alert("Hệ thống đang bận xử lý, vui lòng chờ!");
      return;
    }

    // Pass FileList to Array
    const fileArray = Array.from(files);
    
    // Gọi tiến trình chạy ngầm
    startProcessing(fileArray, orders, currentUser);
  };

  return (
    <div className="flex gap-8 max-w-7xl mx-auto items-start">
      <div className="flex-1 w-full max-w-xl">
          <div className="flex justify-between items-end mb-8">
             <h2 className="text-3xl font-bold text-slate-800">Tải file label PDF</h2>
             {isProcessing && <span className="text-sm font-medium text-emerald-600 animate-pulse flex items-center gap-2"><div className="w-2 h-2 bg-emerald-500 rounded-full"></div> Đang tiến hành chạy pdf</span>}
          </div>
          
          <div className="mb-6 flex gap-3">
             <Link href="/upload-excel" className="px-5 py-2.5 rounded-xl font-bold bg-white text-slate-600 border border-slate-300 shadow-sm hover:bg-slate-50 hover:text-slate-900 transition-colors">
                1. Tải Lên Excel
             </Link>
             <button className="px-5 py-2.5 rounded-xl font-bold bg-indigo-50 text-indigo-700 border-2 border-indigo-200 pointer-events-none shadow-sm relative">
                2. Tải và MATCH PDF {isProcessing && <span className="absolute -top-2 -right-2 flex h-4 w-4"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span><span className="relative inline-flex rounded-full h-4 w-4 bg-indigo-500"></span></span>}
             </button>
             <Link href="/orders" className="px-5 py-2.5 rounded-xl font-bold bg-white text-slate-600 border border-slate-300 shadow-sm hover:bg-slate-50 hover:text-slate-900 transition-colors">
                3. Quản Lý Đơn
             </Link>
          </div>

          <div className={`relative bg-white border-2 border-dashed rounded-3xl p-12 text-center transition-all cursor-pointer group shadow-sm ${isProcessing ? 'border-amber-400 bg-amber-50/50 pointer-events-none' : 'border-indigo-300 hover:bg-indigo-50 hover:border-indigo-400'}`}>
            <input 
              type="file" 
              multiple 
              accept="application/pdf"
              onChange={handleFileChange}
              disabled={isProcessing}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed" 
            />
            
            <div className="w-20 h-20 bg-indigo-100 text-indigo-600 rounded-2xl mx-auto flex items-center justify-center mb-6 border border-indigo-200 group-hover:scale-110 transition-transform">
              {isProcessing ? (
                <svg className="animate-spin w-10 h-10" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              ) : (
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
              )}
            </div>

            {isProcessing ? (
              <>
                 <h3 className="text-xl font-bold text-slate-800 mb-2">Đang xử lý file PDF</h3>
                 <p className="text-slate-500 mb-6 font-medium text-sm px-4">
                   Hệ thống đang tự quét và ghép khối lượng lớn tập tin ({processedFiles}/{totalFiles}). Bạn có thể chuyển sang trang khác mà không làm gián đoạn tiến trình.
                 </p>
                 <div className="w-full bg-slate-200 rounded-full h-3 mb-2 overflow-hidden shadow-inner flex">
                    <div className="bg-gradient-to-r from-amber-500 to-amber-400 h-3 transition-all duration-300 rounded-full relative" style={{ width: `${(processedFiles / totalFiles) * 100}%` }}>
                       <div className="absolute top-0 left-0 w-full h-full bg-white/20 animate-pulse"></div>
                    </div>
                 </div>
                 <p className="text-xs font-bold text-amber-600 truncate px-4">{currentFilename}</p>
                 <div className="mt-8 text-center bg-slate-50 p-4 border border-slate-200 rounded-xl shadow-inner">
                   <p className="text-xl md:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-green-500 to-blue-600 animate-pulse drop-shadow-sm">
                       CHỜ CHÚT XONG SẼ CÓ FILE LOG TRẢ VỀ KẾT QUẢ MATCH
                   </p>
                 </div>
              </>
            ) : (
              <>
                 <h3 className="text-xl font-bold text-indigo-900 mb-2">Tải Lên Label PDF</h3>
                 <p className="text-slate-500 mb-4 font-medium text-sm">
                   Tải lên label PDF đồng thời hệ thống sẽ phân tích và tự động gắn với thông tin đơn hàng.
                 </p>
                 <span className="inline-flex px-4 py-2 bg-white rounded-lg text-sm font-bold text-indigo-600 border shadow-sm">
                   Chọn hàng loạt File (.pdf)
                 </span>
                 <p className="text-xs text-slate-400 mt-4 font-medium italic">Không giới hạn số lượng - Có thể đóng tab/mở sang trang khác thoải mái</p>
              </>
            )}
          </div>
      </div>

      <div className="w-[500px] shrink-0 bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden flex flex-col h-[70vh] sticky top-8">
         <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
             <h3 className="font-bold text-indigo-900 text-sm flex items-center gap-2">
                 <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                 Monitor: Nhật ký tải file
             </h3>
             <span className="text-[10px] font-bold bg-slate-200 text-slate-600 px-2 py-1 rounded-md">{logs.length} thao tác</span>
         </div>
         <div className="p-4 overflow-y-auto flex-1 space-y-3 bg-[#fafafa]">
             {logs.map((log: LogItem, idx: React.Key) => (
                 <div key={idx} className={`p-3 rounded-lg border text-xs leading-relaxed font-mono shadow-sm
                     ${log.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' :
                       log.type === 'error' ? 'bg-red-50 border-red-100 text-red-800' :
                       log.type === 'warning' ? 'bg-amber-50 border-amber-100 text-amber-800' :
                       'bg-white border-slate-200 text-slate-600'}`}>
                     <div className="font-bold mb-1 opacity-60 text-[10px] uppercase tracking-wider">{log.timestamp}</div>
                     {log.message}
                 </div>
             ))}
             {logs.length === 0 && (
                 <div className="h-full flex items-center justify-center text-slate-400 text-sm font-medium italic">
                     Chưa có dữ liệu.
                 </div>
             )}
         </div>
      </div>
    </div>
  );
}
