"use client";

import { useOrderStore, OrderRow, useWarehouseStore } from '@/store';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import * as xlsx from 'xlsx';
import Link from 'next/link';
import { db } from '@/firebase';
import { collection, writeBatch, doc } from 'firebase/firestore';
import { useAuthStore } from '@/authStore';

type LogType = 'success' | 'error' | 'warning' | 'info';

interface LogItem {
    type: LogType;
    message: string;
    timestamp: string;
}

export default function UploadExcelPage() {
  const router = useRouter();
  const { currentUser } = useAuthStore();
  const setOrders = useOrderStore((state) => state.setOrders);
  const existingOrders = useOrderStore((state) => state.orders);
  const warehouses = useWarehouseStore((state) => state.warehouses);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [errorModalContent, setErrorModalContent] = useState<{title: string, messages: string[]} | null>(null);

  const addLog = (type: LogType, message: string) => {
      const now = new Date();
      const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
      setLogs(prev => [{ type, message, timestamp: time }, ...prev]);
  };

  const clearLogs = () => setLogs([]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    clearLogs();
    addLog('info', `Bắt đầu đọc file: ${file.name}`);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = xlsx.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        
        addLog('info', `Đang phân tích Sheet: ${wsname}`);
        const data = xlsx.utils.sheet_to_json<OrderRow>(ws);
        
        if (data.length === 0) {
            addLog('error', `Không tìm thấy dòng dữ liệu nào trong Sheet ${wsname}. Vui lòng kiểm tra lại file.`);
            setLoading(false);
            return;
        }

        addLog('info', `Tìm thấy ${data.length} dòng dữ liệu.`);
        
        const requiredFields = [
            "Sender Name", "Sender Address1", "Sender City", "Sender State", "Sender Zipcode",
            "Receiver Name", "Receiver Address 1", "Receiver City", "Receiver State", "Receiver Zip",
            "Weight (lbs)", "Length (in)", "Width (in)", "Height (in)", "Description"
        ];

        // --- KIỂM TRA ĐỊNH DẠNG FILE EXCEL GỐC ---
        const rawHeaders = xlsx.utils.sheet_to_json(ws, { header: 1 })[0] as string[];
        const headers = rawHeaders ? rawHeaders.map(h => h ? h.toString().trim() : "") : [];
        
        const altNames: Record<string, string> = {
            "Weight (lbs)": "Weight",
            "Length (in)": "Length",
            "Width (in)": "Width",
            "Height (in)": "Height"
        };

        const missingHeaders = requiredFields.filter(f => !headers.includes(f) && !(altNames[f] && headers.includes(altNames[f])));
        
        if (missingHeaders.length > 0) {
            setErrorModalContent({
                title: 'TỪ CHỐI TẢI LÊN: SAI CẤU TRÚC FILE EXCEL!',
                messages: [
                    'File Excel của bạn không có cấu trúc chuẩn như Biểu mẫu gốc.',
                    `Phát hiện thiếu ${missingHeaders.length} trường định dạng bắt buộc (ở Dòng 1):`,
                    ...missingHeaders.map(h => `- Thiếu: [${h}]`),
                    '',
                    '💡 Xử lý: Vui lòng nhấp nút "Tải File Mẫu" ở góc trên bên phải để lấy Bảng Excel chuẩn.'
                ]
            });
            addLog('error', `TỪ CHỐI TẢI LÊN: File Excel của bạn không đúng biểu mẫu gốc!`);
            addLog('error', `Phát hiện thiếu ${missingHeaders.length} cột cấu trúc bắt buộc: [${missingHeaders.join("], [")}]`);
            addLog('warning', `👉 Vui lòng nhấp nút "Tải File Mẫu" ở góc trên bên phải để lấy Form chuẩn và copy sang.`);
            setLoading(false);
            return;
        }

        let validCount = 0;
        let missingFieldErrors: string[] = [];
        const enrichedData: any[] = [];

        const now = new Date();
        const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')} ${now.getDate().toString().padStart(2, '0')}/${(now.getMonth()+1).toString().padStart(2, '0')}/${now.getFullYear()}`;
        
        data.forEach((row, index) => {
             const rowNum = index + 2; // Header là dòng 1 trong Excel
             
             let missingFields: string[] = [];
             for (const field of requiredFields) {
                 const alt = altNames[field];
                 let val = row[field];
                 if (val === undefined && alt !== undefined) val = row[alt];

                 if (val == null || val.toString().trim() === '') {
                     missingFields.push(`[${field}]`);
                 }
             }

             if (missingFields.length > 0) {
                 const identifyStr = row.Description ? ` (Mã: ${row.Description})` : (row["Sender Name"] ? ` (Người gửi: ${row["Sender Name"]})` : '');
                 missingFieldErrors.push(`Dòng ${rowNum}${identifyStr} thiếu: ${missingFields.join(', ')}`);
                 return; // Nhảy qua dòng này, không nạp vào mây
             }

             validCount++;

            // Tự động phân loại HUB (Trạm nhận) dựa trên thông tin Người gửi trong Excel
            let matchedHub = "";
            const senderName = (row["Sender Name"] || "").toString().trim().toLowerCase();
            const senderAddressParts = [
                row["Sender Address1"], 
                row["Sender Address2"],
                row["Sender City"], 
                row["Sender State"], 
                row["Sender Zipcode"], 
                row["SenderCountry"] || row["Sender Country"]
            ];
            const senderAddressConcat = senderAddressParts.filter(Boolean).map(p => p?.toString().trim()).filter(Boolean).join(" ").toLowerCase();

            for (const wh of warehouses) {
                const whObj = typeof wh === 'string' ? { id: wh, name: wh, address: "", receiverName: "" } : wh;
                const whName = (whObj.receiverName || "").toLowerCase().trim();
                const whAddr = (whObj.address || "").toLowerCase().trim();

                if (whName && senderName && (senderName === whName || senderName.includes(whName) || whName.includes(senderName))) {
                    matchedHub = whObj.name || whObj.id;
                    break;
                }
                
                if (whAddr && senderAddressConcat) {
                     const cleanWhAddr = whAddr.replace(/\s+/g, ' ');
                     const cleanSenderAddr = senderAddressConcat.replace(/\s+/g, ' ');
                     if (cleanSenderAddr.includes(cleanWhAddr) || cleanWhAddr.includes(cleanSenderAddr)) {
                         matchedHub = whObj.name || whObj.id;
                         break;
                     }
                }
            }

            const newOrder: any = { 
                ...row, 
                HUB: matchedHub,
                Weight: row["Weight (lbs)"] !== undefined ? row["Weight (lbs)"] : row["Weight"],
                Length: row["Length (in)"] !== undefined ? row["Length (in)"] : row["Length"],
                Width: row["Width (in)"] !== undefined ? row["Width (in)"] : row["Width"],
                Height: row["Height (in)"] !== undefined ? row["Height (in)"] : row["Height"],
                UploadDate: timeString,
                createdAt: Date.now() - index, // Đánh mốc thời gian chính xác để giữ đúng thứ tự Excel
                ActionHistory: [{
                    action: 'Nạp dữ liệu vào máy chủ lưu trữ' + (matchedHub ? ` (Kho: ${matchedHub})` : ''),
                    user: currentUser?.displayName || 'Ẩn danh',
                    timestamp: new Date().toISOString()
                }]
            };

            delete newOrder["Weight (lbs)"];
            delete newOrder["Length (in)"];
            delete newOrder["Width (in)"];
            delete newOrder["Height (in)"];

            enrichedData.push(newOrder);
        });

        if (missingFieldErrors.length > 0) {
            setErrorModalContent({
                title: `PHÁT HIỆN LỖI THIẾU TRƯỜNG DỮ LIỆU (${missingFieldErrors.length} ĐƠN)`,
                messages: [
                    `Nằm ở trong File: [${file.name}]`,
                    '👉 Yêu cầu: Tất cả các dòng đơn hàng đều phải có đầy đủ các trường (Sender, Receiver, Weight, Length...).',
                    '',
                    `Chi tiết ${missingFieldErrors.length} dòng bị lõi:`,
                    ...missingFieldErrors.slice(0, 15),
                    ...(missingFieldErrors.length > 15 ? [`... và ${missingFieldErrors.length - 15} dòng khác cũng bị lỗi.`] : []),
                    '',
                    '💡 Xử lý: Xin vui lòng bổ sung thông tin vào Excel trên máy tính của bạn và nhấp chọn Tải lên lại.'
                ]
            });
            addLog('error', `TỪ CHỐI ${missingFieldErrors.length} dòng ở trong File [${file.name}] vì THIẾU DỮ LIỆU BẮT BUỘC (Đã bỏ qua các dòng này):`);
            for (let i = 0; i < Math.min(missingFieldErrors.length, 15); i++) {
                 addLog('error', `- ${missingFieldErrors[i]}`);
            }
            if (missingFieldErrors.length > 15) {
                 addLog('error', `... và ${missingFieldErrors.length - 15} dòng khác cũng bị từ chối.`);
            }
        }

        // --- LÕI AI: CHỐNG TRÙNG LẶP ĐƠN HÀNG (DEDUPLICATION) ---
        addLog('info', `Đang rà soát và loại bỏ các đơn hàng trùng lặp...`);
        const getUniqKey = (o: any) => {
           const desc = (o.Description || "").toString().trim().toUpperCase();
           // CHỈ check trùng lặp nếu có mã Description. Các đơn không có mã thì cho qua tuốt (không gộp chung)
           if (desc) return `DESC_${desc}`;
           // Tạo key ngẫu nhiên để các đơn rỗng Description luôn được coi là duy nhất, không bị vứt rác lầm
           return `EMPTY_${Math.random()}`;
        };

        const existingKeys = new Set(existingOrders.map(getUniqKey));
        const uniqueNewData = [];
        let duplicateRows: number[] = [];

        for (let i = 0; i < enrichedData.length; i++) {
            const order = enrichedData[i];
            const key = getUniqKey(order);
            if (!existingKeys.has(key)) {
                 existingKeys.add(key); 
                 uniqueNewData.push(order);
            } else {
                 duplicateRows.push(i + 2); // Excel rows are 1-indexed and have 1 header row, so index + 2
            }
        }

        if (duplicateRows.length > 0) {
             const rowListStr = duplicateRows.length > 15 
                 ? duplicateRows.slice(0, 15).join(', ') + ` và ${duplicateRows.length - 15} dòng khác`
                 : duplicateRows.join(', ');
             addLog('error', `CẢNH BÁO: Đã từ chối ${duplicateRows.length} đơn hàng bị TRÙNG LẶP. Xem lại các dòng Excel báo lỗi: ${rowListStr}.`);
        }

        if (uniqueNewData.length === 0) {
             addLog('warning', `PHÁT HIỆN TRÙNG LẶP TOÀN BỘ: Tất cả các đơn trong File [${file.name}] đều đã nằm trên hệ thống. Thao tác tải lên bị đóng!`);
             setLoading(false);
             return;
        }

        // Đẩy lên Firebase bằng Batch Write (Firestore giới hạn 500 doc/phát)
        addLog('info', `Đang đồng bộ ${uniqueNewData.length} dữ liệu mới vào Đám mây (Firebase)...`);
        const ordersRef = collection(db, 'orders');
        const CHUNK_SIZE = 450;
        let processed = 0;
        
        for (let i = 0; i < uniqueNewData.length; i += CHUNK_SIZE) {
            const batch = writeBatch(db);
            const chunk = uniqueNewData.slice(i, i + CHUNK_SIZE);
            chunk.forEach((order) => {
                const newDocRef = doc(ordersRef);
                order.id = newDocRef.id;
                batch.set(newDocRef, order);
            });
            await batch.commit();
            processed += chunk.length;
            addLog('info', `Đã đồng bộ ${processed}/${uniqueNewData.length} đơn...`);
        }

        addLog('success', `Đã lưu trữ thành công ${processed} đơn hàng từ File [${file.name}] lên THE-HUB!`);
        
      } catch (error: any) {
        addLog('error', `Lỗi khi lưu lên mây: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const downloadTemplate = async () => {
    const templateHeaders = [
      "Sender Name", "Sender Company", "Sender Address1", "Sender Address2", "Sender City", "Sender State", "Sender Zipcode", "Sender Phone",
      "Receiver Name", "Receiver Company", "Receiver Address 1", "Receiver Address 2", "Receiver City", "Receiver State", "Receiver Zip", "Receiver Phone",
      "Weight (lbs)", "Length (in)", "Width (in)", "Height (in)", "Description", "Reference1", "Reference2", "SenderCountry", "ReceiverCountry", "TRACKING"
    ];
    
    const sampleData = [{
        "Sender Name": "Justin",
        "Sender Address1": "33 Yorkshire Ln",
        "Sender City": "Decatur",
        "Sender State": "AL",
        "Sender Zipcode": 35603,
        "SenderCountry": "US",
        "Receiver Name": "kyle broadhurst",
        "Receiver Address 1": "1921 Heritage Loop",
        "Receiver City": "Myrtle Beach",
        "Receiver State": "SC",
        "Receiver Zip": 29577,
        "ReceiverCountry": "US",
        "Weight (lbs)": 2.6,
        "Length (in)": 3.9,
        "Width (in)": 3.9,
        "Height (in)": 3.9,
        "Description": "T3.209"
    }];

    const worksheet = xlsx.utils.json_to_sheet(sampleData, { header: templateHeaders });
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, "Template");
    xlsx.writeFile(workbook, "THE_HUB_Template.xlsx");
  };

  return (
    <div className="flex gap-8 max-w-7xl mx-auto items-start">
      <div className="flex-1 w-full max-w-xl">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-3xl font-bold text-slate-800">Tải Lên File Excel Dữ Liệu</h2>
            <button 
                onClick={downloadTemplate}
                className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-sm flex items-center gap-2 transition-colors border-2 border-slate-200 hover:border-slate-300 shadow-sm"
                title="Tải về một file mẫu chuẩn để điền dữ liệu"
            >
                <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                Tải File Mẫu (.xlsx)
            </button>
          </div>
          
          <div className="relative bg-white border-2 border-slate-300 border-dashed rounded-2xl p-12 text-center hover:bg-slate-50 transition-colors cursor-pointer group shadow-sm">
            <input 
              type="file" 
              accept=".xlsx, .xls"
              onChange={handleFileUpload}
              disabled={loading}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed" 
            />
            <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-2xl mx-auto flex items-center justify-center mb-6 border border-emerald-100 group-hover:scale-110 transition-transform">
              {loading ? (
                <svg className="animate-spin w-10 h-10 text-emerald-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              ) : (
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
              )}
            </div>
            
            <h3 className="text-xl font-bold mb-2 text-slate-800">
              {loading ? "Đang đọc & phân tích thẻ bảng tính..." : "Kéo thả file Excel vào đây"}
            </h3>
            
            <p className="text-slate-500 mb-6 truncate max-w-md mx-auto">
              {loading ? "Vui lòng đợi trong giây lát..." : "Hoặc click để chọn file từ máy tính định dạng (.xlsx, .xls)"}
            </p>

            <button type="button" disabled={loading} className="px-6 py-3 bg-white text-emerald-700 border-2 border-emerald-200 hover:border-emerald-500 font-bold hover:bg-emerald-50 rounded-xl transition-all shadow-sm disabled:opacity-50">
               {loading ? "Đang nạp dữ liệu..." : "Chọn File Excel"}
            </button>
          </div>

          {logs.length > 0 && !loading && (
             <div className="mt-6 flex justify-center">
                 <Link href="/upload-pdf" className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition flex items-center gap-2 shadow-sm">
                     Tiếp tục: Sang Tải Lên Labels
                     <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                 </Link>
             </div>
          )}
      </div>

      <div className="w-full lg:w-[500px] shrink-0 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[80vh] sticky top-8">
          <div className="bg-slate-50 border-b border-slate-200 p-4 flex items-center justify-between">
              <h4 className="font-bold text-slate-800 flex items-center gap-2">
                 <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                 Nhật ký Nạp Dữ liệu
              </h4>
              <span className="bg-slate-200 text-slate-600 px-2.5 py-0.5 rounded-full text-xs font-bold">{logs.length} dòng</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50 custom-scrollbar space-y-3">
              {logs.length === 0 ? (
                  <div className="text-center text-slate-400 text-sm mt-12 font-medium italic">
                      Chi tiết xử lý file sẽ hiển thị ở đây...
                  </div>
              ) : (
                  logs.map((log, index) => (
                      <div key={index} className={`p-3 rounded-lg border flex gap-3 text-sm shadow-sm
                          ${log.type === 'info' ? 'bg-white border-slate-200 text-slate-700' : ''}
                          ${log.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : ''}
                          ${log.type === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-800' : ''}
                          ${log.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' : ''}
                      `}>
                          <div className={`mt-0.5 font-mono text-[10px] shrink-0 opacity-60 font-bold`}>{log.timestamp}</div>
                          <div className="font-medium leading-tight">{log.message}</div>
                      </div>
                  ))
              )}
          </div>
      </div>

      {errorModalContent && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
           <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden border border-red-100 animate-in fade-in zoom-in duration-200">
               <div className="bg-red-50 px-6 py-4 border-b border-red-100 flex items-center justify-between">
                   <div className="flex items-center gap-3 text-red-600">
                       <svg className="w-6 h-6 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                       <h3 className="font-bold text-lg">{errorModalContent.title}</h3>
                   </div>
                   <button onClick={() => setErrorModalContent(null)} className="text-red-400 hover:text-red-600 hover:bg-red-100 p-1.5 rounded-lg transition-colors">
                       <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                   </button>
               </div>
               <div className="p-6 bg-white overflow-y-auto max-h-[60vh] custom-scrollbar">
                   {errorModalContent.messages.map((msg, i) => (
                       <div key={i} className={`text-sm ${msg.startsWith('👉') || msg.startsWith('💡') ? 'text-indigo-600 font-bold mt-4' : (msg.startsWith('-') ? 'text-red-500 font-medium ml-4 list-item list-inside' : 'text-slate-700')} ${msg === '' ? 'h-2' : 'mb-1'}`}>
                           {msg}
                       </div>
                   ))}
               </div>
               <div className="p-5 border-t bg-slate-50 flex justify-end gap-3">
                   <button onClick={() => setErrorModalContent(null)} className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl shadow-sm transition-all text-sm">
                       Đã Hiểu
                   </button>
               </div>
           </div>
        </div>
      )}

    </div>
  );
}
