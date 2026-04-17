"use client";

import { useOrderStore, OrderRow, usePackageStore, useWarehouseStore } from '@/store';
import { useAuthStore } from '@/authStore';
import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import * as xlsx from 'xlsx';
import { saveAs } from 'file-saver';

import JsBarcode from 'jsbarcode';
import { PDFDocument } from 'pdf-lib';
import { useModalStore } from '@/modalStore';

export default function OrdersPage() {
  const orders = useOrderStore((state) => state.orders);
  const setOrders = useOrderStore((state) => state.setOrders);
  const clearOrders = useOrderStore((state) => state.clearOrders);
  const updateOrder = useOrderStore((state) => state.updateOrder);
  const packages = usePackageStore((state) => state.packages);
  const warehouses = useWarehouseStore((state) => state.warehouses);
  const { currentUser } = useAuthStore();
  const { showAlert, showConfirm, showPrompt, showLoading, closeModal } = useModalStore();

  const [selectedIndexes, setSelectedIndexes] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [hubFilter, setHubFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState("");
  const [selectedDetail, setSelectedDetail] = useState<OrderRow | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(30);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [bulkDeleteText, setBulkDeleteText] = useState("");


  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTargetId, setUploadTargetId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<{title: string, type: 'success' | 'error'} | null>(null);

  const showToast = (title: string, type: 'success' | 'error') => {
      setToastMsg({ title, type });
      setTimeout(() => setToastMsg(null), 3000);
  };

  const handleManualUploadClick = (id: string) => {
      setUploadTargetId(id);
      if (fileInputRef.current) {
          fileInputRef.current.value = "";
          fileInputRef.current.click();
      }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!uploadTargetId || !e.target.files || e.target.files.length === 0) return;
      const file = e.target.files[0];
      
      showLoading('Đang quét mã vạch từ PDF, vui lòng đợi...');
      let finalTracking = "";

      try {
          // --- AI BARCODE EXTRACTION ---
          const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.js');
          pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
          const { BrowserMultiFormatReader } = await import('@zxing/library');

          const arrayBuffer = await file.arrayBuffer();
          const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
          const pdfDocument = await loadingTask.promise;
          const page = await pdfDocument.getPage(1);
          
          const viewport = page.getViewport({ scale: 2.5 });
          const canvas = document.createElement("canvas");
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          const ctx = canvas.getContext("2d");
          
          let zxingTracking = "";

          if (ctx) {
              await page.render({ canvasContext: ctx, viewport: viewport }).promise;

              try {
                  const codeReader = new BrowserMultiFormatReader();
                  const result = await codeReader.decodeFromImageUrl(canvas.toDataURL("image/png"));
                  let rawBarcode = result.getText().toUpperCase();
                  if (/^[A-Z0-9]+$/.test(rawBarcode.replace(/[-\s]/g, ''))) {
                      zxingTracking = rawBarcode.length > 22 ? rawBarcode.slice(-22) : rawBarcode;
                  }
              } catch (e) {
              }
          }
          
          // Trích xuất text nhúng native (nếu có)
          const textContent = await page.getTextContent();
          let fullTextStr = textContent.items.map((item: any) => item.str).join("").replace(/[\s\-_,\.]/g, "");
          
          const defaultTracking = file.name.replace(/\.pdf$/i, "").toUpperCase();
          const trackingClean = defaultTracking.replace(/[\s\-_,\.]/g, "");
          const fnUsps = trackingClean.match(/(?:420\d{5})?(9\d{21})/);
          const fnUps = trackingClean.match(/1Z[A-Z0-9]{16}/i);

          // Nếu file PDF là ảnh chết (Scanned Label) thì bật Lõi Trí Tuệ Kép OCR.Space
          if (fullTextStr.length < 30 && ctx && !zxingTracking && !fnUsps && !fnUps) {
             try {
                 const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                 const data = imageData.data;
                 for (let k = 0; k < data.length; k += 4) {
                     const avg = (data[k] + data[k + 1] + data[k + 2]) / 3;
                     const color = avg > 150 ? 255 : 0;
                     data[k] = color; data[k + 1] = color; data[k + 2] = color;
                 }
                 ctx.putImageData(imageData, 0, 0);

                 const imgBase64 = canvas.toDataURL("image/jpeg", 0.9);
                 const formData = new FormData();
                 formData.append("base64Image", imgBase64);
                 formData.append("language", "eng");
                 formData.append("isTable", "false");
                 formData.append("apikey", "K84562098688957");
                 
                 const ocrRes = await fetch("https://api.ocr.space/parse/image", { method: "POST", body: formData });
                 const ocrData = await ocrRes.json();
                 if (ocrData.ParsedResults && ocrData.ParsedResults.length > 0) {
                     fullTextStr = (ocrData.ParsedResults[0].ParsedText || "").replace(/[\s\-_,\.]/g, "");
                 }
             } catch(e) {
             }
          }

          const txtUsps = fullTextStr.match(/(?:420\d{5})?(9\d{21})/);
          const txtUps = fullTextStr.match(/1Z[A-Z0-9]{16}/i);
          const tenDigitsMatch = defaultTracking.match(/(?:^|\s|\b)(\d{10,22})(?:\s|\b|$)/);

          // HỆ THỐNG ƯU TIÊN SỐ 1
          if (fnUsps && fnUsps[1]) {
             finalTracking = fnUsps[1]; // Ưu tiên cao nhất: Tên file là mã USPS chuẩn
          } else if (fnUps) {
             finalTracking = fnUps[0].toUpperCase();
          } else if (txtUsps && txtUsps[1]) {
             finalTracking = txtUsps[1]; // Kế đến: Chữ trong PDF có chứa mã USPS chuẩn
          } else if (txtUps) {
             finalTracking = txtUps[0].toUpperCase();
          } else if (zxingTracking) {
             finalTracking = zxingTracking; // Fallback: Mã barcode lẻ quét được (như T...)
          } else if (tenDigitsMatch && tenDigitsMatch[1]) {
             finalTracking = tenDigitsMatch[1];
          } else {
             finalTracking = defaultTracking; 
          }
      } catch (err) {
          console.error("Lỗi khi tự động giải mã tracking PDF:", err);
      }
      
      try {
          const { db } = await import('@/firebase');
          const { doc, updateDoc } = await import('firebase/firestore');

          const formData = new FormData();
          formData.append("file", file, `${finalTracking}.pdf`);
          formData.append("upload_preset", "THE HUB");
          
          const uploadDate = new Date();
          const folderName = `THE_HUB_LABELS/${uploadDate.getFullYear()}_${(uploadDate.getMonth() + 1).toString().padStart(2, '0')}`;
          formData.append("public_id", `${folderName}/${uploadTargetId}_${Date.now()}`);

          const response = await fetch("https://api.cloudinary.com/v1_1/dyjtyeokk/image/upload", {
              method: "POST",
              body: formData
          });

          if (!response.ok) {
              const errText = await response.text();
              throw new Error("Cloudinary Error: " + errText);
          }

          const result = await response.json();
          const pdfUrl = result.secure_url;

          const orderRef = doc(db, 'orders', uploadTargetId);
          const targetOrder = orders.find(o => o.id === uploadTargetId);
          
          await updateDoc(orderRef, {
              TrackingNumber: finalTracking,
              pdfUrl: pdfUrl,
              ActionHistory: [...(targetOrder?.ActionHistory || []), {
                  action: `Ghép thủ công PDF: ${finalTracking}`,
                  user: currentUser?.displayName || 'Ẩn danh',
                  timestamp: new Date().toLocaleString()
              }]
          });
          
          updateOrder(uploadTargetId, {
              TrackingNumber: finalTracking,
              pdfUrl: pdfUrl,
          }); // Update local store
          
          closeModal();
          await showAlert('Đã tải lên và gắn PDF thủ công thành công!', 'Thành công');
      } catch (err: any) {
          closeModal();
          await showAlert('Lỗi ghép bằng tay: ' + err.message, 'Lỗi');
      } finally {
          setUploadTargetId(null);
      }
  };

  const handleClearManualLabel = async (id: string, description: string) => {
    if (!await showConfirm(`Bạn có chắc chắn muốn GỠ BỎ file PDF đã gắn cho mã đơn: ${description}?`)) return;
    
    showLoading('Đang xóa...');
    try {
        const { db } = await import('@/firebase');
        const { doc, updateDoc } = await import('firebase/firestore');
        const orderRef = doc(db, 'orders', id);
        
        await updateDoc(orderRef, {
            TrackingNumber: null,
            pdfUrl: null,
            ActionHistory: [...(orders.find(o => o.id === id)?.ActionHistory || []), {
                action: 'Gỡ bỏ thủ công file PDF',
                user: currentUser?.displayName || 'Ẩn danh',
                timestamp: new Date().toLocaleString()
            }]
        });
        
        updateOrder(id, {
            TrackingNumber: "",
            pdfUrl: undefined
        });
        closeModal();
        await showAlert('Đã gỡ bỏ file PDF thành công!', 'Thành công');
    } catch(e: any) {
        closeModal();
        await showAlert('Lỗi xóa PDF: ' + e.message, 'Lỗi');
    }
  };

  // Đặt lại trang 1 khi người dùng Lọc hoặc Tìm kiếm
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const filter = params.get('filter');
    if (filter) {
      setStatusFilter(filter);
    }
    const searchTerm = params.get('search');
    if (searchTerm) {
        setSearchQuery(searchTerm);
    }
  }, []);

  const handleStatusChange = (id: string, order: OrderRow, newStatus: string) => {
    const now = new Date();
    const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')} ${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`;

    const newLog = {
      action: `Chuyển trạng thái: ${newStatus}`,
      user: currentUser ? `${currentUser.displayName || currentUser.id} (${currentUser.role})` : "Người ẩn danh",
      timestamp: timeString
    };

    updateOrder(id, {
        Status: newStatus,
        ActionHistory: [...(order.ActionHistory || []), newLog]
    });

    import('@/firebase').then(({ db }) => {
      import('firebase/firestore').then(({ doc, updateDoc }) => {
         const orderRef = doc(db, 'orders', id);
         updateDoc(orderRef, {
            Status: newStatus,
            ActionHistory: [...(order.ActionHistory || []), newLog]
         });
      });
    });
  };

  const downloadBarcodeAsPdf = async (description: string, receiverName: string, hub: string) => {
    try {
      const A7_WIDTH = 210;
      const A7_HEIGHT = 298;

      const canvas = document.createElement("canvas");
      canvas.width = 840;
      canvas.height = 1192;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const safeBarcodeData = String(description).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, 'd').replace(/Đ/g, 'D');

      const tempCanvas = document.createElement("canvas");
      JsBarcode(tempCanvas, safeBarcodeData, {
        text: description,
        height: 180,
        width: 5,
        fontSize: 50,
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

      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(tempCanvas, bcX, bcY, bcWidth, bcHeight);

      ctx.fillStyle = "#000000";
      ctx.font = "bold 55px Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(receiverName, canvas.width / 2, bcY + bcHeight + 80, maxBcWidth);
      
      if (hub && hub !== '-') {
          const cleanHub = hub.replace(/HUB/gi, '').trim();
          ctx.fillStyle = "#4a4a4a";
          ctx.font = "bold 45px Arial, sans-serif";
          ctx.fillText(cleanHub, canvas.width / 2, bcY + bcHeight + 160, maxBcWidth);
      }

      const imgDataUrl = canvas.toDataURL("image/png");

      const pdfDoc = await PDFDocument.create();
      const pngImage = await pdfDoc.embedPng(imgDataUrl);
      const page = pdfDoc.addPage([A7_WIDTH, A7_HEIGHT]);
      page.drawImage(pngImage, {
        x: 0,
        y: 0,
        width: A7_WIDTH,
        height: A7_HEIGHT,
      });

      const base64Pdf = await pdfDoc.saveAsBase64();
      const printJS = (await import('print-js')).default;
      printJS({ printable: base64Pdf, type: 'pdf', base64: true });
    } catch (error) {
      console.error("Lỗi khi tạo PDF Barcode", error);
      await showAlert("Có lỗi xảy ra khi tạo Mã Vạch PDF.");
    }
  };

  const displayedOrders = orders.map((order, idx) => ({ ...order, originalIndex: idx })).filter(item => {
    if (statusFilter === 'NO_LABEL') {
      if (item.Status === 'Đã Hủy') return false; // Không hiển thị Đơn Hủy
      if (item.TrackingNumber && item.pdfUrl) return false;
    } else if (statusFilter !== 'ALL') {
      const currentStatus = item.Status || 'Chờ xử lý';
      if (currentStatus !== statusFilter) return false;
    }

    if (hubFilter !== 'ALL') {
      const currentHub = item.HUB || item.Hub || '';
      if (hubFilter === 'NO_HUB') {
          if (currentHub) return false;
      } else {
          if (currentHub !== hubFilter) return false;
      }
    }

    if (dateFilter) {
      if (!item.UploadDate) return false;
      const [y, m, d] = dateFilter.split("-");
      const dmy = `${d}/${m}/${y}`;
      const dmyShort = `${parseInt(d, 10)}/${parseInt(m, 10)}/${y}`;
      if (!String(item.UploadDate).includes(dateFilter) && !String(item.UploadDate).includes(dmy) && !String(item.UploadDate).includes(dmyShort)) {
        return false;
      }
    }

    if (!searchQuery) return true;
    
    // Auto-fix lỗi kẹt Unikey/Vietkey (ví dụ: US -> Ú, IS -> Í, DD -> Đ) để tra cứu
    const decodeTelex = (str: string) => {
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

    const q = searchQuery.toLowerCase();
    const cleanQ = decodeTelex(searchQuery).toLowerCase();
    
    // Xoá dấu tiếng việt để so sánh tương đối chống rớt đơn
    const removeAccents = (str: string) => String(str || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
    const qNoAccent = removeAccents(q);
    const cleanNoAccent = removeAccents(cleanQ);

    return (
      removeAccents(item.TrackingNumber || '').includes(qNoAccent) ||
      removeAccents(item.Description || '').includes(qNoAccent) ||
      removeAccents(item["Receiver Name"] || '').includes(qNoAccent) ||
      removeAccents(item.TrackingNumber || '').includes(cleanNoAccent) ||
      removeAccents(item.Description || '').includes(cleanNoAccent) ||
      removeAccents(item["Receiver Name"] || '').includes(cleanNoAccent)
    );
  });

  const totalItems = displayedOrders.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const paginatedOrders = displayedOrders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSet = new Set(selectedIndexes);
    if (e.target.checked) {
      paginatedOrders.forEach(item => newSet.add(item.originalIndex));
    } else {
      paginatedOrders.forEach(item => newSet.delete(item.originalIndex));
    }
    setSelectedIndexes(newSet);
  };

  const handleSelectRow = (index: number, checked: boolean) => {
    const newSet = new Set(selectedIndexes);
    if (checked) {
      newSet.add(index);
    } else {
      newSet.delete(index);
    }
    setSelectedIndexes(newSet);
  };

  const downloadSelectedLabels = async () => {
    const selectedOrders = orders.filter((_, idx) => selectedIndexes.has(idx)).filter(o => o.pdfUrl);
    if (selectedOrders.length === 0) {
      await showAlert("Không có Label PDF nào trong các đơn hàng đã chọn.");
      return;
    }
    
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      
      for (const o of selectedOrders) {
          const res = await fetch(o.pdfUrl!);
          if (res.ok) {
              const fileBuffer = await res.arrayBuffer();
              const fileName = `[${o.Description || 'KhongMa'}] - ${o.TrackingNumber || 'KhongTracking'}.pdf`;
              zip.file(fileName, fileBuffer);
          }
      }
      
      const zipContent = await zip.generateAsync({ type: 'blob' });
      saveAs(zipContent, `Labels_THE_HUB_${new Date().getTime()}.zip`);
      
    } catch(e: any) {
        await showAlert("Lỗi khi tải/nén Label: " + e.message);
    }
  };

  const exportExcel = async () => {
    if (selectedIndexes.size === 0) {
      await showAlert("Vui lòng tích chọn ít nhất 1 đơn hàng để xuất Excel.");
      return;
    }

    const selectedOrders = orders.filter((_, idx) => selectedIndexes.has(idx));

    const templateHeaders = [
        "Sender Name", "Sender Company", "Sender Address1", "Sender Address2", "Sender City", "Sender State", "Sender Zipcode", "Sender Phone",
        "Receiver Name", "Receiver Company", "Receiver Address 1", "Receiver Address 2", "Receiver City", "Receiver State", "Receiver Zip", "Receiver Phone",
        "Weight (lbs)", "Length (in)", "Width (in)", "Height (in)", "Description", "Reference1", "Reference2", "SenderCountry", "ReceiverCountry", "TrackingNumber", "UploadDate", "Status", "pdfUrl", "HUB"
    ];

    const cleanData = selectedOrders.map(order => {
      const { pdfBase64, ActionHistory, originalIndex, Status, ...rest } = order;
      
      const rowData: any = {};
      templateHeaders.forEach(header => { rowData[header] = ""; });

      rowData["Weight (lbs)"] = rest["Weight (lbs)"] || rest.Weight_lbs || rest.Weight || "";
      rowData["Length (in)"] = rest["Length (in)"] || rest.Length_inch || rest.Length || "";
      rowData["Width (in)"] = rest["Width (in)"] || rest.Width_inch || rest.Width || "";
      rowData["Height (in)"] = rest["Height (in)"] || rest.Height_inch || rest.Height || "";
      rowData["SenderCountry"] = rest.SenderCountry || rest["Sender Country"] || "";
      rowData["ReceiverCountry"] = rest.ReceiverCountry || rest["Receiver Country"] || "";
      rowData["HUB"] = rest.HUB || rest.Hub || "";
      rowData["Status"] = Status || 'Chờ xử lý';

      Object.keys(rest).forEach(k => {
          if (k !== 'Weight' && k !== 'Length' && k !== 'Width' && k !== 'Height' && k !== 'Hub' && k !== 'createdAt' && k !== 'id' && !templateHeaders.includes(k)) {
              rowData[k] = rest[k];
          } else if (templateHeaders.includes(k) && rest[k]) {
              rowData[k] = rest[k];
          }
      });

      return rowData;
    });

    const allKeys = new Set<string>();
    cleanData.forEach((item: any) => Object.keys(item).forEach(k => allKeys.add(k)));

    const finalHeaders: string[] = [...templateHeaders];
    allKeys.forEach(k => {
        if (!finalHeaders.includes(k)) {
            finalHeaders.push(k);
        }
    });

    const worksheet = xlsx.utils.json_to_sheet(cleanData, { header: finalHeaders });
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, "Orders");

    const excelBuffer = xlsx.write(workbook, { bookType: 'xlsx', type: 'array' });
    const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' });
    saveAs(data, `Exported_Orders_${new Date().getTime()}.xlsx`);
  };

  const downloadPdf = (base64: string, trackingNumber: string) => {
    const linkSource = `data:application/pdf;base64,${base64}`;
    const downloadLink = document.createElement("a");
    downloadLink.href = linkSource;
    downloadLink.download = `${trackingNumber}.pdf`;
    downloadLink.click();
  };

  const isAllDisplayedSelected = paginatedOrders.length > 0 && paginatedOrders.every(item => selectedIndexes.has(item.originalIndex));

  const handleDeleteSelected = async () => {
    if (!await showConfirm(`XÁC NHẬN: Bạn có chắc chắn muốn XÓA VĨNH VIỄN ${selectedIndexes.size} đơn hàng đã tick chọn khỏi hệ thống Đám mây không?`)) {
        return;
    }
    const userInput = await showPrompt("Vui lòng nhập MẬT KHẨU QUẢN TRỊ VIÊN để xác nhận xóa các đơn đã chọn:\n(Pass: admin123)", "Xác thực Quản trị");
    if (userInput !== 'admin123') {
        if (userInput !== null) await showAlert("❌ SAI MẬT KHẨU!");
        return;
    }

    setIsDeletingAll(true);
    try {
        const { db, storage } = await import('@/firebase');
        const { doc, writeBatch } = await import('firebase/firestore');
        const { ref, deleteObject } = await import('firebase/storage');

        const selectedOrders = orders.filter((_, idx) => selectedIndexes.has(idx));
        
        const MAX_BATCH_SIZE = 450;
        let batch = writeBatch(db);
        let count = 0;

        for (const order of selectedOrders) {
            batch.delete(doc(db, 'orders', order.id));
            if (order.pdfUrl) {
                const pdfRef = ref(storage, `pdfs/${order.id}.pdf`);
                deleteObject(pdfRef).catch(e => console.warn("Không thể xóa file PDF (có thể file bị lỗi hoặc không tồn tại):", e));
            }
            count++;
            if (count % MAX_BATCH_SIZE === 0) {
                await batch.commit();
                batch = writeBatch(db);
            }
        }
        if (count % MAX_BATCH_SIZE !== 0) {
            await batch.commit();
        }

        const remainingOrders = orders.filter((_, idx) => !selectedIndexes.has(idx));
        setOrders(remainingOrders);
        setSelectedIndexes(new Set());
        await showAlert(`Đã xóa thành công ${count} mã được chọn khỏi đám mây!`);
    } catch (err: any) {
        await showAlert("Lỗi khi xóa dữ liệu: " + err.message);
    } finally {
        setIsDeletingAll(false);
    }
  };

  const handleBulkDeleteSubmit = async () => {
      const descriptions = bulkDeleteText.split(/[\n,]+/).map(s => s.trim().toUpperCase()).filter(Boolean);
      if (descriptions.length === 0) {
          await showAlert("Vui lòng nhập ít nhất 1 mã Description để xóa.");
          return;
      }
      if (!await showConfirm(`XÁC NHẬN: Hệ thống sẽ tiến hành rà soát và XÓA VĨNH VIỄN các đơn hàng thuộc ${descriptions.length} mã Description bạn cung cấp. Bạn có tự tin gõ đúng mã không?`)) {
          return;
      }
      const userInput = await showPrompt("Nhập MẬT KHẨU QUẢN TRỊ VIÊN để xác nhận xóa dữ liệu hàng loạt:\n(Pass: admin123)", "Xác thực Quản trị");
      if (userInput !== 'admin123') {
          if (userInput !== null) await showAlert("❌ SAI MẬT KHẨU!");
          return;
      }

      setIsDeletingAll(true);
      setShowBulkDeleteModal(false);
      try {
          const { db, storage } = await import('@/firebase');
          const { doc, writeBatch } = await import('firebase/firestore');
          const { ref, deleteObject } = await import('firebase/storage');
          
          let count = 0;
          let batch = writeBatch(db);
          let currentBatchSize = 0;
          let idsToDelete = new Set<string>();

          for (const order of orders) {
              const desc = (order.Description || "").toString().trim().toUpperCase();
              if (descriptions.includes(desc)) {
                  idsToDelete.add(order.id);
                  batch.delete(doc(db, 'orders', order.id));
                  if (order.pdfUrl) {
                      const pdfRef = ref(storage, `pdfs/${order.id}.pdf`);
                      deleteObject(pdfRef).catch(e => console.warn("Không thể xóa file PDF:", e));
                  }
                  count++;
                  currentBatchSize++;

                  if (currentBatchSize === 450) {
                      await batch.commit();
                      batch = writeBatch(db);
                      currentBatchSize = 0;
                  }
              }
          }

          if (currentBatchSize > 0) {
              await batch.commit();
          }

          if (count === 0) {
              await showAlert("Không tìm thấy đơn hàng nào khớp với danh sách mã bạn nhập!");
          } else {
              const remainingOrders = orders.filter(o => !idsToDelete.has(o.id));
              setOrders(remainingOrders);
              setSelectedIndexes(new Set());
              setBulkDeleteText("");
              await showAlert(`TUYỆT VỜI: Đã đốt thành tro ${count} đơn hàng thuộc danh sách mã bạn cung cấp khỏi mây!`);
          }
      } catch (err: any) {
          await showAlert("Lỗi khi xóa dữ liệu: " + err.message);
      } finally {
          setIsDeletingAll(false);
      }
  };


  return (
    <div>
        <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="application/pdf" 
            onChange={handleFileChange} 
        />
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold text-slate-800 tracking-tight">Danh Sách Đơn Hàng</h2>
        <div className="flex gap-3">
          {orders.length > 0 && (
            <>
              <button onClick={exportExcel} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-all shadow-md flex items-center gap-2 border border-indigo-500/50">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                Xuất Excel ({selectedIndexes.size})
              </button>
              
              {currentUser?.role === 'admin' && (
                  <button 
                      onClick={() => selectedIndexes.size > 0 ? handleDeleteSelected() : setShowBulkDeleteModal(true)} 
                      disabled={isDeletingAll}
                      className="px-4 py-2 bg-red-50 hover:bg-red-600 text-red-600 hover:text-white rounded-lg text-sm font-bold uppercase transition-all shadow-sm flex items-center gap-2 border border-red-200 disabled:opacity-50 min-w-[190px] justify-center">
                     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                     {isDeletingAll ? "Đang xóa Cloud..." 
                       : (selectedIndexes.size > 0 ? `Xóa ${selectedIndexes.size} Đã Chọn` : "Xóa Hàng Loạt")}
                  </button>
              )}
              <button 
                  onClick={downloadSelectedLabels}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-all shadow-md flex items-center gap-2 border border-emerald-500/50"
                  title="Tải xuống toàn bộ PDF trong 1 file ZIP nén"
              >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                  Tải Label ({selectedIndexes.size})
              </button>
            </>
          )}
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6">
          <div className="text-center py-16 text-slate-500">
            <div className="inline-flex w-16 h-16 rounded-full bg-slate-100 items-center justify-center mb-4 mx-auto border border-slate-200">
              <svg className="w-8 h-8 opacity-50 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
            </div>
            <p className="text-lg font-medium text-slate-700">Chưa có dữ liệu đơn hàng.</p>
            <p className="text-sm mt-2">Vui lòng tải lên file Excel để bắt đầu.</p>
          </div>
        </div>
      ) : (
        <div className="bg-white shadow-sm border border-slate-200 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-white flex flex-col md:flex-row gap-4">

            <div className="relative flex-1 border-2 border-indigo-400 bg-white rounded-xl overflow-hidden shadow-sm transition-all focus-within:border-indigo-600 outline-none">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                    const rawVal = e.target.value;
                    const cleanVal = rawVal
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
                    setSearchQuery(cleanVal);
                }}
                placeholder="Tìm kiếm theo Mã đơn, Tracking, Tên người nhận..."
                className="w-full pl-10 pr-4 py-2.5 bg-transparent text-slate-800 placeholder-slate-400 border-none focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
              )}
            </div>
            
            <div className="w-full md:w-56 shrink-0 relative">
               <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>
               </div>
               <select
                  value={hubFilter}
                  onChange={(e) => setHubFilter(e.target.value)}
                  className="w-full pl-10 pr-8 py-2.5 bg-white border-2 border-slate-200 hover:border-slate-300 focus:border-indigo-400 rounded-xl outline-none font-bold text-slate-600 appearance-none shadow-sm cursor-pointer transition-colors"
               >
                  <option value="ALL">Tìm theo kho</option>
                  <option value="NO_HUB" className="text-red-500">Đơn trống Kho</option>
                  {warehouses.map(wh => {
                     const whName = typeof wh === 'string' ? wh : (wh.name || wh.id);
                     return <option key={whName} value={whName} className="text-slate-700">{whName}</option>
                  })}
               </select>
               <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400">
                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
               </div>
            </div>

            <div className="w-full md:w-48 shrink-0 relative">
               <input
                 type="date"
                 value={dateFilter}
                 onChange={(e) => setDateFilter(e.target.value)}
                 className="w-full pl-3 pr-8 py-2.5 bg-white border-2 border-slate-200 hover:border-slate-300 focus:border-indigo-400 rounded-xl outline-none font-bold text-slate-600 shadow-sm transition-colors uppercase"
               />
               {dateFilter && (
                 <button onClick={() => setDateFilter("")} title="Xóa lộc ngày" className="absolute inset-y-0 right-10 flex items-center text-slate-400 hover:text-red-500 transition">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                 </button>
               )}
            </div>
          </div>
          {/* Tab bộ lọc trạng thái */}
          <div className="flex gap-2 overflow-x-auto p-4 border-b border-slate-200 scrollbar-hide bg-slate-50">
            {[
              { label: 'Tất Cả', key: 'ALL' },
              { label: 'Chưa có Label', key: 'NO_LABEL' },
              { label: 'Chờ xử lý', key: 'Chờ xử lý' },
              { label: 'Đóng kiện', key: 'Đóng kiện' },
              { label: 'Kho Mỹ đã scan', key: 'Kho Mỹ đã scan' },
              { label: 'Đơn Cancel (Đã hủy)', key: 'Đã Hủy' }
            ].map(tab => {
              let count = 0;
              if (tab.key === 'ALL') {
                count = orders.length;
              } else if (tab.key === 'NO_LABEL') {
                count = orders.filter(item => !(item.TrackingNumber && item.pdfUrl) && item.Status !== 'Đã Hủy').length;
              } else {
                count = orders.filter(item => (item.Status || 'Chờ xử lý') === tab.key).length;
              }

              return (
                <button
                  key={tab.key}
                  onClick={() => setStatusFilter(tab.key)}
                  className={`px-4 py-2 rounded-full font-bold text-[11px] uppercase tracking-wider transition-all whitespace-nowrap border cursor-pointer flex items-center gap-2
                              ${statusFilter === tab.key
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-md'
                      : 'bg-white border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-100 shadow-sm'
                    }`}
                >
                  {tab.label}
                  <span className={`px-1.5 py-0.5 rounded text-[10px] ${statusFilter === tab.key ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200 border border-slate-200'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap border-t border-slate-200">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[11px] tracking-wider font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-3 py-3 w-10 text-center">
                    <input
                      type="checkbox"
                      className="w-5 h-5 rounded border border-slate-300 bg-white accent-indigo-600 cursor-pointer shadow-sm"
                      checked={isAllDisplayedSelected}
                      onChange={handleSelectAll}
                    />
                  </th>
                  <th className="px-3 py-3 text-center">MÃ ĐƠN HÀNG</th>
                  <th className="px-3 py-3 text-center">Tên Người Nhận</th>
                  <th className="px-3 py-3 text-center">Tracking Number</th>
                  <th className="px-3 py-3 text-center">Tải Label</th>
                  <th className="px-3 py-3 text-center w-32">Trạng Thái</th>
                  <th className="px-3 py-3 text-center">HUB</th>
                  <th className="px-3 py-3 text-center">Ngày/Tháng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedOrders.map((item) => {
                  const order = item;
                  const idx = item.originalIndex;
                  return (
                    <tr key={idx} className={`hover:bg-slate-50/80 transition-colors ${selectedIndexes.has(idx) ? 'bg-indigo-50 text-indigo-900' : 'bg-white'}`}>
                      <td className="px-3 py-2 text-center border-r border-transparent">
                        <input
                          type="checkbox"
                          className="w-5 h-5 rounded border border-slate-300 bg-white accent-indigo-600 cursor-pointer shadow-sm"
                          checked={selectedIndexes.has(idx)}
                          onChange={(e) => handleSelectRow(idx, e.target.checked)}
                        />
                      </td>
                      <td className="px-3 py-2 text-center font-bold tracking-wider text-sm">
                        {order.Description ? (
                          <div className="flex items-center justify-between w-full max-w-[260px] mx-auto gap-2">
                            <span
                              onClick={() => setSelectedDetail(order)}
                              className="flex-1 w-full truncate text-indigo-700 hover:text-indigo-900 font-mono font-bold whitespace-nowrap text-center text-[13px] cursor-pointer transition-colors"
                              title="Bấm để xem chi tiết đơn hàng"
                            >
                              {order.Description}
                            </span>
                            <button
                              onClick={() => downloadBarcodeAsPdf(order.Description!, order["Receiver Name"] || "", order.HUB || order.Hub || "-")}
                              className="shrink-0 p-1.5 bg-white hover:bg-indigo-600 text-slate-400 hover:text-white rounded-md border border-slate-200 transition-colors"
                              title="In Barcode Khổ A7"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
                            </button>
                          </div>
                        ) : <span className="text-slate-400">-</span>}
                      </td>
                      <td className="px-3 py-2 text-center text-sm font-medium text-slate-700">
                        {order["Receiver Name"] || <span className="text-slate-400">-</span>}
                      </td>
                      <td className="px-3 py-2 text-emerald-600 font-bold tracking-wider text-sm text-center">
                        {order.TrackingNumber ? (
                             <a 
                                 href={String(order.TrackingNumber).toUpperCase().startsWith('1Z') ? `https://www.ups.com/track?tracknum=${order.TrackingNumber}&loc=vi_VN&requester=QUIC/trackdetails` : `https://tools.usps.com/go/TrackConfirmAction?tRef=fullpage&tLc=2&text28777=&tLabels=${order.TrackingNumber}%2C`}
                                 target="_blank"
                                 rel="noopener noreferrer"
                                 className="hover:underline hover:text-emerald-800 transition"
                                 title={String(order.TrackingNumber).toUpperCase().startsWith('1Z') ? "Bấm để tra cứu trên trang chủ UPS" : "Bấm để tra cứu trên trang chủ USPS"}
                             >
                                 {order.TrackingNumber}
                             </a>
                        ) : (
                            <span className="text-red-400 italic text-xs font-normal">Chưa nạp PDF</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {(() => {
                           const isManualMatch = order.ActionHistory?.some((h: any) => h.action && (h.action.includes("Ghép thủ công") || h.action.includes("Ghép tay")));
                           if (order.pdfUrl) {
                              return (
                                  <div className="flex items-center justify-center gap-1.5 shrink-0">
                                    <button
                                       onClick={async () => {
                                           try {
                                               const res = await fetch(order.pdfUrl!);
                                               const blob = await res.blob();
                                               const fileName = `[${order.Description || 'KhongMa'}] - ${order.TrackingNumber || 'KhongTracking'}.pdf`;
                                               saveAs(blob, fileName);
                                           } catch (e) {
                                               console.error("Fetch failed, falling back to window.open", e);
                                               window.open(order.pdfUrl, '_blank');
                                           }
                                       }}
                                       className={`px-3 py-1.5 border rounded-md shadow-sm transition-all font-medium inline-flex items-center justify-center gap-1.5 text-xs whitespace-nowrap min-w-[125px] ${
                                         isManualMatch
                                           ? 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200'
                                           : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border-indigo-100'
                                       }`}>
                                       <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                                       <span>Tải Label PDF</span>
                                    </button>
                                    {isManualMatch && (
                                        <div className="flex items-center gap-1 shrink-0">
                                          <button
                                            onClick={() => handleManualUploadClick(order.id)}
                                            title="Sửa / Up lại file khác"
                                            className="p-1.5 text-amber-500 hover:bg-amber-100 hover:text-amber-700 border border-transparent hover:border-amber-200 rounded-md transition-colors shrink-0"
                                          >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                                          </button>
                                          <button
                                            onClick={() => handleClearManualLabel(order.id, order.Description || 'KhongMa')}
                                            title="Xóa Label đã gắn thủ công khỏi đơn"
                                            className="p-1.5 text-red-500 hover:bg-red-100 hover:text-red-700 border border-transparent hover:border-red-200 rounded-md transition-colors shrink-0"
                                          >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                          </button>
                                       </div>
                                    )}
                                 </div>
                              );
                           }
                           return (
                               <button
                                 onClick={() => handleManualUploadClick(order.id)}
                                 disabled={uploadTargetId === order.id}
                                 className={`px-3 py-1.5 border rounded-md shadow-sm transition-all font-medium inline-flex items-center justify-center gap-1.5 text-xs whitespace-nowrap min-w-[125px] ${uploadTargetId === order.id ? 'bg-indigo-100 text-indigo-500 border-indigo-200 cursor-wait' : 'bg-slate-50 hover:bg-slate-200 text-slate-500 border-slate-200'}`}>
                                 {uploadTargetId === order.id ? (
                                     <>
                                         <svg className="w-3.5 h-3.5 animate-spin shrink-0" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                         <span>Đang tải...</span>
                                     </>
                                 ) : (
                                     <>
                                         <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
                                         <span>Gắn File</span>
                                     </>
                                 )}
                               </button>
                           );
                        })()}
                      </td>
                      <td className="px-2 py-2 text-center">
                        <select
                          value={order.Status || 'Chờ xử lý'}
                          onChange={(e) => handleStatusChange(order.id, order, e.target.value)}
                          disabled={currentUser?.role === 'support'}
                          className={`px-2 py-1.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider outline-none text-center appearance-none transition-all border shadow-sm w-full min-w-[145px]
                             ${(!order.Status || order.Status === 'Chờ xử lý') ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' : ''}
                             ${order.Status === 'Đóng kiện' ? 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100' : ''}
                             ${order.Status === 'Kho Mỹ đã scan' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' : ''}
                             ${order.Status === 'Đã Hủy' ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100 line-through' : ''}
                             ${currentUser?.role === 'support' ? 'cursor-not-allowed opacity-90' : 'cursor-pointer'}
                           `}
                        >
                          <option value="Chờ xử lý" className="bg-white text-amber-600 font-bold">Chờ xử lý</option>
                          <option value="Đóng kiện" className="bg-white text-indigo-600 font-bold">Đóng kiện</option>
                          <option value="Kho Mỹ đã scan" className="bg-white text-emerald-600 font-bold">Kho Mỹ đã scan</option>
                          <option value="Đã Hủy" className="bg-white text-red-600 font-bold" disabled={order.Status === 'Kho Mỹ đã scan'}>Đã Hủy</option>
                        </select>
                      </td>
                      <td className="px-3 py-2 text-center text-indigo-700 font-bold text-[13px] uppercase tracking-wider bg-indigo-50/30">
                        {order.HUB || order.Hub ? (
                            <span>{order.HUB || order.Hub}</span>
                        ) : (
                            <select
                                value=""
                                onChange={(e) => {
                                    if (e.target.value) {
                                        const newValue = e.target.value;
                                        // 1. Cập nhật giao diện ngay lập tức (Xóa độ trễ)
                                        updateOrder(order.id, { HUB: newValue, Hub: newValue });
                                        // 2. Cập nhật ngầm lên Cloud
                                        import('@/firebase').then(({ db }) => {
                                            import('firebase/firestore').then(({ doc, updateDoc }) => {
                                                const orderRef = doc(db, 'orders', order.id);
                                                updateDoc(orderRef, { HUB: newValue, Hub: newValue }).catch(async err => {
                                                    await showAlert("Lỗi khi lưu trữ kho: " + err.message);
                                                });
                                            });
                                        });
                                    }
                                }}
                                className="px-2 py-1.5 rounded-md bg-white border border-slate-300 text-slate-600 text-[11px] cursor-pointer outline-none w-full max-w-[120px] text-center font-bold shadow-sm hover:border-indigo-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all appearance-none"
                            >
                                <option value="" disabled>-</option>
                                {warehouses.map(wh => {
                                    const whName = typeof wh === 'string' ? wh : (wh.name || wh.id);
                                    return <option key={whName} value={whName} className="font-bold text-slate-700">{whName}</option>
                                })}
                            </select>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center text-slate-500 font-medium text-xs whitespace-nowrap">
                        {order.UploadDate || "-"}
                      </td>
                    </tr>
                  )
                })}
                {paginatedOrders.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-12 bg-white text-center text-slate-500 font-medium italic">Không tìm thấy đơn hàng nào trùng khớp với từ khóa "{searchQuery}"</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalItems > 0 && (
            <div className="flex flex-col sm:flex-row justify-between items-center p-4 border-t border-slate-200 bg-slate-50 gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-500">Hiển thị:</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => { 
                      setItemsPerPage(Number(e.target.value)); 
                      setCurrentPage(1); 
                      setSelectedIndexes(new Set()); // Thêm dòng này để reset các mục đã chọn khi chuyển số lượng
                  }}
                  className="bg-white border text-slate-700 font-bold border-slate-300 rounded overflow-hidden px-2 py-1.5 text-sm outline-none cursor-pointer focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                >
                  <option value={30}>30 dòng / trang</option>
                  <option value={50}>50 dòng / trang</option>
                  <option value={100}>100 dòng / trang</option>
                  <option value={150}>150 dòng / trang</option>
                  <option value={200}>200 dòng / trang</option>
                </select>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-slate-500 hidden sm:block">
                  Hiển thị từ <strong className="text-slate-800">{(currentPage - 1) * itemsPerPage + 1}</strong> đến <strong className="text-slate-800">{Math.min(currentPage * itemsPerPage, totalItems)}</strong> trong số <strong className="text-slate-800">{totalItems}</strong> đơn hàng
                </span>
                <div className="flex gap-1.5 items-center">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <span className="flex items-center gap-1"><svg className="w-4 h-4 -ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg> Trước</span>
                  </button>

                  <span className="px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 font-bold text-sm border border-indigo-100">
                    {currentPage} / {totalPages || 1}
                  </span>

                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages || totalPages === 0}
                    className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <span className="flex items-center gap-1">Sau <svg className="w-4 h-4 -mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg></span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal Chi tiết Đơn hàng */}
      {selectedDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm shadow-2xl">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-5xl overflow-hidden shadow-2xl relative flex flex-col max-h-[90vh]">
            {/* Header Modal */}
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-4 text-slate-800">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                  <span className="font-bold text-lg">Quản lý vận đơn</span>
                </div>

                {selectedDetail.Status !== 'Đã Hủy' && selectedDetail.Status !== 'Kho Mỹ đã scan' && (
                  <button
                    onClick={() => {
                      handleStatusChange(selectedDetail.id, selectedDetail, 'Đã Hủy');
                      setSelectedDetail({ ...selectedDetail, Status: 'Đã Hủy' });
                    }}
                    className="ml-4 px-3 py-1 bg-red-50 hover:bg-red-500 border border-red-200 hover:border-red-500 text-red-600 hover:text-white rounded-lg text-xs font-bold uppercase transition flex items-center gap-1 shadow-sm cursor-pointer"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                    Hủy Đơn Này
                  </button>
                )}
              </div>
              <button onClick={() => setSelectedDetail(null)} className="text-slate-400 hover:text-slate-800 p-2 rounded-lg hover:bg-slate-200 transition">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>

            {/* Banner Thông số chung */}
            <div className="bg-white border-b border-slate-200 p-6 flex flex-wrap gap-8">
              <div>
                <p className="text-xs text-slate-400 font-bold mb-1 uppercase tracking-wider">Mã Descrip</p>
                <p className="text-2xl font-black text-indigo-600">
                  {selectedDetail.Description || <span className="text-slate-400">Chưa xác định</span>}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400 font-bold mb-1 uppercase tracking-wider">HUB</p>
                <p className="text-lg font-bold text-slate-800">{selectedDetail.HUB || selectedDetail.Hub || <span className="text-slate-400">Chưa xác định</span>}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 font-bold mb-1 uppercase tracking-wider">Dịch vụ</p>
                <p className="text-lg font-bold text-slate-800">-</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 font-bold mb-1 uppercase tracking-wider">Last mile tracking</p>
                <p className="text-lg font-bold text-slate-700 font-mono">{selectedDetail.TrackingNumber || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 font-bold mb-1 uppercase tracking-wider">Ngày tạo</p>
                <p className="text-lg font-bold text-slate-700">{selectedDetail.UploadDate || "-"}</p>
              </div>
            </div>

            {/* Nội dung cụ thể */}
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden bg-slate-50 min-h-0">
              {/* Cột trái (Thông tin) */}
              <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Card 1: Người Nhận */}
                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                    <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                      <h3 className="text-lg font-bold text-slate-800">Người nhận</h3>
                    </div>
                    <div className="p-5 space-y-3">
                      <div className="flex border-b border-dashed border-slate-100 pb-2">
                        <span className="w-1/3 text-slate-500 text-sm">Họ và tên:</span>
                        <span className="w-2/3 font-semibold text-slate-800">{selectedDetail["Receiver Name"] || "-"}</span>
                      </div>
                      <div className="flex border-b border-dashed border-slate-100 pb-2">
                        <span className="w-1/3 text-slate-500 text-sm">Điện thoại:</span>
                        <span className="w-2/3 font-semibold text-slate-800">{selectedDetail["Receiver Phone"] || "-"}</span>
                      </div>
                      <div className="flex border-b border-dashed border-slate-100 pb-2">
                        <span className="w-1/3 text-slate-500 text-sm">Địa chỉ:</span>
                        <span className="w-2/3 font-semibold text-slate-800">{selectedDetail["Receiver Address 1"] || "-"}</span>
                      </div>
                      <div className="flex border-b border-dashed border-slate-100 pb-2">
                        <span className="w-1/3 text-slate-500 text-sm">Thành phố:</span>
                        <span className="w-2/3 font-semibold text-slate-800">{selectedDetail["Receiver City"] || "-"}</span>
                      </div>
                      <div className="flex border-b border-dashed border-slate-100 pb-2">
                        <span className="w-1/3 text-slate-500 text-sm">Mã vùng (State):</span>
                        <span className="w-2/3 font-semibold text-slate-800">{selectedDetail["Receiver State"] || "-"}</span>
                      </div>
                      <div className="flex border-b border-dashed border-slate-100 pb-2">
                        <span className="w-1/3 text-slate-500 text-sm">Mã bưu điện:</span>
                        <span className="w-2/3 font-semibold text-slate-800">{selectedDetail["Receiver Zip"] || "-"}</span>
                      </div>
                      <div className="flex">
                        <span className="w-1/3 text-slate-500 text-sm">Mã quốc gia:</span>
                        <span className="w-2/3 font-semibold text-slate-800 uppercase">{selectedDetail["Receiver Country"] || "US"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Thông tin Hàng hóa */}
                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                    <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                      <h3 className="text-lg font-bold text-slate-800">Thông tin hàng hóa</h3>
                    </div>
                    <div className="p-5 space-y-3">
                      <div className="flex border-b border-dashed border-slate-100 pb-2">
                        <span className="w-1/3 text-slate-500 text-sm">Chi tiết hàng:</span>
                        <span className="w-2/3 font-bold text-indigo-600">{selectedDetail.Description || "-"}</span>
                      </div>
                      <div className="flex border-b border-dashed border-slate-100 pb-2">
                        <span className="w-1/3 text-slate-500 text-sm">Trọng lượng:</span>
                        <span className="w-2/3 font-semibold text-slate-800">{selectedDetail.Weight ? `${selectedDetail.Weight} (lbs)` : "-"}</span>
                      </div>
                      <div className="flex border-b border-dashed border-slate-100 pb-2">
                        <span className="w-1/3 text-slate-500 text-sm">Kích thước:</span>
                        <span className="w-2/3 font-semibold text-slate-800">
                          {selectedDetail.Length ? `${selectedDetail.Length} x ${selectedDetail.Width} x ${selectedDetail.Height} (inch)` : "-"}
                        </span>
                      </div>
                      <div className="flex">
                        <span className="w-1/3 text-slate-500 text-sm">Giá trị:</span>
                        <span className="w-2/3 font-semibold text-emerald-600">{selectedDetail.Value || selectedDetail["Declared Value"] ? `${selectedDetail.Value || selectedDetail["Declared Value"]} USD` : "-"}</span>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Card 3: Trạng thái */}
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm w-full shrink-0">
                  <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                    <h3 className="text-lg font-bold text-slate-800">Trạng thái</h3>
                  </div>
                  <div className="p-4 space-y-2.5">
                    <div className="flex items-center justify-between border-b border-dashed border-slate-100 pb-2.5">
                      <span className="text-slate-500 text-[13px]">Trạng thái đơn:</span>
                      <span className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-widest border shadow-sm
                             ${(!selectedDetail.Status || selectedDetail.Status === 'Chờ xử lý') ? 'bg-amber-50 text-amber-700 border-amber-200' : ''}
                             ${selectedDetail.Status === 'Đóng kiện' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : ''}
                             ${selectedDetail.Status === 'Kho Mỹ đã scan' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : ''}
                             ${selectedDetail.Status === 'Đã Hủy' ? 'bg-red-50 text-red-700 border-red-200 line-through' : ''}
                           `}>
                        {selectedDetail.Status || 'Chờ xử lý'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-b border-dashed border-slate-100 pb-2.5">
                         <span className="text-slate-500 text-[13px]">Trạng thái kho:</span>
                         <span className="px-3 py-1 bg-slate-100 text-slate-700 border border-slate-300 rounded-full text-[11px] font-black uppercase tracking-widest shadow-sm">
                           {selectedDetail.Status || 'Chờ xử lý'}
                         </span>
                    </div>
                    <div className="flex items-center justify-between border-b border-dashed border-slate-100 pb-2.5">
                      <span className="text-slate-500 text-[13px]">Trạng thái Label:</span>
                      {selectedDetail.pdfUrl || selectedDetail.pdfBase64 ? (
                        <span className="px-3 py-1 bg-indigo-50 text-indigo-600 border border-indigo-200 rounded-full text-[11px] font-black uppercase tracking-widest shadow-sm">
                          Đã có nhãn
                        </span>
                      ) : (
                        <span className="px-3 py-1 bg-slate-50 text-slate-500 border border-slate-300 rounded-full text-[11px] font-black uppercase tracking-widest shadow-sm">
                          Chờ ghép
                        </span>
                      )}
                    </div>
                    {(() => {
                         const foundPkg = packages.find(p => p.orderDescriptions?.includes(selectedDetail.Description || ''));
                         if (foundPkg) {
                             return (
                                 <div className="flex items-center justify-between pt-1 relative">
                                    <span className="text-indigo-500 font-medium text-[13px] flex items-center gap-1.5"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg> Nằm trong kiện:</span>
                                    <span className="text-[11px] font-bold font-mono text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">{foundPkg.id}</span>
                             
      {/* Modal Xóa Hàng Loạt */}
      {showBulkDeleteModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm shadow-2xl">
          <div className="bg-white border-2 border-red-200 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl relative flex flex-col">
            <div className="px-6 py-4 border-b border-red-100 flex justify-between items-center bg-red-50">
              <div className="flex items-center gap-2 text-red-700">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                <span className="font-black text-lg uppercase tracking-tight">Xóa theo danh sách Mã</span>
              </div>
              <button onClick={() => setShowBulkDeleteModal(false)} className="text-red-400 hover:text-red-800 p-2 rounded-lg transition">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-slate-600 mb-4 font-medium leading-relaxed">
                Sao chép và dán danh sách <strong>Mã Description</strong> bạn muốn xóa vào ô bên dưới.
                Mỗi mã cách nhau bởi dấu phẩy hoặc xuống dòng.
              </p>
              <textarea
                value={bulkDeleteText}
                onChange={(e) => setBulkDeleteText(e.target.value)}
                className="w-full h-40 border-2 border-slate-200 hover:border-indigo-300 focus:border-indigo-500 rounded-xl p-4 text-sm font-mono focus:outline-none transition-colors shadow-inner resize-none text-slate-700"
                placeholder="Ví dụ: 
ORDER-1234
ORDER-5678"
              ></textarea>
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => setShowBulkDeleteModal(false)} className="px-6 py-2.5 bg-white text-slate-600 font-bold rounded-xl border border-slate-300 hover:bg-slate-100 transition">
                Hủy bỏ
              </button>
              <button onClick={handleBulkDeleteSubmit} disabled={!bulkDeleteText.trim()} className="px-6 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl shadow-md transition disabled:opacity-50 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3"></path></svg>
                Thực Hiện Xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
                         return null;
                      })()}
                    {/* compact status layout rendered */}
                  </div>
                </div>
              </div>

              {/* Cột phải: Action History */}
              <div className="w-full lg:w-[400px] bg-slate-50 border-t lg:border-t-0 lg:border-l border-slate-200 flex flex-col shrink-0 z-10 shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.05)] relative">
                <div className="bg-white px-5 py-4 border-b border-slate-200 flex items-center gap-2 shadow-sm relative z-20">
                  <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                  <h4 className="font-bold text-base tracking-wide text-slate-800">Lịch sử tác động</h4>
                </div>
                <div className="p-5 flex-1 overflow-y-auto w-full custom-scrollbar bg-slate-50/50">
                  {(() => {
                    let history = [...(selectedDetail.ActionHistory || [])];
                    // Bù đắp log Nạp dữ liệu cho dữ liệu cũ
                    if (selectedDetail.UploadDate && !history.some((h: any) => h.action.includes('Nạp dữ liệu'))) {
                      history.unshift({ action: 'Nạp dữ liệu vào hệ thống', user: 'Hệ thống', timestamp: selectedDetail.UploadDate as string });
                    }
                    // Bù đắp log Ghép nhãn cho dữ liệu cũ
                    if (selectedDetail.pdfBase64 && !history.some((h: any) => h.action.includes('Ghép Label'))) {
                      const labelAction = { action: 'Ghép Label PDF (AI tự động)', user: 'Hệ thống', timestamp: selectedDetail.UploadDate as string };
                      if (history.length > 1) {
                        history.splice(1, 0, labelAction);
                      } else {
                        history.push(labelAction);
                      }
                    }

                    // Đảo ngược mảng để hành động mới nhất hiện lên trên cùng
                    history.reverse();

                    if (history.length === 0) {
                      return <div className="text-center text-slate-400 text-sm font-medium italic py-8">Chưa có thao tác nào được ghi nhận.</div>;
                    }

                    return (
                      <div className="space-y-4">
                        {history.map((log: any, i: number) => (
                          <div key={i} className={`flex gap-4 items-start relative ${i < history.length - 1 ? 'before:absolute before:left-[11px] before:top-6 before:bottom-[-20px] before:w-[2px] before:bg-slate-200' : ''}`}>
                            <div className="w-6 h-6 rounded-full bg-white border-2 border-slate-300 flex flex-shrink-0 items-center justify-center mt-0.5 z-10 shadow-sm">
                              <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                            </div>
                            <div className="flex-1 bg-white p-4 rounded-xl border border-slate-200 hover:border-indigo-300 transition-colors shadow-sm">
                              <p className="font-bold text-[13px] text-slate-800 leading-snug mb-2">{log.action}</p>
                              <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500 font-semibold">
                                <span className="flex items-center gap-1"><svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg> {log.user}</span>
                                <span className="flex items-center gap-1"><svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg> {log.timestamp && log.timestamp.includes(' ') ? log.timestamp.split(' ').reverse().join(' lúc ') : log.timestamp}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                  
      {/* Modal Xóa Hàng Loạt */}
      {showBulkDeleteModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm shadow-2xl">
          <div className="bg-white border-2 border-red-200 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl relative flex flex-col">
            <div className="px-6 py-4 border-b border-red-100 flex justify-between items-center bg-red-50">
              <div className="flex items-center gap-2 text-red-700">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                <span className="font-black text-lg uppercase tracking-tight">Xóa theo danh sách Mã</span>
              </div>
              <button onClick={() => setShowBulkDeleteModal(false)} className="text-red-400 hover:text-red-800 p-2 rounded-lg transition">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-slate-600 mb-4 font-medium leading-relaxed">
                Sao chép và dán danh sách <strong>Mã Description</strong> bạn muốn xóa vào ô bên dưới.
                Mỗi mã cách nhau bởi dấu phẩy hoặc xuống dòng.
              </p>
              <textarea
                value={bulkDeleteText}
                onChange={(e) => setBulkDeleteText(e.target.value)}
                className="w-full h-40 border-2 border-slate-200 hover:border-indigo-300 focus:border-indigo-500 rounded-xl p-4 text-sm font-mono focus:outline-none transition-colors shadow-inner resize-none text-slate-700"
                placeholder="Ví dụ: 
ORDER-1234
ORDER-5678"
              ></textarea>
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => setShowBulkDeleteModal(false)} className="px-6 py-2.5 bg-white text-slate-600 font-bold rounded-xl border border-slate-300 hover:bg-slate-100 transition">
                Hủy bỏ
              </button>
              <button onClick={handleBulkDeleteSubmit} disabled={!bulkDeleteText.trim()} className="px-6 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl shadow-md transition disabled:opacity-50 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3"></path></svg>
                Thực Hiện Xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
})()}
                </div>
              </div>

            </div>

          </div>
        </div>
      )}


      {/* Modal Xóa Hàng Loạt */}
      {showBulkDeleteModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm shadow-2xl">
          <div className="bg-white border-2 border-red-200 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl relative flex flex-col">
            <div className="px-6 py-4 border-b border-red-100 flex justify-between items-center bg-red-50">
              <div className="flex items-center gap-2 text-red-700">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                <span className="font-black text-lg uppercase tracking-tight">Xóa theo danh sách Mã</span>
              </div>
              <button onClick={() => setShowBulkDeleteModal(false)} className="text-red-400 hover:text-red-800 p-2 rounded-lg transition">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-slate-600 mb-4 font-medium leading-relaxed">
                Sao chép và dán danh sách <strong>Mã Description</strong> bạn muốn xóa vào ô bên dưới.
                Mỗi mã cách nhau bởi dấu phẩy hoặc xuống dòng.
              </p>
              <textarea
                value={bulkDeleteText}
                onChange={(e) => setBulkDeleteText(e.target.value)}
                className="w-full h-40 border-2 border-slate-200 hover:border-indigo-300 focus:border-indigo-500 rounded-xl p-4 text-sm font-mono focus:outline-none transition-colors shadow-inner resize-none text-slate-700"
                placeholder="Ví dụ: \nORDER-1234\nORDER-5678"
              ></textarea>
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => setShowBulkDeleteModal(false)} className="px-6 py-2.5 bg-white text-slate-600 font-bold rounded-xl border border-slate-300 hover:bg-slate-100 transition">
                Hủy bỏ
              </button>
              <button onClick={handleBulkDeleteSubmit} disabled={!bulkDeleteText.trim()} className="px-6 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl shadow-md transition disabled:opacity-50 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3"></path></svg>
                Thực Hiện Xóa
              </button>
            </div>
          </div>
        </div>
      )}
      
      {toastMsg && (
        <div className={`fixed bottom-6 right-6 z-[9999] p-4 rounded-xl shadow-2xl border flex items-center gap-3 font-bold animate-in slide-in-from-bottom-5 fade-in duration-300 ${toastMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
            {toastMsg.type === 'success' ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            )}
            {toastMsg.title}
        </div>
      )}
    </div>
  );
}
