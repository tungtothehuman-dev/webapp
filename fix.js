const fs = require('fs');
let content = fs.readFileSync('src/pdfTaskStore.ts', 'utf8');

// Add cleanFilenameNoSpace
content = content.replace(
    `const cleanFilename = file.name.replace(/\\.[^/.]+$/, "").toUpperCase();`,
    `const cleanFilename = file.name.replace(/\\.[^/.]+$/, "").toUpperCase();\n                    const cleanFilenameNoSpace = cleanFilename.replace(/[\\s\\-_,\\.]/g, '');`
);

// Add addressClean
content = content.replace(
    `const nameClean = nameStr.replace(/[\\s\\-_,\\.]/g, '');`,
    `const nameClean = nameStr.replace(/[\\s\\-_,\\.]/g, '');\n\n                        const addressStr = (order["Receiver Address 1"] || "").toString().toUpperCase();\n                        const addressClean = addressStr.replace(/[\\s\\-_,\\.]/g, '');`
);

// Replace barcode score
content = content.replace(
    `// 1. Quét Mã Barcode (Ưu tiên tuyệt đối)\n                        if (barcodeText && (barcodeText.includes(description) || (trackingNumber && barcodeText.includes(trackingNumber)))) {\n                            score += 100;\n                        }`.replace(/\n/g, '\r\n'),
    `// 4. Quét Mã Barcode (Bổ trợ)\n                        if (barcodeText && (barcodeText.includes(description) || (trackingNumber && barcodeText.includes(trackingNumber)))) {\n                            score += 10;\n                        }`.replace(/\n/g, '\r\n')
);

// Replace Desc score
content = content.replace(
    `// 2. Chấm điểm Y XÌ ĐÚC Mã Description (Bắt buộc phải có)\n                        if (descClean.length > 2 && pdfClean.includes(descClean)) {\n                            score += 100; \n                        }`.replace(/\n/g, '\r\n'),
    `// 1. Mỏ Neo 1: Bắt buộc mã Description (từ file hoặc từ OCR) -> 1000đ\n                        if (descClean.length > 2 && (cleanFilenameNoSpace === descClean || cleanFilenameNoSpace.includes(descClean))) {\n                            score += 1000;\n                        } else if (descClean.length > 2 && pdfClean.includes(descClean)) {\n                            score += 1000; \n                        }`.replace(/\n/g, '\r\n')
);

// Replace Name score
content = content.replace(
    `// 3. Chấm điểm Y XÌ ĐÚC Tên trong văn bản ảnh\n                        if (nameClean.length > 2 && pdfClean.includes(nameClean)) {\n                            score += 10; \n                        }`.replace(/\n/g, '\r\n'),
    `// 2. Mỏ Neo 2: CHẮC CHẮN PHẢI CÓ TÊN (Song song) -> 1000đ\n                        if (nameClean.length > 2 && pdfClean.includes(nameClean)) {\n                            score += 1000; \n                        }\n\n                        // 3. Yếu tố phụ cộng thêm (Địa chỉ) -> 10đ\n                        if (addressClean.length > 5 && pdfClean.includes(addressClean)) {\n                            score += 10; \n                        }`.replace(/\n/g, '\r\n')
);

// Replace strict threshold text
content = content.replace(
    `// TỐI QUAN TRỌNG: Ngưỡng khắt khe 100 điểm (BẮT BUỘC phải khớp hoàn toàn mã Description hoặc Barcode)\n                    // Chỉ Tên không thì sẽ không đủ điểm qua ải, chống nhầm lẫn khi khách mua nhiều đơn\n                    if (matchedIndex !== -1 && bestScore >= 100) {`.replace(/\n/g, '\r\n'),
    `// TỐI QUAN TRỌNG: Ngưỡng khắt khe 2000 điểm (YÊU CẦU SONG SONG 2 YẾU TỐ)\n                    // Bắt buộc 100% phải có Description (1000đ) VÀ Tên Khách (1000đ) CÙNG LÚC\n                    if (matchedIndex !== -1 && bestScore >= 2000) {`.replace(/\n/g, '\r\n')
);

// Replace success log text
content = content.replace(
    `]. Chuẩn xác 100% (\${bestScore} điểm).`);`,
    `]. Khớp HOÀN HẢO Tên + Desc (\${bestScore} điểm).`);`
);

fs.writeFileSync('src/pdfTaskStore.ts', content);
console.log('Done');
