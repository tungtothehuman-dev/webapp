"use client";

import { useState } from "react";
import { useOrderStore } from "@/store";
import { PDFDocument } from "pdf-lib";
import { saveAs } from "file-saver";
import JsBarcode from "jsbarcode";

export default function PrintBarcodePage() {
    const { orders } = useOrderStore();
    const [inputList, setInputList] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);
    
    // Tự động tách danh sách dán vào thành mảng mã vạch (lọc bỏ các dòng trống)
    const codes = inputList.split('\n').map(l => l.trim()).filter(Boolean);

    const handlePrint = async () => {
        if (codes.length === 0) return;
        setIsGenerating(true);
        
        try {
            const A7_WIDTH = 210;
            const A7_HEIGHT = 298;

            const pdfDoc = await PDFDocument.create();

            for (const code of codes) {
                // Find receiver name from orders
                const matchedOrder = orders.find(o => o.Description === code);
                const receiverName = matchedOrder?.["Receiver Name"] || "";

                const canvas = document.createElement("canvas");
                canvas.width = 840; 
                canvas.height = 1192; 
                const ctx = canvas.getContext("2d");
                if (!ctx) continue;

                ctx.fillStyle = "#ffffff";
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                const tempCanvas = document.createElement("canvas");
                JsBarcode(tempCanvas, code, {
                    text: code,
                    height: 120,
                    fontSize: 35,
                    background: "#ffffff",
                    margin: 20
                });

                let bcWidth = tempCanvas.width;
                let bcHeight = tempCanvas.height;
                const maxBcWidth = canvas.width - 120;
                if (bcWidth > maxBcWidth) {
                    const scale = maxBcWidth / bcWidth;
                    bcWidth = maxBcWidth;
                    bcHeight *= scale;
                }
                
                const bcX = (canvas.width - bcWidth) / 2;
                const bcY = (canvas.height / 2) - bcHeight - 60; 
                
                ctx.drawImage(tempCanvas, bcX, bcY, bcWidth, bcHeight);

                if (receiverName) {
                    ctx.fillStyle = "#000000";
                    ctx.font = "bold 55px Arial, sans-serif";
                    ctx.textAlign = "center"; 
                    ctx.fillText(receiverName, canvas.width / 2, bcY + bcHeight + 80, maxBcWidth);
                }

                const imgDataUrl = canvas.toDataURL("image/png");
                const pngImage = await pdfDoc.embedPng(imgDataUrl);
                const page = pdfDoc.addPage([A7_WIDTH, A7_HEIGHT]);
                page.drawImage(pngImage, {
                    x: 0,
                    y: 0,
                    width: A7_WIDTH,
                    height: A7_HEIGHT,
                });
            }

            const pdfBytes = await pdfDoc.save();
            const blob = new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });
            saveAs(blob, `Barcodes_Lo_Hang_${codes.length}_ma.pdf`);
        } catch (error) {
            console.error("Lỗi khi tạo PDF Barcode", error);
            alert("Có lỗi xảy ra khi tạo Mã Vạch PDF.");
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-white border border-slate-200 rounded-2xl p-8 relative shadow-sm">
            <h2 className="text-2xl font-bold text-slate-800 mb-6 tracking-tight">In barcode mã đơn hàng</h2>
            
            <div className="flex flex-col gap-4 mb-8">
                <textarea 
                    className="w-full h-80 bg-white border-2 border-slate-300 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 rounded-2xl p-5 text-indigo-900 font-mono outline-none transition-all placeholder-slate-400 text-base leading-relaxed resize-y shadow-sm"
                    placeholder="Dán danh sách mã Barcode/Description vào đây... (Mỗi mã 1 dòng)"
                    value={inputList}
                    onChange={(e) => setInputList(e.target.value)}
                />
                
                <div className="flex items-center justify-between gap-4 mt-2">
                    <p className="text-sm text-slate-500">
                        Đang có <strong className="text-indigo-600 font-black text-xl mx-1">{codes.length}</strong> mã sẵn sàng để xuất PDF A7.
                    </p>
                    <button 
                        onClick={handlePrint} 
                        disabled={codes.length === 0 || isGenerating} 
                        className="px-8 py-3.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors flex items-center gap-3 shadow-md border border-teal-500/50"
                    >
                        {isGenerating ? (
                           <>
                              <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                              Đang tạo PDF...
                           </>
                        ) : (
                           <>
                              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                              Xuất PDF Tất Cả ({codes.length})
                           </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
