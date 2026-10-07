// tools/img2pdf.js - Image to PDF Converter Engine
(function () {
  let selectedImages = [];
  let dragSrcIndex = null;

  window.initImg2PdfTool = function () {
    const input = document.getElementById("imgFileInput");
    const drop = document.getElementById("imgDropArea");
    const workspace = document.getElementById("imgWorkspace");
    const previewGrid = document.getElementById("imgPreviewGrid");
    const submitBtn = document.getElementById("imgSubmitBtn");
    const addMoreBtn = document.getElementById("imgAddMoreBtn");
    const clearAllBtn = document.getElementById("imgClearAllBtn");
    const countBadge = document.getElementById("imgCountBadge");
    const status = document.getElementById("imgStatus");

    if (!input) return;

    if (!input.dataset.bound) {
      input.dataset.bound = "true";

      drop.addEventListener("click", (e) => {
        e.preventDefault();
        input.click();
      });

      addMoreBtn.addEventListener("click", () => input.click());

      input.addEventListener("change", (e) => {
        if (e.target.files && e.target.files.length > 0) {
          handleFiles(Array.from(e.target.files));
        }
      });

      drop.addEventListener("dragover", (e) => {
        e.preventDefault();
        drop.style.borderColor = "#356ae6";
        drop.style.background = "#dbeafe";
      });

      drop.addEventListener("dragleave", (e) => {
        e.preventDefault();
        drop.style.borderColor = "#93c5fd";
        drop.style.background = "#eff6ff";
      });

      drop.addEventListener("drop", (e) => {
        e.preventDefault();
        drop.style.borderColor = "#93c5fd";
        drop.style.background = "#eff6ff";

        const validFiles = Array.from(e.dataTransfer.files).filter((f) =>
          f.type.startsWith("image/")
        );
        if (validFiles.length > 0) {
          handleFiles(validFiles);
        } else {
          updateStatus("กรุณาเลือกไฟล์รูปภาพเท่านั้น (JPG, PNG, WebP)", true);
        }
      });

      clearAllBtn.onclick = resetAll;
      submitBtn.onclick = convertImagesToPdf;
    }

    function handleFiles(files) {
      files.forEach((file) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          selectedImages.push({
            file: file,
            dataUrl: e.target.result,
            name: file.name
          });
          renderGrid();
        };
        reader.readAsDataURL(file);
      });
      input.value = "";
    }

    function renderGrid() {
      if (selectedImages.length === 0) {
        resetAll();
        return;
      }

      drop.classList.add("hidden");
      workspace.classList.remove("hidden");
      countBadge.textContent = `${selectedImages.length} รูป`;
      previewGrid.innerHTML = "";
      updateStatus("");

      selectedImages.forEach((imgObj, index) => {
        const card = document.createElement("div");
        card.className = "page-card";
        card.draggable = true;
        card.dataset.index = index;
        card.style.cssText =
          "display:flex; flex-direction:column; align-items:center; background:#fff; padding:8px; border-radius:10px; border:1px solid #cbd5e1; cursor:grab; position:relative;";

        // Drag and Drop reorder
        card.addEventListener("dragstart", (e) => {
          dragSrcIndex = index;
          e.dataTransfer.effectAllowed = "move";
          card.style.opacity = "0.4";
        });

        card.addEventListener("dragend", () => {
          card.style.opacity = "1";
        });

        card.addEventListener("dragover", (e) => {
          e.preventDefault();
          card.style.borderColor = "#356ae6";
        });

        card.addEventListener("dragleave", () => {
          card.style.borderColor = "#cbd5e1";
        });

        card.addEventListener("drop", (e) => {
          e.preventDefault();
          e.stopPropagation();
          const targetIndex = parseInt(card.dataset.index, 10);
          if (dragSrcIndex !== null && dragSrcIndex !== targetIndex) {
            const moved = selectedImages.splice(dragSrcIndex, 1)[0];
            selectedImages.splice(targetIndex, 0, moved);
            renderGrid();
          }
        });

        const img = document.createElement("img");
        img.src = imgObj.dataUrl;
        img.style.cssText = "max-width:100px; max-height:120px; object-fit:contain; border-radius:4px;";

        const label = document.createElement("span");
        label.textContent = `${index + 1}. ${imgObj.name}`;
        label.style.cssText =
          "font-size:11px; font-weight:600; color:#475569; margin-top:6px; max-width:100px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;";

        const delBtn = document.createElement("button");
        delBtn.textContent = "✕";
        delBtn.style.cssText =
          "position:absolute; top:4px; right:4px; background:#fee2e2; color:#dc2626; border:none; border-radius:50%; width:20px; height:20px; font-size:11px; cursor:pointer; display:flex; align-items:center; justify-content:center;";
        delBtn.onclick = (e) => {
          e.stopPropagation();
          selectedImages.splice(index, 1);
          renderGrid();
        };

        card.appendChild(delBtn);
        card.appendChild(img);
        card.appendChild(label);
        previewGrid.appendChild(card);
      });
    }

    async function convertImagesToPdf() {
      if (selectedImages.length === 0) return;

      submitBtn.disabled = true;
      updateStatus("กำลังสร้างไฟล์ PDF...");

      try {
        const pdfDoc = await PDFLib.PDFDocument.create();
        const pageSize = document.getElementById("imgPageSize").value;
        const orientation = document.getElementById("imgOrientation").value;

        for (const imgObj of selectedImages) {
          const arrayBuffer = await imgObj.file.arrayBuffer();
          let embeddedImage;

          if (imgObj.file.type === "image/png") {
            embeddedImage = await pdfDoc.embedPng(arrayBuffer);
          } else {
            // รองรับ JPG และประเภทอื่นๆ
            embeddedImage = await pdfDoc.embedJpg(arrayBuffer);
          }

          const imgWidth = embeddedImage.width;
          const imgHeight = embeddedImage.height;

          let page;
          if (pageSize === "a4") {
            // ขนาด A4 ในหน่วย points (595.28 x 841.89)
            const a4Width = orientation === "portrait" ? 595.28 : 841.89;
            const a4Height = orientation === "portrait" ? 841.89 : 595.28;

            page = pdfDoc.addPage([a4Width, a4Height]);

            // คำนวณสเกลให้รูปพอดีกับ A4 โดยไม่เสียอัตราส่วน
            const scale = Math.min(a4Width / imgWidth, a4Height / imgHeight);
            const scaledWidth = imgWidth * scale;
            const scaledHeight = imgHeight * scale;

            // จัดกึ่งกลางหน้ากระดาษ
            const x = (a4Width - scaledWidth) / 2;
            const y = (a4Height - scaledHeight) / 2;

            page.drawImage(embeddedImage, {
              x: x,
              y: y,
              width: scaledWidth,
              height: scaledHeight
            });
          } else {
            // โหมด Auto Fit: สร้างหน้ากระดาษตามขนาดรูปเป๊ะๆ
            page = pdfDoc.addPage([imgWidth, imgHeight]);
            page.drawImage(embeddedImage, {
              x: 0,
              y: 0,
              width: imgWidth,
              height: imgHeight
            });
          }
        }

        const pdfBytes = await pdfDoc.save();
        downloadBlob(pdfBytes, `Feelgood_ImageToPDF_${getStamp()}.pdf`);
        updateStatus("แปลงรูปภาพเป็น PDF สำเร็จเรียบร้อย! ✓", false, true);
      } catch (err) {
        updateStatus(`เกิดข้อผิดพลาด: ${err.message}`, true);
      } finally {
        submitBtn.disabled = false;
      }
    }

    function downloadBlob(bytes, filename) {
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    }

    function resetAll() {
      selectedImages = [];
      workspace.classList.add("hidden");
      drop.classList.remove("hidden");
      input.value = "";
      previewGrid.innerHTML = "";
      updateStatus("");
    }

    function updateStatus(msg, isError = false, isSuccess = false) {
      if (typeof window.showStatus === "function") {
        window.showStatus(status, msg, isError, isSuccess);
      } else {
        status.textContent = msg;
        status.style.color = isError ? "#dc2626" : isSuccess ? "#16a34a" : "#4a5568";
      }
    }

    function getStamp() {
      return typeof window.dateStamp === "function" ? window.dateStamp() : "file";
    }
  };
})();