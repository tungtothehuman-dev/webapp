"use client";

import { useOrderStore, OrderRow, useWarehouseStore } from '@/store';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import * as xlsx from 'xlsx';
import Link from 'next/link';
import { db } from '@/firebase';
import { collection, writeBatch, doc } from 'firebase/firestore';

type LogType = 'success' | 'error' | 'warning' | 'info';

interface LogItem {
    type: LogType;
    message: string;
    timestamp: string;
}

export default function UploadExcelPage() {
  const router = useRouter();
  const setOrders = useOrderStore((state) => state.setOrders);
  const existingOrders = useOrderStore((state) => state.orders);
  const warehouses = useWarehouseStore((state) => state.warehouses);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<LogItem[]>([]);

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
        
        let validCount = 0;
        let missingDescRows: number[] = [];

        const now = new Date();
        const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')} ${now.getDate().toString().padStart(2, '0')}/${(now.getMonth()+1).toString().padStart(2, '0')}/${now.getFullYear()}`;
        
        const enrichedData = data.map((row, index) => {
            if (!row.Description) {
                missingDescRows.push(index + 2);
            } else {
                validCount++;
            }

            // Tự động phân loại HUB (Trạm nhận) dựa trên thông tin Người gửi trong Excel
            let matchedHub = "";
            
            // Lấy dữ liệu tên và ghép chuỗi địa chỉ từ các cột Excel của Sender
            const senderName = (row["Sender Name"] || "").toString().trim().toLowerCase();
            const senderAddressParts = [
                row["Sender Address1"], 
                row["Sender Address2"],
                row["Sender City"], 
                row["Sender State"], 
                row["Sender Zipcode"], 
                row["SenderCountry"] || row["Sender Country"]
            ];
            // Format: "15410 Prairie Oaks Dr Houston TX 77083 US"
            const senderAddressConcat = senderAddressParts
                 .filter(Boolean)
                 .map(p => p?.toString().trim())
                 .filter(Boolean)
                 .join(" ")
                 .toLowerCase();

            // Tìm Kho phù hợp
            for (const wh of warehouses) {
                const whObj = typeof wh === 'string' ? { id: wh, name: wh, address: "", receiverName: "" } : wh;
                const whName = (whObj.receiverName || "").toLowerCase().trim();
                const whAddr = (whObj.address || "").toLowerCase().trim();

                // 1. Nếu kho có định nghĩa tên người nhận và khớp chính xác Tên Sender
                if (whName && senderName && (senderName === whName || senderName.includes(whName) || whName.includes(senderName))) {
                    matchedHub = whObj.name || whObj.id;
                    break;
                }
                
                // 2. Nếu kho có định nghĩa địa chỉ và địa chỉ sender chứa địa chỉ kho (hoặc ngược lại)
                if (whAddr && senderAddressConcat) {
                     // Thay thế dư khoảng trắng để khớp mượt hơn
                     const cleanWhAddr = whAddr.replace(/\s+/g, ' ');
                     const cleanSenderAddr = senderAddressConcat.replace(/\s+/g, ' ');
                     if (cleanSenderAddr.includes(cleanWhAddr) || cleanWhAddr.includes(cleanSenderAddr)) {
                         matchedHub = whObj.name || whObj.id;
                         break;
                     }
                }
            }

            return { 
                ...row, 
                HUB: matchedHub, // Chèn dữ liệu HUB kho đã nhận diện được
                UploadDate: timeString,
                ActionHistory: [{
                    action: 'Nạp dữ liệu vào máy chủ lưu trữ' + (matchedHub ? ` (Kho: ${matchedHub})` : ''),
                    user: 'Hệ thống Admin',
                    timestamp: timeString
                }]
            };
        });

        if (missingDescRows.length > 0) {
            const rowListStr = missingDescRows.length > 10 
                 ? missingDescRows.slice(0, 10).join(', ') + ` và ${missingDescRows.length - 10} dòng khác`
                 : missingDescRows.join(', ');
            addLog('warning', `Cảnh báo: Có ${missingDescRows.length} dòng không có "Description" (Mã Đơn) tại dòng Excel số: ${rowListStr}. Sẽ gây khó ghép file PDF.`);
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
             addLog('success', `Tất cả các đơn trong File này đều đã nằm trên hệ thống. Không có đơn mới nào được thêm.`);
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
            addLog('info', `Đã đồng bộ ${processed}/${enrichedData.length} đơn...`);
        }

        addLog('success', `Đã lưu trữ thành công ${processed} đơn hàng lên không gian Đám Mây của THE-HUB!`);
        
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
      "Weight", "Length", "Width", "Height", "Description", "Reference1", "Reference2", "SenderCountry", "ReceiverCountry", "TRACKING"
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
        "Weight": 2.6,
        "Length": 3.9,
        "Width": 3.9,
        "Height": 3.9,
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
    </div>
  );
}
