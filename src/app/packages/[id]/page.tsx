"use client";

import { usePackageStore, useOrderStore } from "@/store";
import { useAuthStore } from "@/authStore";
import { useParams, useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { useModalStore } from "@/modalStore";
import Link from "next/link";
import * as xlsx from 'xlsx';
import { saveAs } from 'file-saver';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/firebase';

export default function PackageDetailPage() {
    const { id } = useParams() as { id: string };
    const router = useRouter();
    const { packages, deletePackage, updatePackage } = usePackageStore();
    const { orders, updateOrder } = useOrderStore();
    const { currentUser } = useAuthStore();
    const { showAlert, showConfirm } = useModalStore();
    
    const [scanInput, setScanInput] = useState("");
    const scanInputRef = useRef<HTMLInputElement>(null);
    const [showErrorsOnly, setShowErrorsOnly] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);

    // Cập nhật dùng hàm updatePackage chuẩn từ store và lưu Firebase
    const setPackage = (activePkg: any, updates: any) => {
        updatePackage(activePkg.id, updates);
        updateDoc(doc(db, 'packages', activePkg.id), updates).catch(e => console.error("Lỗi đồng bộ chi tiết kiện:", e));
    };

    // Prevent hydration issues
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    if (!mounted) return null;

    const activePkg = packages.find(p => p.id === id);

    if (!activePkg) {
        return (
            <div className="p-12 text-center">
                <h2 className="text-2xl font-bold mb-4">Không tìm thấy kiện hàng</h2>
                <Link href="/packages" className="text-teal-400 hover:underline">Quay lại danh sách</Link>
            </div>
        );
    }

    const handleScanSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (activePkg.status === 'Đã xuất kho Việt Nam') {
            await showAlert("Kiện hàng đã xuất kho! Không thể thêm mã mới.");
            return;
        }

        const rawCode = scanInput.trim();
        if (!rawCode) return;

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

        const cleanQuery = decodeTelexForBarcode(rawCode);
        
        // Loại bỏ khoảng trắng, dấu tiếng Việt để so sánh chuẩn nhất
        const normalizeStr = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").replace(/[\s\-_,\.]/g, '').toLowerCase();
        
        const qNorm = normalizeStr(rawCode);
        const cleanNorm = normalizeStr(cleanQuery);

        // 1. Tìm thông qua mã Tracking hoặc Description (có hỗ trợ gõ nhầm Telex)
        const orderMatchIdx = orders.findIndex(o => {
            const desc = normalizeStr(o.Description || "");
            const track = normalizeStr(o.TrackingNumber || "");
            
            if (desc === qNorm || desc === cleanNorm) return true;
            if (track && qNorm) {
                if (track === qNorm || track === cleanNorm) return true;
                // Xử lý súng bắn mã vạch thừa tiền tố USPS (VD mã phụ 420 + ZIP đi liền với Track)
                if (track.length >= 10 && (qNorm.includes(track) || cleanNorm.includes(track))) return true;
                if (qNorm.length >= 10 && track.includes(qNorm)) return true;
            }
            return false;
        });

        // Lấy đúng mã chuẩn gốc (Description) nếu tìm thấy, không thì xài nguyên bản
        const code = (orderMatchIdx !== -1 && orders[orderMatchIdx].Description) ? orders[orderMatchIdx].Description : rawCode;

        if (activePkg.orderDescriptions.includes(code)) {
            await showAlert(`Mã ${code} đã nằm trong kiện quản lý!`);
            setScanInput("");
            return;
        }

        let isHubError = false;

        // ==== KIỂM TRA ĐIỀU KIỆN HUB VÀ KIỆN HÀNG ====
        if (orderMatchIdx !== -1) {
            const orderMatch = orders[orderMatchIdx];
            const orderHub = (orderMatch.HUB || orderMatch.Hub || "").toString().toUpperCase().trim();
            const pkgDest = (activePkg.destination || "").toString().toUpperCase().trim();

            if (orderHub && pkgDest) {
                const cleanOrderHub = orderHub.replace("HUB", "").trim();
                const cleanPkgDest = pkgDest.replace("HUB", "").trim();
                
                if (cleanOrderHub !== cleanPkgDest && cleanOrderHub !== "" && cleanPkgDest !== "") {
                    // Cập nhật: Không báo alert nữa, chuyển xuống render UI thất bại.
                    isHubError = true;
                }
            }
        }

        // Vẫn lưu vào kiện dù hợp lệ hay không để hiển thị Lỗi dưới UI
        const updatedOrderDescriptions = [code, ...activePkg.orderDescriptions];
        setPackage(activePkg, { orderDescriptions: updatedOrderDescriptions });

        if (orderMatchIdx !== -1) {
            const orderMatch = orders[orderMatchIdx];
            const status = orderMatch.Status || 'Chờ xử lý';
            const pkgContainingOrder = packages.find(p => p.id !== activePkg.id && p.orderDescriptions.includes(code));

            // Chỉ cập nhật trạng thái đơn thành 'Đóng kiện' nếu hoàn toàn hợp lệ và KHÔNG bị lỗi HUB
            if (!pkgContainingOrder && status === 'Chờ xử lý' && !isHubError) {
                const now = new Date();
                const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')} ${now.getDate().toString().padStart(2, '0')}/${(now.getMonth()+1).toString().padStart(2, '0')}/${now.getFullYear()}`;
                const newLog = {
                    action: `Quét ghép vào Kiện ${activePkg.id}`,
                    user: currentUser ? currentUser.displayName : "Hệ thống",
                    timestamp: timeString
                };
                updateOrder(orderMatch.id, {
                    Status: 'Đóng kiện',
                    ActionHistory: [...(orderMatch.ActionHistory || []), newLog]
                });
                
                try {
                    const orderRef = doc(db, 'orders', orderMatch.id);
                    updateDoc(orderRef, {
                        Status: 'Đóng kiện',
                        ActionHistory: [...(orderMatch.ActionHistory || []), newLog]
                    });
                } catch (e) {
                    console.error("Lỗi cập nhật CSDL đóng kiện:", e);
                }
            }
        }

        setScanInput("");
    };

    const isClosed = activePkg.status === 'Đã xuất kho Việt Nam' || activePkg.status === 'Delivered';

    const togglePackageStatus = async () => {
        if (activePkg.status === 'Delivered') {
            await showAlert("Kiện hàng này đã DELIVERED tại Kho Mỹ, KHÔNG THỂ mở lại được!");
            return;
        }

        if (isClosed) {
            if(await showConfirm("Bạn có chắc muốn Mở lại kiện hàng này để tiếp tục quét đơn không?")) {
                // Mở lại thì dùng trạng thái Đang xử lý hoặc Đóng kiện, và xóa ngày đóng
                setPackage(activePkg, { status: 'Đóng kiện', closedAt: '' });
            }
        } else {
            if(await showConfirm("Xác nhận chốt kiện hàng và xuất kho? Mọi đơn hàng bên trong sẽ được khóa.")) {
                const now = new Date();
                const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')} ${now.getDate().toString().padStart(2, '0')}/${(now.getMonth()+1).toString().padStart(2, '0')}/${now.getFullYear()}`;
                
                setPackage(activePkg, { status: 'Đã xuất kho Việt Nam', closedAt: timeString });
                await showAlert("Đã chốt kiện hàng thành công!");
            }
        }
    };

    const markAsDelivered = async () => {
        if(await showConfirm("Xác nhận Kho Mỹ đã nhận được kiện hàng này? (Trạng thái sẽ đổi thành Delivered)")) {
            setPackage(activePkg, { status: 'Delivered' });
            await showAlert("Đã cập nhật kiện thành Delivered!");
        }
    };

    const handleRemoveOrder = async (code: string) => {
        if (!await showConfirm(`Bạn có chắc muốn gỡ đơn ${code} khỏi kiện này?`)) return;

        // Xóa khỏi kiện
        const updatedOrderDescriptions = activePkg.orderDescriptions.filter((c: string) => c !== code);
        setPackage(activePkg, { orderDescriptions: updatedOrderDescriptions });

        // Khôi phục trạng thái đơn hàng (chỉ khi nó đang là 'Đóng kiện')
        const orderMatchIdx = orders.findIndex(o => o.Description === code);
        if (orderMatchIdx !== -1) {
            const orderMatch = orders[orderMatchIdx];
            
            if (orderMatch.Status === 'Đóng kiện') {
                const now = new Date();
                const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')} ${now.getDate().toString().padStart(2, '0')}/${(now.getMonth()+1).toString().padStart(2, '0')}/${now.getFullYear()}`;
                
                const newLog = {
                    action: `Gỡ khỏi Kiện ${activePkg.id}`,
                    user: currentUser ? currentUser.displayName : "Hệ thống",
                    timestamp: timeString
                };
                
                updateOrder(orderMatch.id, {
                    Status: 'Chờ xử lý',
                    ActionHistory: [...(orderMatch.ActionHistory || []), newLog]
                });
                
                try {
                    const orderRef = doc(db, 'orders', orderMatch.id);
                    updateDoc(orderRef, {
                        Status: 'Chờ xử lý',
                        ActionHistory: [...(orderMatch.ActionHistory || []), newLog]
                    });
                } catch (e) {
                    console.error("Lỗi cập nhật CSDL gỡ kiện:", e);
                }
            }
        }
    };

    const handleDeletePackage = async () => {
        if (isClosed) {
            await showAlert("Kiện hàng đã bị Đóng/Xuất kho! Bạn phải thao tác Mở lại kiện trước mới có quyền Hủy.");
            return;
        }

        if (activePkg.orderDescriptions.length > 0) {
            await showAlert("Lỗi: Kiện hàng đang chứa dữ liệu! Vui lòng thao tác 'Hủy' từng đơn hàng bên trong để làm rỗng kiện trước khi Hủy kiện.");
            return;
        }

        if(await showConfirm(`Bạn có chắc muốn hủy kiện rỗng ${activePkg.id}?`)) {
            deletePackage(activePkg.id);
            import('firebase/firestore').then(({ deleteDoc, doc }) => deleteDoc(doc(db, 'packages', activePkg.id)).catch(e=>console.error(e)));
            router.push('/packages');
        }
    };

    const exportExcel = async () => {
        const validCodes = activePkg.orderDescriptions.filter((code: string) => {
            const o = orders.find(x => x.Description === code);
            return o && (o.Status === 'Đóng kiện' || o.Status === 'Kho Mỹ đã scan');
        });

        if (validCodes.length === 0) {
            await showAlert("Không có đơn hàng thành công nào trong kiện để xuất!");
            return;
        }

        const templateHeaders = [
            "Sender Name", "Sender Company", "Sender Address1", "Sender Address2", "Sender City", "Sender State", "Sender Zipcode", "Sender Phone",
            "Receiver Name", "Receiver Company", "Receiver Address 1", "Receiver Address 2", "Receiver City", "Receiver State", "Receiver Zip", "Receiver Phone",
            "Weight (lbs)", "Length (in)", "Width (in)", "Height (in)", "Description", "Reference1", "Reference2", "SenderCountry", "ReceiverCountry", "TRACKING",
            "UploadDate", "pdfUrl", "HUB"
        ];

        const cleanData = validCodes.map((code: string) => {
            const order = orders.find(o => o.Description === code);
            if (!order) return {};
            const { pdfBase64, ActionHistory, originalIndex, Status, ...rest } = order;
            
            const rowData: any = {};
            templateHeaders.forEach(header => { rowData[header] = ""; }); // Khởi tạo rỗng để bảo tồn cột

            rowData["Weight (lbs)"] = rest["Weight (lbs)"] || rest.Weight_lbs || rest.Weight || "";
            rowData["Length (in)"] = rest["Length (in)"] || rest.Length_inch || rest.Length || "";
            rowData["Width (in)"] = rest["Width (in)"] || rest.Width_inch || rest.Width || "";
            rowData["Height (in)"] = rest["Height (in)"] || rest.Height_inch || rest.Height || "";
            rowData["TRACKING"] = rest.TrackingNumber || rest.TRACKING || "";
            rowData["HUB"] = rest.HUB || rest.Hub || "";

            Object.keys(rest).forEach(k => {
                if (k !== 'Weight' && k !== 'Length' && k !== 'Width' && k !== 'Height' && k !== 'Hub' && k !== 'TrackingNumber' && k !== 'createdAt' && k !== 'Status' && k !== 'id' && !templateHeaders.includes(k)) {
                    rowData[k] = rest[k];
                } else if (templateHeaders.includes(k) && rest[k]) {
                    rowData[k] = rest[k];
                }
            });

            rowData['Trạng thái'] = 'Đóng kiện';
            rowData['Kiện Hàng'] = activePkg.id;
            rowData['Track Kiện'] = activePkg.masterTracking || "Chưa có";
            return rowData;
        });

        const allKeys = new Set<string>();
        cleanData.forEach((item: any) => Object.keys(item).forEach(k => allKeys.add(k)));

        const finalHeaders: string[] = [...templateHeaders];
        allKeys.forEach(k => {
            if (!finalHeaders.includes(k) && k !== 'Trạng thái' && k !== 'Kiện Hàng' && k !== 'Track Kiện') {
                finalHeaders.push(k);
            }
        });

        finalHeaders.push('Trạng thái', 'Kiện Hàng', 'Track Kiện');

        // Báo cho xlsx biết tao muốn ép theo cấu trúc này
        const worksheet = xlsx.utils.json_to_sheet(cleanData, { header: finalHeaders });
        const workbook = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(workbook, worksheet, activePkg.id);
        
        const excelBuffer = xlsx.write(workbook, { bookType: 'xlsx', type: 'array' });
        const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' });
        saveAs(data, `KienHang_${activePkg.id}_${new Date().getTime()}.xlsx`);
    };

    return (
        <div className="flex flex-col h-full mt-2">
            {/* Thanh điều hướng */}
            <div className="mb-6 flex items-center">
                <button onClick={() => router.push('/packages')} className="text-slate-800 hover:text-slate-600 transition flex items-center gap-2 font-bold text-xl tracking-tight">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
                    Danh sách kiện hàng
                </button>
            </div>

            {/* Thông tin Header */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm mb-6 flex flex-wrap lg:flex-nowrap items-stretch justify-between gap-6">
                <div className="flex flex-col gap-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Mã kiện</p>
                    <div className="flex items-center gap-2">
                        <span className="font-black font-mono text-slate-800 text-xl tracking-tight">{activePkg.id}</span>
                        <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm14 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"></path></svg>
                    </div>
                </div>
                
                <div className="hidden lg:block w-px bg-slate-100"></div>

                <div className="flex flex-col gap-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Ngày tạo</p>
                    <p className="font-bold text-slate-600 text-sm">{activePkg.createdAt}</p>
                </div>

                {activePkg.closedAt && (
                    <>
                        <div className="hidden lg:block w-px bg-slate-100"></div>
                        <div className="flex flex-col gap-1.5">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Ngày đóng (Chốt)</p>
                            <p className="font-bold text-emerald-600 text-sm">{activePkg.closedAt}</p>
                        </div>
                    </>
                )}

                <div className="hidden lg:block w-px bg-slate-100"></div>
                
                <div className="flex flex-col gap-1.5 justify-center">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Trạng thái kiện</p>
                    <div>
                        <span className={`inline-block px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                            activePkg.status === 'Delivered' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                            activePkg.status.includes('Đã xuất kho') ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                            'bg-indigo-50 text-indigo-700 border-indigo-200'
                        }`}>
                            {activePkg.status === 'Delivered' ? 'DELIVERED (ĐÃ NHẬN)' : activePkg.status}
                        </span>
                    </div>
                </div>

                <div className="hidden lg:block w-px bg-slate-100"></div>

                <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Track tổng</p>
                    <input
                        type="text"
                        placeholder="Nhập track tổng..."
                        className="bg-transparent border-b-2 border-indigo-400 text-indigo-700 font-mono font-bold text-base focus:outline-none focus:border-indigo-600 placeholder-slate-300 transition-all w-full pb-1"
                        value={activePkg.masterTracking || ''}
                        onChange={(e) => setPackage(activePkg, { masterTracking: e.target.value })}
                    />
                </div>

                <div className="hidden lg:block w-px bg-slate-100"></div>

                <div className="flex flex-col gap-1.5 items-end justify-center min-w-[120px]">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Đơn thành công</p>
                    <div className="flex items-baseline gap-1">
                        <span className="font-black text-2xl text-slate-800 tracking-tight leading-none">
                            {activePkg.orderDescriptions.filter((code: string) => {
                                const orderData = orders.find(x => x.Description === code);
                                if (!orderData) return false;
                                const pkgContainingOrder = packages.find(p => p.id !== activePkg.id && p.orderDescriptions.includes(code));
                                return !pkgContainingOrder && (orderData.Status === 'Đóng kiện' || orderData.Status === 'Kho Mỹ đã scan');
                            }).length}
                        </span>
                        <span className="text-xs font-bold text-slate-400">/ {activePkg.orderDescriptions.length}</span>
                    </div>
                </div>

                <div className="hidden lg:block w-px bg-slate-100"></div>

                <div className="flex items-center gap-4">
                    <button onClick={exportExcel} className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition text-sm flex items-center gap-2 shadow-sm">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                        Xuất Excel
                    </button>
                    <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-slate-500 hover:text-slate-800 transition select-none bg-slate-50 border border-slate-200 hover:border-slate-300 px-4 py-3 rounded-xl shadow-sm">
                        <input 
                            type="checkbox" 
                            checked={showErrorsOnly} 
                            onChange={(e) => setShowErrorsOnly(e.target.checked)} 
                            className="w-5 h-5 rounded border-2 border-slate-300 bg-white text-indigo-600 focus:ring-0 focus:ring-offset-0"
                        />
                        Chỉ hiển thị đơn lỗi
                    </label>
                </div>
            </div>

            {/* Toolbar: Tìm kiếm & Nút thao tác */}
            <div className="flex flex-wrap items-center gap-4 mb-6">
                <form onSubmit={handleScanSubmit} className="flex-1 flex gap-2">
                    <div className="relative flex-1 max-w-md">
                        <svg className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                        <input 
                            ref={scanInputRef}
                            type="text" 
                            value={scanInput}
                            onChange={(e) => setScanInput(e.target.value)}
                            placeholder={isClosed ? "Kiện hàng đã Đóng, không thể quét thêm" : (isScanning ? "Tìm theo thẻ tracking hoặc Quét mã..." : "Bấm 'Bắt đầu quét' để mở khóa...")}
                            className="w-full pl-10 pr-4 py-2.5 bg-white text-indigo-900 font-bold border-2 border-indigo-400 rounded-lg outline-none focus:border-indigo-600 shadow-sm disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed disabled:border-gray-200 transition-all"
                            disabled={!isScanning || isClosed}
                        />
                    </div>
                    <button type="submit" disabled={!isScanning || isClosed} className="px-4 py-2.5 bg-[#e0f2f1] text-[#009688] font-bold rounded-md hover:bg-[#b2dfdb] disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-1">
                        + Thêm
                    </button>
                </form>

                <div className="flex gap-3">
                    {!isClosed && (
                        <button 
                            type="button"
                            onClick={() => {
                                setIsScanning(!isScanning);
                                if (!isScanning) {
                                    setTimeout(() => scanInputRef.current?.focus(), 100);
                                }
                            }}
                            className={`px-5 py-2.5 text-white font-bold rounded-md transition text-sm ${isScanning ? 'bg-red-500 hover:bg-red-400 shadow-[0_0_12px_rgba(239,68,68,0.4)]' : 'bg-[#009688] hover:bg-[#00796b]'}`}
                        >
                            {isScanning ? "Dừng quét" : "Bắt đầu quét"}
                        </button>
                    )}
                    <button 
                        onClick={togglePackageStatus} 
                        disabled={activePkg.status === 'Delivered'}
                        title={activePkg.status === 'Delivered' ? "Đã hạ cánh tại Mỹ, khóa chức năng mở lại kiện" : ""}
                        className={`px-5 py-2.5 font-bold rounded-md transition text-sm ${
                            activePkg.status === 'Delivered' ? 'bg-slate-200 text-slate-500 cursor-not-allowed opacity-70' :
                            isClosed ? 'bg-amber-600 hover:bg-amber-500 text-white' : 
                            'bg-[#009688] hover:bg-[#00796b] text-white'
                        }`}
                    >
                        {isClosed ? "Mở lại kiện" : "Đóng kiện hàng"}
                    </button>
                    {activePkg.status === 'Đã xuất kho Việt Nam' && (
                        <button onClick={markAsDelivered} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-md transition text-sm shadow-md shadow-blue-500/20">
                            Kho Mỹ Đã Nhận (Delivered)
                        </button>
                    )}
                    {currentUser?.role !== 'support' && (
                        <button 
                            onClick={handleDeletePackage} 
                            className={`px-5 py-2.5 font-bold rounded-md transition text-sm ${isClosed ? 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-50' : 'bg-transparent border border-red-500 text-red-500 hover:bg-red-500/10'}`}
                            disabled={isClosed}
                        >
                            Hủy kiện hàng
                        </button>
                    )}
                </div>
            </div>

            {/* Content Body */}
            <div className="flex-1 bg-white rounded-lg border border-gray-200 overflow-hidden flex flex-col min-h-[400px]">
                {(() => {
                    const displayedCodes = activePkg.orderDescriptions.filter((code: string) => {
                        if (!showErrorsOnly) return true;
                        const orderData = orders.find(o => o.Description === code);
                        if (!orderData) return true;
                        const pkgContainingOrder = packages.find(p => p.id !== activePkg.id && p.orderDescriptions.includes(code));
                        if (pkgContainingOrder) return true;
                        if (orderData.Status !== 'Đóng kiện') return true;
                        return false;
                    });

                    const itemsPerPage = 8;
                    const totalPages = Math.ceil(displayedCodes.length / itemsPerPage);
                    const safePage = Math.max(1, Math.min(currentPage, Math.max(1, totalPages)));
                    const paginatedCodes = displayedCodes.slice((safePage - 1) * itemsPerPage, safePage * itemsPerPage);

                    if (displayedCodes.length === 0) {
                        return (
                            <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
                                <div className="w-24 h-24 mx-auto mb-4 text-slate-200">
                                    <svg fill="currentColor" viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" /></svg>
                                </div>
                                <p className="text-slate-500 font-bold">{showErrorsOnly ? "Không có đơn lỗi nào" : "Không có bản ghi nào!"}</p>
                            </div>
                        );
                    }

                    return (
                        <div className="w-full h-full bg-white flex flex-col min-h-0">
                            <div className="flex-1 overflow-x-auto custom-scrollbar">
                                <table className="w-full text-left border-collapse text-sm text-gray-700 min-w-[700px]">
                                <thead className="bg-[#f9fafb] border-b border-gray-100 sticky top-0 z-10">
                                    <tr>
                                        <th className="px-6 py-4 font-bold uppercase tracking-widest text-[10px] text-gray-400">MÃ ĐƠN HÀNG</th>
                                        <th className="px-6 py-4 font-bold uppercase tracking-widest text-[10px] text-gray-400">TÊN NGƯỜI NHẬN</th>
                                        <th className="px-6 py-4 font-bold uppercase tracking-widest text-[10px] text-gray-400">TRACK</th>
                                        <th className="px-6 py-4 font-bold uppercase tracking-widest text-[10px] text-gray-400">TRẠNG THÁI QUÉT</th>
                                        <th className="px-6 py-4 font-bold uppercase tracking-widest text-[10px] text-gray-400 text-right">THAO TÁC</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {paginatedCodes.map((code: string) => {
                                    const orderData = orders.find(o => o.Description === code);
                                    const receiver = orderData?.['Receiver Name'] || "—";
                                    const tracking = orderData?.TrackingNumber || "—";
                                    const canRemove = !isClosed;

                                    let isSuccess = false;
                                    let warningText = "";
                                    
                                    if (!orderData) {
                                        warningText = "Lỗi: Không tồn tại";
                                    } else {
                                        const pkgContainingOrder = packages.find(p => p.id !== activePkg.id && p.orderDescriptions.includes(code));
                                        
                                        const orderHub = (orderData.HUB || orderData.Hub || "").toString().toUpperCase().trim();
                                        const pkgDest = (activePkg.destination || "").toString().toUpperCase().trim();
                                        let isHubErr = false;
                                        if (orderHub && pkgDest) {
                                            const cleanOrderHub = orderHub.replace("HUB", "").trim();
                                            const cleanPkgDest = pkgDest.replace("HUB", "").trim();
                                            if (cleanOrderHub !== cleanPkgDest && cleanOrderHub !== "" && cleanPkgDest !== "") {
                                                isHubErr = true;
                                            }
                                        }

                                        if (pkgContainingOrder) {
                                            warningText = `Lỗi trùng lặp: Mã này đang nằm ở kiện [${pkgContainingOrder.id}]`;
                                        } else if (isHubErr) {
                                            warningText = `Lỗi sai HUB: Đơn thuộc Trạm [${orderData.HUB || orderData.Hub}] bị quét nhầm vào kiện của Kho [${activePkg.destination}]`;
                                        } else if (orderData.Status === 'Đóng kiện' || orderData.Status === 'Kho Mỹ đã scan') {
                                            isSuccess = true;
                                        } else {
                                            warningText = `Lỗi sai trạng thái: Đơn này đang là [${orderData.Status || 'Chưa rõ'}] (Yêu cầu: Chờ xử lý)`;
                                        }
                                    }

                                    return (
                                        <tr key={code} className={`hover:bg-gray-50/50 transition ${!isSuccess ? 'bg-red-50/30' : ''}`}>
                                            <td className="px-6 py-4 font-mono font-bold">
                                                <a href={`/orders?search=${encodeURIComponent(code)}`} target="_blank" className="text-[#009688] hover:text-[#00796b] hover:underline flex items-center gap-1.5 group relative w-fit transition-all">
                                                    {code}
                                                    <svg className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition text-[#009688]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                                                </a>
                                            </td>
                                            <td className="px-6 py-4 text-gray-800 font-medium">{receiver}</td>
                                            <td className="px-6 py-4 font-mono font-medium">
                                                {tracking !== "—" ? (
                                                    <a 
                                                        href={`https://tools.usps.com/go/TrackConfirmAction?tRef=fullpage&tLc=2&text28777=&tLabels=${tracking}%2C`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1.5 group relative w-fit transition-all"
                                                    >
                                                        {tracking}
                                                        <svg className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition absolute -right-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                                                    </a>
                                                ) : (
                                                    <span className="text-gray-400">Chưa có</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                {isSuccess ? (
                                                    <span className="px-3 py-1 bg-[#e8f5e9] text-[#2e7d32] border border-[#c8e6c9] rounded-full text-xs font-bold">Thành công</span>
                                                ) : (
                                                    <button 
                                                        onClick={async () => await showAlert(`Chi tiết lỗi của mã ${code}:\n\n${warningText}\n\nVui lòng Gỡ mã này ra khỏi kiện.`)}
                                                        className="px-3 py-1 bg-red-100 text-red-600 border border-red-200 hover:bg-red-200 transition rounded-full text-xs font-bold flex items-center gap-1"
                                                        title={warningText}
                                                    >
                                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                                                        Thất bại (Xem)
                                                    </button>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {canRemove ? (
                                                    <button 
                                                        onClick={() => handleRemoveOrder(code)}
                                                        className="px-3 py-1.5 min-w-[70px] bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 rounded transition text-xs font-bold"
                                                    >
                                                        Hủy
                                                    </button>
                                                ) : (
                                                    <span className="px-3 py-1.5 min-w-[70px] inline-block bg-gray-100 text-gray-400 rounded text-xs font-bold grayscale cursor-not-allowed">Đã khóa</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            </table>
                        </div>

                        {/* Phân trang */}
                        {totalPages > 1 && (
                            <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex items-center justify-between w-full mt-auto shrink-0">
                                <span className="text-sm font-medium text-slate-500">
                                    Chi tiết từ <strong className="text-slate-800">{(safePage - 1) * itemsPerPage + 1}</strong> đến <strong className="text-slate-800">{Math.min(safePage * itemsPerPage, displayedCodes.length)}</strong> / <strong className="text-slate-800">{displayedCodes.length}</strong> đơn
                                </span>
                                <div className="flex gap-1 items-center">
                                    <button 
                                        disabled={safePage === 1}
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        className="px-2 py-1.5 rounded border border-slate-200 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 disabled:opacity-50 transition-all"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
                                    </button>
                                    
                                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                                        // Chỉ hiện lân cận trang hiện tại cho gọn (ví dụ trang đầu, cuối, và trang hiện tại +- 1)
                                        if (page === 1 || page === totalPages || (page >= safePage - 1 && page <= safePage + 1)) {
                                            return (
                                                <button
                                                    key={page}
                                                    onClick={() => setCurrentPage(page)}
                                                    className={`w-8 h-8 rounded text-sm font-bold flex items-center justify-center transition-all ${safePage === page ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200 bg-transparent'}`}
                                                >
                                                    {page}
                                                </button>
                                            )
                                        }
                                        if (page === safePage - 2 || page === safePage + 2) {
                                            return <span key={`dots-${page}`} className="text-slate-400 px-1">...</span>;
                                        }
                                        return null;
                                    })}

                                    <button 
                                        disabled={safePage === totalPages}
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        className="px-2 py-1.5 rounded border border-slate-200 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 disabled:opacity-50 transition-all"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                    );
                })()}
            </div>
        </div>
    );
}
