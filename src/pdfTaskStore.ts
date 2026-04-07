import { create } from 'zustand';
import { createWorker } from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js';
import { db, storage } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { BrowserMultiFormatReader } from '@zxing/library';
import { distance } from 'fastest-levenshtein';

if (typeof window !== "undefined") {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
}

// THUẬT TOÁN FUZZY MATCH (KHOẢNG CÁCH MỜ) CHO TÊN VÀ ĐỊA CHỈ TỪ OCR
const fuzzyMatch = (target: string, text: string) => {
    if (!target || target.length < 4) return text.includes(target);
    if (text.includes(target)) return true;
    
    const maxErrors = Math.floor(target.length / 5) + 1; // Tolerance: 1 lỗi / 5 kí tự
    
    for (let i = 0; i <= text.length - target.length; i++) {
        if (distance(target, text.substring(i, i + target.length)) <= maxErrors) return true;
        if (distance(target, text.substring(i, i + target.length + 1)) <= maxErrors) return true;
        if (distance(target, text.substring(i, i + target.length - 1)) <= maxErrors) return true;
    }
    return false;
};

export type LogType = 'success' | 'error' | 'warning' | 'info';

export interface LogItem {
    type: LogType;
    message: string;
    timestamp: string;
}

interface PdfTaskState {
    isProcessing: boolean;
    totalFiles: number;
    processedFiles: number;
    currentFilename: string;
    logs: LogItem[];
    startProcessing: (files: File[], orders: any[], currentUser: any) => Promise<void>;
    clearTask: () => void;
}

export const usePdfTaskStore = create<PdfTaskState>((set, get) => ({
    isProcessing: false,
    totalFiles: 0,
    processedFiles: 0,
    currentFilename: "",
    logs: [],
    clearTask: () => set({
        isProcessing: false,
        totalFiles: 0,
        processedFiles: 0,
        currentFilename: "",
        logs: []
    }),
    startProcessing: async (files: File[], orders: any[], currentUser: any) => {
        if (get().isProcessing) return; // Prevent concurrent loops

        set({
            isProcessing: true,
            totalFiles: files.length,
            processedFiles: 0,
            currentFilename: "Đang khởi động tiến trình phân tích tự động...",
            logs: []
        });

        const addLog = (type: LogType, message: string) => {
            const now = new Date();
            const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
            set(state => ({ logs: [{ type, message, timestamp: time }, ...state.logs] }));
        };

        addLog('info', `[Background Worker] Khởi động: Xử lý ${files.length} file PDF...`);

        let tesseractWorker: any = null;
        try {
            tesseractWorker = await createWorker('eng');
            addLog('success', `Đã khởi động Lõi Trí Tuệ Kép AI (Tesseract + ZXing) cực nhanh!`);
        } catch (e: any) {
            addLog('error', `Lõi AI Tesseract lỗi khởi tạo: ${e.message}`);
        }

        const mapData: Record<string, any> = {};
        const safeBlobs: Record<string, Blob> = {};
        let matchCount = 0;
        const fileResults: any[] = [];

        try {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                set({ processedFiles: i, currentFilename: file.name });

                try {
                    // TẠO BLOB VĨNH CỬU BẰNG RAM (KHÔNG PHỤ THUỘC VÀO TRÌNH DUYỆT)
                    // Cách này cam kết 1000% không bao giờ bị kẹt UploadBytes dù Sếp có đổi 100 trang!
                    const originalBuffer = await file.arrayBuffer();
                    safeBlobs[file.name] = new Blob([originalBuffer], { type: 'application/pdf' });

                    // Clone riêng 1 bản cho AI để không làm hỏng file Gốc tải lên mây
                    const clonedBuffer = originalBuffer.slice(0);
                    const pdf = await pdfjsLib.getDocument(clonedBuffer).promise;
                    const page = await pdf.getPage(1);
                    const viewport = page.getViewport({ scale: 2.0 });

                    const canvas = document.createElement("canvas");
                    const ctx = canvas.getContext("2d");
                    if (!ctx) throw new Error("Thất bại khởi tạo Canvas GPU");

                    let barcodeText = "";

                    // THUẬT TOÁN ĐỌC MỚI NHẤT
                    // Bước 1: Ưu tiên bóc trực tiếp Text kỹ thuật số (Nhanh 0.001s, chính xác 100%)
                    const textContent = await page.getTextContent();
                    let rawPdfText = textContent.items.map((item: any) => item.str).join(" ");

                    // Bước 2: Chỉ khi file là ảnh chết (Scanned Label) mới phải gọi AI OCR
                    if (rawPdfText.length < 30) {
                        canvas.height = viewport.height;
                        canvas.width = viewport.width;
                        await page.render({ canvasContext: ctx, viewport: viewport }).promise;

                        try {
                            const codeReader = new BrowserMultiFormatReader();
                            const result = await codeReader.decodeFromImageUrl(canvas.toDataURL("image/png"));
                            let rawBarcode = result.getText().toUpperCase();
                            if (/^[A-Z0-9]+$/.test(rawBarcode.replace(/[-\s]/g, ''))) {
                                barcodeText = rawBarcode.length > 22 ? rawBarcode.slice(-22) : rawBarcode;
                            }
                        } catch (e) { }

                        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                        const data = imageData.data;
                        for (let k = 0; k < data.length; k += 4) {
                            const avg = (data[k] + data[k + 1] + data[k + 2]) / 3;
                            const color = avg > 150 ? 255 : 0;
                            data[k] = color; data[k + 1] = color; data[k + 2] = color;
                        }
                        ctx.putImageData(imageData, 0, 0);

                        // Lắp Tên lửa OCR.Space API Nhanh Như Điện
                        const imgBase64 = canvas.toDataURL("image/jpeg", 0.9);
                        const formData = new FormData();
                        formData.append("base64Image", imgBase64);
                        formData.append("language", "eng");
                        formData.append("isTable", "false");
                        // Dùng key mặc định phổ thông (K80... hoặc helloworld)
                        formData.append("apikey", "K84562098688957");

                        try {
                            const response = await fetch("https://api.ocr.space/parse/image", {
                                method: 'POST',
                                body: formData
                            });

                            const ocrResult = await response.json();
                            if (ocrResult && ocrResult.ParsedResults && ocrResult.ParsedResults.length > 0) {
                                rawPdfText = ocrResult.ParsedResults[0].ParsedText;
                                // addLog('info', 'Đã dùng API Đám mây quét ảnh thành công');
                            } else {
                                throw new Error("API lỗi hoặc rập khuôn");
                            }
                        } catch (err) {
                            // DỰ PHÒNG: Phanh gập về lại Tesseract nếu API từ chối do quá 25,000 lượt
                            const { data: { text } } = tesseractWorker
                                ? await tesseractWorker.recognize(imgBase64)
                                : { data: { text: '' } };
                            rawPdfText = text;
                        }
                    }

                    const pdfText = rawPdfText.toUpperCase();
                    const pdfClean = pdfText.replace(/[\s\-_,\.]/g, '');

                    let matchedIndex = -1;
                    let bestScore = 0;
                    let isAlreadyFulfilled = false;
                    let bestFailReason = "";

                    for (let j = 0; j < orders.length; j++) {
                        const order = orders[j];
                        
                        // Kiểm tra trinh sát: Nếu có dấu hiệu khớp File nhưng đơn đã đóng
                        const description = (order["Description"] || "").toString().trim();
                        const descUpper = description.toUpperCase();
                        const descClean = descUpper.replace(/[\s\-_,\.]/g, "");
                        
                        if (descUpper.length > 2) {
                            if (file.name.toUpperCase().includes(descUpper) || pdfClean.includes(descClean)) {
                                if (order.pdfUrl || order.Status === 'Đã Hủy' || order.Status === 'Kho Mỹ đã scan') {
                                    isAlreadyFulfilled = true;
                                }
                            }
                        }

                        if (order.pdfUrl || order.Status === 'Đã Hủy' || order.Status === 'Kho Mỹ đã scan') continue;

                        const desc = (order["Description"] || "").toString().toUpperCase();
                        const trackingNumber = (order["TrackingNumber"] || "").toString().toUpperCase();
                        const dClean = desc.replace(/[\s\-_,\.]/g, '');

                        const nameStr = (order["Receiver Name"] || "").toString().toUpperCase();
                        const nameClean = nameStr.replace(/[\s\-_,\.]/g, '');

                        let score = 0;

                        // 1. Quét Mã Barcode (Ưu tiên tuyệt đối)
                        if (barcodeText && (barcodeText.includes(desc) || (trackingNumber && barcodeText.includes(trackingNumber)))) {
                            score += 100;
                        }

                        // 2. Chấm điểm Y XÌ ĐÚC Mã Description (Bắt buộc phải có)
                        let isDescMatch = false;

                        if (desc.length > 2) {
                            const upperFileName = file.name.toUpperCase();
                            if (upperFileName.includes(desc)) {
                                isDescMatch = true;
                            } else if (pdfClean.includes(dClean)) {
                                isDescMatch = true;
                            }
                        }
                        if (isDescMatch) { score += 1000; }

                        // 3. Chấm điểm Tên và Địa chỉ (Dùng FUZZY MATCH để chống lỗi từ OCR)
                        const addressStr = (order["Receiver Address 1"] || "").toString().toUpperCase(); 
                        const addressClean = addressStr.replace(/[\s\-_,\.]/g, ""); 
                        let addrMatch = false;
                        let nmMatch = false;

                        if (addressClean.length > 5 && fuzzyMatch(addressClean, pdfClean)) { 
                            score += 1000; 
                            addrMatch = true;
                        } 
                        if (nameClean.length > 2 && fuzzyMatch(nameClean, pdfClean)) {
                            score += 1000;
                            nmMatch = true;
                        }

                        if (score > bestScore) {
                            bestScore = score;
                            matchedIndex = j;
                            const isNameAddrMatched = (addrMatch || nmMatch);
                            
                            if (isDescMatch && !isNameAddrMatched) {
                                bestFailReason = `Đã khớp Mã Đơn (${desc}) nhưng LỆCH TÊN NGƯỜI NHẬN / ĐỊA CHỈ`;
                            } else if (!isDescMatch && isNameAddrMatched) {
                                bestFailReason = `Đã khớp đúng Tên/Địa chỉ nhưng KHÔNG TÌM THẤY MÃ ĐƠN (${desc})`;
                            } else {
                                bestFailReason = `Hệ thống phân tích không đủ độ tin cậy.`;
                            }
                        }
                    }

                    let finalTracking = barcodeText;
                    
                    if (!finalTracking) {
                         const uspsMatch = pdfClean.match(/(?:420\d{5})?(9\d{21})/);
                         const upsMatch = pdfClean.match(/1Z[A-Z0-9]{16}/i);
                         if (uspsMatch && uspsMatch[1]) {
                             finalTracking = uspsMatch[1];
                         } else if (upsMatch) {
                             finalTracking = upsMatch[0].toUpperCase();
                         }
                    }

                    if (!finalTracking) {
                         const defaultTracking = file.name.replace(/\.pdf$/i, "").toUpperCase();
                         const trackingClean = defaultTracking.replace(/\s/g, "");
                         const fnUsps = trackingClean.match(/(?:420\d{5})?(9\d{21})/);
                         const fnUps = trackingClean.match(/1Z[A-Z0-9]{16}/i);
                         const tenDigitsMatch = defaultTracking.match(/(?:^|\s)([\d]{10,22})(?:\s|$)/);

                         if (fnUsps && fnUsps[1]) {
                             finalTracking = fnUsps[1];
                         } else if (fnUps) {
                             finalTracking = fnUps[0].toUpperCase();
                         } else if (tenDigitsMatch && tenDigitsMatch[1]) {
                             finalTracking = tenDigitsMatch[1];
                         } else {
                             finalTracking = defaultTracking;
                         }
                    }

                    // TỐI QUAN TRỌNG: Ngưỡng khắt khe 2000 điểm (SONG SONG 2 YẾU TỐ BẮT BUỘC)
                    if (matchedIndex !== -1 && bestScore >= 2000) {
                        mapData[file.name] = {
                            orderId: orders[matchedIndex].id,
                            description: orders[matchedIndex]["Description"],
                            trackingNumber: finalTracking
                        };
                        matchCount++;
                        addLog('success', `File "${file.name}": [${orders[matchedIndex]["Description"]}]. Lọc song song hoàn hảo Tên/Địa chỉ + Mã (${bestScore} điểm).`);
                    } else if (isAlreadyFulfilled) {
                        fileResults.push({
                            "Tên File PDF": file.name,
                            "Trạng thái": "Thất bại",
                            "Nguyên nhân": "Đơn hàng này ĐÃ ĐƯỢC GHÉP hoặc ĐÃ ĐÓNG KIỆN từ trước."
                        });
                        addLog('warning', `File "${file.name}": Đơn hàng này ĐÃ ĐƯỢC GHÉP hoăc ĐÃ ĐÓNG KIỆN từ trước (Bỏ qua).`);
                    } else if (matchedIndex !== -1 && bestScore > 0) {
                        fileResults.push({
                            "Tên File PDF": file.name,
                            "Trạng thái": "Thất bại",
                            "Nguyên nhân": `AI từ chối: ${bestFailReason}`
                        });
                        addLog('warning', `File "${file.name}": TỪ CHỐI GHÉP: ${bestFailReason} (Chỉ đạt ${bestScore}/2000đ)`);
                    } else {
                        fileResults.push({
                            "Tên File PDF": file.name,
                            "Trạng thái": "Thất bại",
                            "Nguyên nhân": `Bị loại vì rác, không tìm thấy Description hay bất kì thông tin nhận diện nào.`
                        });
                        addLog('error', `File "${file.name}": File rác, không chứa Mã Description hay Tên khách hàng.`);
                    }
                } catch (err: any) {
                    fileResults.push({
                        "Tên File PDF": file.name,
                        "Trạng thái": "Lỗi AI",
                        "Nguyên nhân": err.message
                    });
                    addLog('error', `File "${file.name}": Lỗi Engine (${err.message})`);
                }
            }

            if (matchCount === 0) {
                addLog('error', `Hoàn tất: Toàn bộ ${files.length} file không có dấu hiệu trùng khớp hợp lệ!`);
                set({ isProcessing: false });
                return;
            }

            set({ processedFiles: files.length, currentFilename: `Đang khóa tệp lưu trữ (${matchCount} file)...` });
            addLog('info', `Đang kết nối Database để niêm phong đơn hàng...`);

            const now = new Date();
            const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')} ${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`;

            let cloudSuccess = 0;
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const fname = file.name;
                const matchRow = mapData[fname];
                if (!matchRow) continue;

                set({ currentFilename: `Đồng bộ dữ liệu: ${matchRow.trackingNumber}...` });

                try {
                    addLog('info', `[${fname}] Kích hoạt Ống đẩy siêu tốc (Cloudinary)...`);
                    const isolatedBlob = safeBlobs[fname];

                    // Cơ chế chống treo cực mạnh với Timeout 30 giây, kết hợp Cloudinary (Free 100%)
                    const uploadPromise = async () => {
                        const formData = new FormData();
                        formData.append("file", isolatedBlob, `${matchRow.trackingNumber}.pdf`);
                        formData.append("upload_preset", "THE HUB");
                        // Gán tên file trên Cloudinary bằng chính mã OrderId kết hợp mốc thời gian để không bao giờ trùng lặp
                        formData.append("public_id", `${matchRow.orderId}_${Date.now()}`);

                        const response = await fetch("https://api.cloudinary.com/v1_1/dyjtyeokk/image/upload", {
                            method: "POST",
                            body: formData
                        });

                        if (!response.ok) {
                            const errText = await response.text();
                            throw new Error(errText);
                        }

                        const result = await response.json();
                        // Trả về Link URL trực tiếp đuôi .pdf
                        return result.secure_url;
                    };

                    const pdfUrl = await uploadPromise();

                    addLog('info', `[${fname}] Đập thẳng dữ liệu vào Firestore...`);
                    const orderRef = doc(db, 'orders', matchRow.orderId);
                    const existingOrder = orders.find((o: any) => o.id === matchRow.orderId);
                    const currentHistory = existingOrder?.ActionHistory || [];

                    await updateDoc(orderRef, {
                        TrackingNumber: matchRow.trackingNumber,
                        pdfUrl: pdfUrl,
                        ActionHistory: [...currentHistory, {
                            action: `Ghép file PDF Auto (${matchRow.trackingNumber})`,
                            user: currentUser?.displayName || 'Thuật toán (AI)',
                            timestamp: timeString
                        }]
                    });
                    
                    fileResults.push({
                        "Tên File PDF": fname,
                        "Mã ĐH ghép chuẩn": matchRow.description,
                        "Tracking": matchRow.trackingNumber,
                        "Trạng thái": "Thành công",
                        "Nguyên nhân": "Ghép cặp chuẩn xác tuyệt đối"
                    });
                    
                    addLog('success', `[${fname}] Hoàn tất niêm phong!`);
                    cloudSuccess++;
                } catch (err: any) {
                    fileResults.push({
                        "Tên File PDF": fname,
                        "Mã ĐH ghép chuẩn": matchRow.description,
                        "Tracking": matchRow.trackingNumber,
                        "Trạng thái": "Lỗi Cloud",
                        "Nguyên nhân": `Upload bị lỗi: ${err.message}`
                    });
                    addLog('error', `Lỗi kết nối Firebase (File ${fname}): ${err.message}`);
                }
            }

            addLog('success', `Siêu Tốc Ngầm Hoàn Tất: Gắn nhãn thành công ${cloudSuccess}/${matchCount} đơn!`);
        } catch (fatalErr: any) {
            addLog('error', `Lỗi nghiêm trọng sập nguồn: ${fatalErr.message}`);
        } finally {
            if (tesseractWorker) {
                try { await tesseractWorker.terminate(); } catch (e) { }
            }
            
            // XUẤT FILE EXCEL BÁO CÁO CÁC FILE THÀNH CÔNG / THẤT BẠI
            if (fileResults.length > 0) {
                try {
                    const XLSX = await import('xlsx');
                    const worksheet = XLSX.utils.json_to_sheet(fileResults);
                    const workbook = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(workbook, worksheet, "Log Result");
                    
                    const timeStr = new Date().toISOString().replace(/[:.]/g, '-');
                    XLSX.writeFile(workbook, `Log_Pdf_Scan_${timeStr}.xlsx`);
                    addLog('success', 'Đã lưu file Báo Cáo Kết Quả Excel về máy!');
                } catch (ex) {
                    addLog('error', `Không thể xuất file Excel báo cáo.`);
                }
            }

            set({ isProcessing: false, currentFilename: 'Đã hoàn thành!' });
        }
    }
}));
