"use client";

import { useState, useRef, useEffect } from "react";
import { useOrderStore } from "@/store";
import { useAuthStore } from "@/authStore";

import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/firebase";

export default function PrintPage() {
    const orders = useOrderStore((state) => state.orders);
    const updateOrder = useOrderStore((state) => state.updateOrder);
    const { currentUser } = useAuthStore();
    const [scanValue, setScanValue] = useState("");
    const [lastScanResult, setLastScanResult] = useState<{ status: 'success' | 'error' | 'not_found', message: string, order?: any } | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Kỹ thuật "Nạp Đạn Không Gian Tảo" (Background Prefetching)
    const [blobUrls, setBlobUrls] = useState<Record<string, string>>({});

    // Tự động tải ngầm toàn bộ PDF về RAM ngay khi sếp vừa mở trang (chưa cần quét)
    useEffect(() => {
        const pendingOrders = orders.filter(o => o.pdfUrl && !blobUrls[o.id] && o.Status !== 'Kho Mỹ đã scan' && o.Status !== 'Đã Hủy');

        pendingOrders.forEach(order => {
            fetch(order.pdfUrl!)
                .then(res => res.blob())
                .then(blob => {
                    const localUrl = URL.createObjectURL(blob);
                    setBlobUrls(prev => ({ ...prev, [order.id]: localUrl }));
                })
                .catch(err => console.error("Lỗi nạp đạn ngầm:", err));
        });
    }, [orders, blobUrls]);

    // Đảm bảo con trỏ lúc nào cũng được focus vào ô Scan khi vào trang
    useEffect(() => {
        inputRef.current?.focus();

        // Bắt sự kiện click ra ngoài thì focus lại (để súng quét auto nằm đúng ô nhập)
        const handleGlobalClick = () => {
            inputRef.current?.focus();
        };
        window.addEventListener('click', handleGlobalClick);
        return () => window.removeEventListener('click', handleGlobalClick);
    }, []);

    const handleScan = async (e: React.FormEvent) => {
        e.preventDefault();
        const query = scanValue.trim();
        if (!query) return;

        // Auto-fix lỗi kẹt Unikey/Vietkey khi dùng súng bắn mã vạch (ví dụ: US -> Ú, IS -> Í, DD -> Đ)
        const decodeTelexForBarcode = (str: string) => {
            return str
                .replace(/ú/g, 'us').replace(/Ú/g, 'US')
                .replace(/í/g, 'is').replace(/Í/g, 'IS')
                .replace(/á/g, 'as').replace(/Á/g, 'AS')
                .replace(/é/g, 'es').replace(/É/g, 'ES')
                .replace(/ó/g, 'os').replace(/Ó/g, 'OS')
                .replace(/ý/g, 'ys').replace(/Ý/g, 'YS')
                .replace(/đ/g, 'dd').replace(/Đ/g, 'DD')
                .replace(/ư/g, 'uw').replace(/Ư/g, 'UW')
                .replace(/ơ/g, 'ow').replace(/Ơ/g, 'OW')
                .replace(/ô/g, 'oo').replace(/Ô/g, 'OO')
                .replace(/ê/g, 'ee').replace(/Ê/g, 'EE')
                .replace(/ă/g, 'aw').replace(/Ă/g, 'AW')
                .replace(/â/g, 'aa').replace(/Â/g, 'AA');
        };
        
        const cleanQuery = decodeTelexForBarcode(query);
        
        // Cần xoá dấu tiếng việt ở cả Mã Đơn (ví dụ: PĐM) và Query (PDM) để có thể khớp nhau 100%
        // Đồng thời loại bỏ khoảng chấm phẩy, khoảng trắng
        const normalizeStr = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").replace(/[\s\-_,\.]/g, '').toLowerCase();
        
        const qNorm = normalizeStr(query);
        const cleanNorm = normalizeStr(cleanQuery);

        // Tìm kiếm xem có đơn nào trùng khớp Tracking hoặc Description không
        const orderIndex = orders.findIndex(o => {
            const desc = normalizeStr(o.Description || "");
            const track = normalizeStr(o.TrackingNumber || "");
            
            if (desc === qNorm || desc === cleanNorm) return true;
            if (track && qNorm) {
                if (track === qNorm || track === cleanNorm) return true;
                // Đặc trị súng quét mã vạch USPS dính routing prefix (420xxxx + Track)
                if (track.length >= 10 && (qNorm.includes(track) || cleanNorm.includes(track))) return true;
                if (qNorm.length >= 10 && track.includes(qNorm)) return true;
            }
            return false;
        });

        if (orderIndex === -1) {
            setLastScanResult({ status: 'not_found', message: `Không tìm thấy Đơn Hàng nào khớp với mã: ${query} (Đã tự động dịch Unikey: ${cleanQuery})` });
            setScanValue("");
            return;
        }

        const order = orders[orderIndex];

        // Lôi mẹo nạp đạn ra xài: Ưu tiên xài đạn local (ổ cứng), nếu chưa kịp nạp thì xài đạn Cloudinary.
        const pdfToPrint = blobUrls[order.id] || order.pdfUrl || order.pdfBase64;

        if (!pdfToPrint) {
            setLastScanResult({ status: 'error', message: `Lỗi: Đơn hàng [${order.Description}] CÓ TỒN TẠI nhưng lại CHƯA ĐƯỢC CHÈN NHÃN PDF. Vui lòng quét file PDF trước!`, order });
            setScanValue("");
            return;
        }

        try {
            const printJS = (await import('print-js')).default;

            // Kích hoạt In Trực Tiếp 1 nốt nhạc bằng printJS mà không nhảy Tab!
            if (order.pdfBase64 && !blobUrls[order.id] && !order.pdfUrl) {
                printJS({
                    printable: order.pdfBase64,
                    type: 'pdf',
                    base64: true
                });
            } else {
                printJS({
                    printable: pdfToPrint, // <- Xài đạn prefetch siêu tốc (0.001s)
                    type: 'pdf'
                });
            }

            // Nếu là Kho Mỹ (warehouse) thì mới cập nhật trạng thái "Kho Mỹ đã scan", Admin thì giữ nguyên
            const now = new Date();
            const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')} ${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`;

            const newLog = {
                action: "Đã Quét & In Lệnh",
                user: currentUser ? currentUser.displayName : "Kho Mỹ",
                timestamp: timeString
            };

            const updatedStatus = currentUser?.role === 'warehouse' ? "Kho Mỹ đã scan" : (order.Status || 'Chờ xử lý');

            // Cập nhật State nội bộ
            updateOrder(order.id, {
                Status: updatedStatus,
                ActionHistory: [...(order.ActionHistory || []), newLog]
            });

            // Bắn thẳng lên Database (Cực kỳ quan trọng để tài khoản khác thấy)
            try {
                const orderRef = doc(db, 'orders', order.id);
                updateDoc(orderRef, {
                    Status: updatedStatus,
                    ActionHistory: [...(order.ActionHistory || []), newLog]
                });
            } catch (dbErr) {
                console.error("Lỗi cập nhật CSDL:", dbErr);
            }

            setLastScanResult({ status: 'success', message: `Đã dập lệnh In trực tiếp cho đơn hàng [${order.Description}] và cập nhật trạng thái kho!`, order });
        } catch (err) {
            console.error("Lỗi khi In:", err);
            setLastScanResult({ status: 'error', message: "Có lỗi kĩ thuật khi cố gắng khởi động máy in." });
        }

        // Lập tức xoá trắng ô text để súng quét có thể bắn tia tiếp theo ngay tức khắc
        setScanValue("");
    };

    return (
        <div>
            <h2 className="text-3xl font-bold mb-8 flex items-center gap-3 text-slate-800 tracking-tight">
                <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
                Máy Quét & In Nhãn Trực Tiếp
            </h2>

            <div className="bg-white border border-slate-200 rounded-2xl p-8 mb-8 shadow-sm relative overflow-hidden">
                <p className="text-slate-600 mb-6 max-w-2xl text-lg relative z-10 font-medium">
                    Quét hoặc nhập mã đơn hàng để in label.
                </p>

                <form onSubmit={handleScan} className="relative z-10 mt-2">
                    <div className="relative max-w-3xl flex items-center bg-white border-2 border-indigo-400 ring-4 ring-indigo-100 rounded-2xl overflow-hidden shadow-sm transition-all focus-within:ring-indigo-200 focus-within:border-indigo-500">
                        <div className="pl-6 flex items-center pointer-events-none">
                            <svg className="w-8 h-8 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm14 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"></path></svg>
                        </div>
                        <input
                            ref={inputRef}
                            type="text"
                            className="flex-1 bg-transparent border-none text-indigo-900 pl-4 py-5 text-2xl tracking-widest font-mono outline-none placeholder-slate-400"
                            placeholder="Scan mã đơn hàng vào đây..."
                            value={scanValue}
                            onChange={(e) => setScanValue(e.target.value)}
                        />
                        <div className="pr-4 py-2">
                            <button type="submit" className="bg-[#5a4add] hover:bg-indigo-600 text-white font-black tracking-wide py-3.5 px-8 rounded-xl shadow-sm transition-transform active:scale-95">
                                Submit
                            </button>
                        </div>
                    </div>
                </form>

                {/* Thông báo kết quả Scan */}
                {lastScanResult && (
                    <div className={`mt-8 p-6 rounded-xl border flex items-start gap-4 animate-in fade-in slide-in-from-bottom-4 duration-300 ${lastScanResult.status === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
                            lastScanResult.status === 'error' ? 'bg-red-50 border-red-200 text-red-800' :
                                'bg-amber-50 border-amber-200 text-amber-800'
                        }`}>
                        {lastScanResult.status === 'success' && <svg className="w-8 h-8 shrink-0 mt-1 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>}
                        {lastScanResult.status !== 'success' && <svg className="w-8 h-8 shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>}

                        <div className="w-full">
                            <h4 className="font-bold text-lg mb-1">{lastScanResult.status === 'success' ? 'Đã kích hoạt Lệnh In!' : 'Tra cứu thất bại'}</h4>
                            <p className="opacity-90 font-medium">{lastScanResult.message}</p>
                        </div>
                    </div>
                )}
            </div>

        </div>
    );
}
