// tools/edit.js - Full Overlay PDF Editor Engine with Drag & Drop Re-positioning
(function () {
  let currentFile = null;
  let pdfJsDoc = null;
  let currentPageNum = 1;
  let currentScale = 1.2;
  let activeTool = "text"; // 'text', 'whiteout', 'highlight', 'signature'
  let currentSignatureDataUrl = null;
  let currentSignColor = "#000000";

  let annotationsByPage = {};

  let isDrawingRect = false;
  let rectStartX = 0, rectStartY = 0;
  let activeRectPreview = null;

  // Variables สำหรับระบบ Drag & Drop
  let isDraggingItem = false;
  let draggedItemIndex = null;
  let dragOffsetX = 0, dragOffsetY = 0;

  window.initEditTool = function () {
    const input = document.getElementById("editFileInput");
    const drop = document.getElementById("editDropArea");
    const workspace = document.getElementById("editWorkspace");
    const cancelBtn = document.getElementById("editCancelBtn");
    const saveBtn = document.getElementById("editSaveBtn");
    const status = document.getElementById("editStatus");

    const toolTextBtn = document.getElementById("toolTextBtn");
    const toolWhiteoutBtn = document.getElementById("toolWhiteoutBtn");
    const toolHighlightBtn = document.getElementById("toolHighlightBtn");
    const toolSignBtn = document.getElementById("toolSignBtn");

    const textOptionsBox = document.getElementById("textOptionsBox");
    const whiteoutOptionsBox = document.getElementById("whiteoutOptionsBox");
    const highlightOptionsBox = document.getElementById("highlightOptionsBox");
    const pickColorBtn = document.getElementById("pickColorBtn");

    const prevPageBtn = document.getElementById("prevPageBtn");
    const nextPageBtn = document.getElementById("nextPageBtn");
    const pdfContainer = document.getElementById("pdfViewContainer");
    const overlayLayer = document.getElementById("overlayLayer");

    const signModal = document.getElementById("signModal");
    const signatureCanvas = document.getElementById("signatureCanvas");
    const clearSignBtn = document.getElementById("clearSignBtn");
    const cancelSignBtn = document.getElementById("cancelSignBtn");
    const useSignBtn = document.getElementById("useSignBtn");

    if (!input || input.dataset.bound) return;
    input.dataset.bound = "true";

    drop.addEventListener("click", () => input.click());

    input.addEventListener("change", (e) => {
      if (e.target.files && e.target.files[0]) loadPdf(e.target.files[0]);
    });

    // 1. สลับโหมดเครื่องมือ
    const tools = [
      { btn: toolTextBtn, mode: "text", box: textOptionsBox },
      { btn: toolWhiteoutBtn, mode: "whiteout", box: whiteoutOptionsBox },
      { btn: toolHighlightBtn, mode: "highlight", box: highlightOptionsBox },
      { btn: toolSignBtn, mode: "signature", box: null }
    ];

    tools.forEach(t => {
      if (!t.btn) return;
      t.btn.addEventListener("click", (e) => {
        e.preventDefault();
        activeTool = t.mode;

        tools.forEach(x => {
          if (!x.btn) return;
          x.btn.style.background = "#ffffff";
          x.btn.style.color = "#475569";
          x.btn.style.borderColor = "#cbd5e1";
          if (x.box) {
            x.box.classList.add("hidden");
            x.box.style.display = "none";
          }
        });

        t.btn.style.background = "#356ae6";
        t.btn.style.color = "#ffffff";
        t.btn.style.borderColor = "#356ae6";

        if (t.box) {
          t.box.classList.remove("hidden");
          t.box.style.display = "flex";
        }

        if (activeTool === "signature") {
          openSignatureModal();
        }
      });
    });

    // ปุ่มดูดสี (Eyedropper API)
    if (pickColorBtn) {
      pickColorBtn.addEventListener("click", async () => {
        if (window.EyeDropper) {
          try {
            const eyeDropper = new EyeDropper();
            const result = await eyeDropper.open();
            if (result && result.sRGBHex) {
              const whiteoutColorInput = document.getElementById("whiteoutColorInput");
              if (whiteoutColorInput) whiteoutColorInput.value = result.sRGBHex;
            }
          } catch (e) {
            console.log("EyeDropper canceled");
          }
        } else {
          alert("เบราว์เซอร์ของคุณยังไม่รองรับเครื่องมือดูดสี สามารถคลิกเลือกสีจากช่อง Color Picker ได้ครับ");
        }
      });
    }

    function getSelectedWhiteoutColor() {
      const el = document.getElementById("whiteoutColorInput");
      return el ? el.value : "#ffffff";
    }

    function getSelectedHighlightColor() {
      const checked = document.querySelector('input[name="hlColor"]:checked');
      return checked ? checked.value : "rgba(255, 235, 59, 0.4)";
    }

    // 2. Event Mouse สำหรับวาดสร้างวัตถุ
    pdfContainer.style.pointerEvents = "auto";
    overlayLayer.style.pointerEvents = "none";

    pdfContainer.addEventListener("mousedown", (e) => {
      if (!pdfJsDoc || e.target.classList.contains("del-btn") || isDraggingItem) return;

      const rect = pdfContainer.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      if (activeTool === "text") {
        const textVal = document.getElementById("editTextInput").value.trim() || "ข้อความใหม่";
        const fontSize = parseInt(document.getElementById("textSizeInput").value, 10) || 16;
        const color = document.getElementById("textColorInput").value || "#000000";

        addAnnotation({
          type: "text",
          text: textVal,
          x: clickX,
          y: clickY,
          size: fontSize,
          color: color
        });
      } else if (activeTool === "signature") {
        if (!currentSignatureDataUrl) {
          openSignatureModal();
          return;
        }
        addAnnotation({
          type: "image",
          dataUrl: currentSignatureDataUrl,
          x: clickX - 60,
          y: clickY - 30,
          width: 120,
          height: 60
        });
      } else if (activeTool === "whiteout" || activeTool === "highlight") {
        isDrawingRect = true;
        rectStartX = clickX;
        rectStartY = clickY;

        const fillColor = activeTool === "whiteout" ? getSelectedWhiteoutColor() : getSelectedHighlightColor();

        if (activeRectPreview && activeRectPreview.parentNode) {
          activeRectPreview.parentNode.removeChild(activeRectPreview);
        }

        activeRectPreview = document.createElement("div");
        activeRectPreview.style.position = "absolute";
        activeRectPreview.style.border = "1px dashed #2563eb";
        activeRectPreview.style.background = fillColor;
        activeRectPreview.style.left = `${rectStartX}px`;
        activeRectPreview.style.top = `${rectStartY}px`;
        activeRectPreview.style.width = "0px";
        activeRectPreview.style.height = "0px";
        activeRectPreview.style.zIndex = "15";
        activeRectPreview.style.pointerEvents = "none";
        pdfContainer.appendChild(activeRectPreview);
      }
    });

    window.addEventListener("mousemove", (e) => {
      // 2.1 กรณีลากวาดสี่เหลี่ยม
      if (isDrawingRect && activeRectPreview) {
        const rect = pdfContainer.getBoundingClientRect();
        const currentX = e.clientX - rect.left;
        const currentY = e.clientY - rect.top;

        const width = Math.abs(currentX - rectStartX);
        const height = Math.abs(currentY - rectStartY);
        const left = Math.min(rectStartX, currentX);
        const top = Math.min(rectStartY, currentY);

        activeRectPreview.style.left = `${left}px`;
        activeRectPreview.style.top = `${top}px`;
        activeRectPreview.style.width = `${width}px`;
        activeRectPreview.style.height = `${height}px`;
      }

      // 2.2 กรณีเลื่อน/ขยับวัตถุ (Drag Item)
      if (isDraggingItem && draggedItemIndex !== null) {
        const rect = pdfContainer.getBoundingClientRect();
        const currentX = e.clientX - rect.left;
        const currentY = e.clientY - rect.top;

        const currentAnns = annotationsByPage[currentPageNum] || [];
        if (currentAnns[draggedItemIndex]) {
          currentAnns[draggedItemIndex].x = currentX - dragOffsetX;
          currentAnns[draggedItemIndex].y = currentY - dragOffsetY;
          renderOverlayItems();
        }
      }
    });

    window.addEventListener("mouseup", (e) => {
      if (isDraggingItem) {
        isDraggingItem = false;
        draggedItemIndex = null;
      }

      if (isDrawingRect && activeRectPreview) {
        isDrawingRect = false;

        const rect = pdfContainer.getBoundingClientRect();
        const currentX = e.clientX - rect.left;
        const currentY = e.clientY - rect.top;

        const width = Math.abs(currentX - rectStartX);
        const height = Math.abs(currentY - rectStartY);
        const left = Math.min(rectStartX, currentX);
        const top = Math.min(rectStartY, currentY);

        if (activeRectPreview && activeRectPreview.parentNode) {
          activeRectPreview.parentNode.removeChild(activeRectPreview);
        }
        activeRectPreview = null;

        if (width > 5 && height > 5) {
          if (activeTool === "whiteout") {
            addAnnotation({
              type: "whiteout",
              x: left,
              y: top,
              width: width,
              height: height,
              color: getSelectedWhiteoutColor()
            });
          } else if (activeTool === "highlight") {
            addAnnotation({
              type: "highlight",
              x: left,
              y: top,
              width: width,
              height: height,
              color: getSelectedHighlightColor()
            });
          }
        }
      }
    });

    // 3. Signature Pad Controller
    let isSigning = false;
    const sigCtx = signatureCanvas.getContext("2d");
    sigCtx.lineWidth = 2.5;

    document.querySelectorAll(".sign-color-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".sign-color-btn").forEach(b => b.style.borderColor = "transparent");
        btn.style.borderColor = "#356ae6";
        currentSignColor = btn.dataset.color;
        sigCtx.strokeStyle = currentSignColor;
      });
    });

    const customColorInput = document.getElementById("signColorCustom");
    if (customColorInput) {
      customColorInput.addEventListener("input", (e) => {
        document.querySelectorAll(".sign-color-btn").forEach(b => b.style.borderColor = "transparent");
        currentSignColor = e.target.value;
        sigCtx.strokeStyle = currentSignColor;
      });
    }

    function getCanvasPos(e) {
      const rect = signatureCanvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return { x: clientX - rect.left, y: clientY - rect.top };
    }

    function startSign(e) { 
      e.preventDefault();
      isSigning = true; 
      sigCtx.strokeStyle = currentSignColor;
      const p = getCanvasPos(e); 
      sigCtx.beginPath(); 
      sigCtx.moveTo(p.x, p.y); 
    }
    function moveSign(e) { 
      if (!isSigning) return; 
      e.preventDefault();
      const p = getCanvasPos(e); 
      sigCtx.lineTo(p.x, p.y); 
      sigCtx.stroke(); 
    }
    function endSign(e) { isSigning = false; }

    signatureCanvas.addEventListener("mousedown", startSign);
    signatureCanvas.addEventListener("mousemove", moveSign);
    window.addEventListener("mouseup", endSign);

    signatureCanvas.addEventListener("touchstart", startSign, { passive: false });
    signatureCanvas.addEventListener("touchmove", moveSign, { passive: false });
    signatureCanvas.addEventListener("touchend", endSign);

    clearSignBtn.onclick = () => sigCtx.clearRect(0, 0, signatureCanvas.width, signatureCanvas.height);
    cancelSignBtn.onclick = () => signModal.classList.add("hidden");
    useSignBtn.onclick = () => {
      currentSignatureDataUrl = signatureCanvas.toDataURL("image/png");
      signModal.classList.add("hidden");
      updateStatus("สร้างลายเซ็นสำเร็จ! คลิกวางหรือลากขยับตำแหน่งบน PDF ได้เลย", false, true);
    };

    function openSignatureModal() {
      sigCtx.clearRect(0, 0, signatureCanvas.width, signatureCanvas.height);
      sigCtx.strokeStyle = currentSignColor;
      signModal.classList.remove("hidden");
    }

    prevPageBtn.onclick = () => {
      if (currentPageNum > 1) {
        currentPageNum--;
        renderPage(currentPageNum);
      }
    };

    nextPageBtn.onclick = () => {
      if (pdfJsDoc && currentPageNum < pdfJsDoc.numPages) {
        currentPageNum++;
        renderPage(currentPageNum);
      }
    };

    cancelBtn.onclick = resetWorkspace;
    saveBtn.onclick = saveEditedPdf;

    async function loadPdf(file) {
      currentFile = file;
      drop.classList.add("hidden");
      workspace.classList.remove("hidden");
      document.getElementById("editFileName").textContent = file.name;
      annotationsByPage = {};
      currentPageNum = 1;
      updateStatus("");

      try {
        const bytes = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: bytes });
        pdfJsDoc = await loadingTask.promise;

        renderPage(currentPageNum);
      } catch (err) {
        updateStatus(`ไม่สามารถอ่านไฟล์ PDF ได้: ${err.message}`, true);
      }
    }

    async function renderPage(pageNum) {
      if (!pdfJsDoc) return;

      const page = await pdfJsDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: currentScale });

      const canvas = document.getElementById("pdfCanvas");
      const context = canvas.getContext("2d");
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const container = document.getElementById("pdfViewContainer");
      container.style.width = `${viewport.width}px`;
      container.style.height = `${viewport.height}px`;

      document.getElementById("editPageInfo").textContent = `หน้า ${pageNum}/${pdfJsDoc.numPages}`;
      document.getElementById("pageNavText").textContent = `หน้า ${pageNum}`;

      await page.render({ canvasContext: context, viewport: viewport }).promise;
      renderOverlayItems();
    }

    function addAnnotation(ann) {
      if (!annotationsByPage[currentPageNum]) {
        annotationsByPage[currentPageNum] = [];
      }
      annotationsByPage[currentPageNum].push(ann);
      renderOverlayItems();
    }

    // 4. แสดงผลวัตถุ + เพิ่มความสามารถในการเลื่อน/ขยับ (Drag & Drop)
    function renderOverlayItems() {
      overlayLayer.innerHTML = "";

      const currentAnns = annotationsByPage[currentPageNum] || [];
      currentAnns.forEach((ann, index) => {
        const elem = document.createElement("div");
        elem.style.position = "absolute";
        elem.style.left = `${ann.x}px`;
        elem.style.top = `${ann.y}px`;
        elem.style.pointerEvents = "auto";
        elem.style.zIndex = "20";
        elem.style.cursor = "move"; // เปลี่ยน Cursor เป็นรูปมือจับ
        elem.style.userSelect = "none";

        if (ann.type === "text") {
          elem.style.fontSize = `${ann.size}px`;
          elem.style.color = ann.color;
          elem.style.fontWeight = "bold";
          elem.style.whiteSpace = "nowrap";
          elem.style.padding = "2px 4px";
          elem.style.border = "1px dashed transparent";
          elem.textContent = ann.text;
        } else if (ann.type === "whiteout") {
          elem.style.width = `${ann.width}px`;
          elem.style.height = `${ann.height}px`;
          elem.style.background = ann.color || "#ffffff";
          elem.style.border = "1px dashed #cbd5e1";
        } else if (ann.type === "highlight") {
          elem.style.width = `${ann.width}px`;
          elem.style.height = `${ann.height}px`;
          elem.style.background = ann.color || "rgba(255, 235, 59, 0.4)";
          elem.style.border = "1px dashed transparent";
        } else if (ann.type === "image") {
          const img = document.createElement("img");
          img.src = ann.dataUrl;
          img.style.width = `${ann.width}px`;
          img.style.height = `${ann.height}px`;
          img.style.pointerEvents = "none";
          elem.appendChild(img);
        }

        // เอฟเฟกต์แสดงขอบเมื่อเอาเมาส์ไปชี้
        elem.addEventListener("mouseenter", () => {
          if (ann.type === "text" || ann.type === "highlight") elem.style.borderColor = "#356ae6";
        });
        elem.addEventListener("mouseleave", () => {
          if (ann.type === "text" || ann.type === "highlight") elem.style.borderColor = "transparent";
        });

        // Event กดคลิกลากวัตถุเพื่อขยับตำแหน่ง
        elem.addEventListener("mousedown", (e) => {
          if (e.target.classList.contains("del-btn")) return;
          e.stopPropagation();
          isDraggingItem = true;
          draggedItemIndex = index;

          const rect = pdfContainer.getBoundingClientRect();
          const clickX = e.clientX - rect.left;
          const clickY = e.clientY - rect.top;

          dragOffsetX = clickX - ann.x;
          dragOffsetY = clickY - ann.y;
        });

        // ปุ่มลบรายการ (✕)
        const delBtn = document.createElement("button");
        delBtn.type = "button";
        delBtn.className = "del-btn";
        delBtn.textContent = "✕";
        delBtn.style.cssText = "position:absolute; top:-12px; right:-12px; background:#dc2626; color:#fff; border:none; border-radius:50%; width:20px; height:20px; font-size:11px; font-weight:bold; display:flex; align-items:center; justify-content:center; cursor:pointer; box-shadow:0 2px 4px rgba(0,0,0,0.2); z-index:30;";
        
        delBtn.onclick = (e) => {
          e.stopPropagation();
          e.preventDefault();
          currentAnns.splice(index, 1);
          renderOverlayItems();
        };

        elem.appendChild(delBtn);
        overlayLayer.appendChild(elem);
      });
    }

    function textToImageCanvas(text, size, colorHex) {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const font = `bold ${size * 2}px sans-serif`;
      ctx.font = font;

      const metrics = ctx.measureText(text);
      const width = metrics.width + 10;
      const height = size * 2.5;

      canvas.width = width;
      canvas.height = height;

      ctx.font = font;
      ctx.fillStyle = colorHex;
      ctx.textBaseline = "top";
      ctx.fillText(text, 5, 5);

      return {
        dataUrl: canvas.toDataURL("image/png"),
        width: width / 2,
        height: height / 2
      };
    }

    function hexToRgbRatio(hexStr) {
      let hex = hexStr.replace("#", "");
      if (hex.length === 3) hex = hex.split('').map(s => s + s).join('');
      const r = parseInt(hex.substring(0, 2), 16) / 255;
      const g = parseInt(hex.substring(2, 4), 16) / 255;
      const b = parseInt(hex.substring(4, 6), 16) / 255;
      return { r, g, b };
    }

    // 5. ประมวลผลและสร้างไฟล์ PDF
    async function saveEditedPdf() {
      if (!currentFile) return;

      saveBtn.disabled = true;
      updateStatus("กำลังบันทึกและประมวลผล PDF...");

      try {
        const bytes = await currentFile.arrayBuffer();
        const pdfDoc = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true });
        const pages = pdfDoc.getPages();

        for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
          const pageNum = pageIdx + 1;
          const pageAnns = annotationsByPage[pageNum] || [];
          const pdfPage = pages[pageIdx];
          const pageHeight = pdfPage.getHeight();

          for (const ann of pageAnns) {
            const pdfX = ann.x / currentScale;
            const pdfY = pageHeight - (ann.y / currentScale);

            if (ann.type === "text") {
              const textImgData = textToImageCanvas(ann.text, ann.size / currentScale, ann.color);
              const embeddedTextImg = await pdfDoc.embedPng(textImgData.dataUrl);

              pdfPage.drawImage(embeddedTextImg, {
                x: pdfX,
                y: pdfY - textImgData.height,
                width: textImgData.width,
                height: textImgData.height
              });
            } else if (ann.type === "whiteout") {
              const rgb = hexToRgbRatio(ann.color || "#ffffff");
              pdfPage.drawRectangle({
                x: pdfX,
                y: pdfY - (ann.height / currentScale),
                width: ann.width / currentScale,
                height: ann.height / currentScale,
                color: PDFLib.rgb(rgb.r, rgb.g, rgb.b)
              });
            } else if (ann.type === "highlight") {
              let rgb = { r: 1, g: 0.92, b: 0.23 };
              if (ann.color.includes("76, 175, 80")) rgb = { r: 0.3, g: 0.69, b: 0.31 };
              else if (ann.color.includes("33, 150, 243")) rgb = { r: 0.13, g: 0.59, b: 0.95 };
              else if (ann.color.includes("233, 30, 99")) rgb = { r: 0.91, g: 0.12, b: 0.39 };

              pdfPage.drawRectangle({
                x: pdfX,
                y: pdfY - (ann.height / currentScale),
                width: ann.width / currentScale,
                height: ann.height / currentScale,
                color: PDFLib.rgb(rgb.r, rgb.g, rgb.b),
                opacity: 0.35
              });
            } else if (ann.type === "image") {
              const embeddedImg = await pdfDoc.embedPng(ann.dataUrl);
              pdfPage.drawImage(embeddedImg, {
                x: pdfX,
                y: pdfY - (ann.height / currentScale),
                width: ann.width / currentScale,
                height: ann.height / currentScale
              });
            }
          }
        }

        const newBytes = await pdfDoc.save();
        downloadBlob(newBytes, `Feelgood_Edited_${getStamp()}.pdf`);
        updateStatus("บันทึกไฟล์ PDF ที่แก้ไขสำเร็จเรียบร้อย! ✓", false, true);
      } catch (err) {
        updateStatus(`เกิดข้อผิดพลาดในการบันทึก: ${err.message}`, true);
      } finally {
        saveBtn.disabled = false;
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

    function resetWorkspace() {
      currentFile = null;
      pdfJsDoc = null;
      annotationsByPage = {};
      workspace.classList.add("hidden");
      drop.classList.remove("hidden");
      input.value = "";
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