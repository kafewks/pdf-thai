// tools/edit.js - PDF Overlay Annotation Editor Engine (Thai Language Supported)
(function () {
  let currentFile = null;
  let pdfJsDoc = null;
  let currentPageNum = 1;
  let currentScale = 1.2;
  let activeTool = "text"; // 'text', 'whiteout', 'highlight', 'signature'
  let currentSignatureDataUrl = null;

  let annotationsByPage = {};

  let isDrawingRect = false;
  let rectStartX = 0, rectStartY = 0;
  let activeRectPreview = null;

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

    const prevPageBtn = document.getElementById("prevPageBtn");
    const nextPageBtn = document.getElementById("nextPageBtn");
    const pdfContainer = document.getElementById("pdfViewContainer");

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

    const tools = [
      { btn: toolTextBtn, mode: "text" },
      { btn: toolWhiteoutBtn, mode: "whiteout" },
      { btn: toolHighlightBtn, mode: "highlight" },
      { btn: toolSignBtn, mode: "signature" }
    ];

    tools.forEach(t => {
      t.btn.addEventListener("click", () => {
        activeTool = t.mode;
        tools.forEach(x => {
          x.btn.style.background = "#ffffff";
          x.btn.style.color = "#475569";
          x.btn.style.borderColor = "#cbd5e1";
        });
        t.btn.style.background = "#356ae6";
        t.btn.style.color = "#ffffff";
        t.btn.style.borderColor = "#356ae6";

        if (activeTool === "text") {
          textOptionsBox.classList.remove("hidden");
        } else {
          textOptionsBox.classList.add("hidden");
        }

        if (activeTool === "signature" && !currentSignatureDataUrl) {
          openSignatureModal();
        }
      });
    });

    // วางข้อความ ลายเซ็น หรือลากกรอบ Whiteout/Highlight
    pdfContainer.addEventListener("mousedown", (e) => {
      if (!pdfJsDoc) return;
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

        activeRectPreview = document.createElement("div");
        activeRectPreview.style.position = "absolute";
        activeRectPreview.style.border = "1px dashed #2563eb";
        activeRectPreview.style.background = activeTool === "whiteout" ? "#ffffff" : "rgba(255, 235, 59, 0.4)";
        activeRectPreview.style.left = `${rectStartX}px`;
        activeRectPreview.style.top = `${rectStartY}px`;
        pdfContainer.appendChild(activeRectPreview);
      }
    });

    pdfContainer.addEventListener("mousemove", (e) => {
      if (!isDrawingRect || !activeRectPreview) return;
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
    });

    pdfContainer.addEventListener("mouseup", (e) => {
      if (!isDrawingRect || !activeRectPreview) return;
      isDrawingRect = false;

      const rect = pdfContainer.getBoundingClientRect();
      const currentX = e.clientX - rect.left;
      const currentY = e.clientY - rect.top;

      const width = Math.abs(currentX - rectStartX);
      const height = Math.abs(currentY - rectStartY);
      const left = Math.min(rectStartX, currentX);
      const top = Math.min(rectStartY, currentY);

      if (activeRectPreview.parentNode) {
        activeRectPreview.parentNode.removeChild(activeRectPreview);
      }
      activeRectPreview = null;

      if (width > 5 && height > 5) {
        addAnnotation({
          type: activeTool,
          x: left,
          y: top,
          width: width,
          height: height
        });
      }
    });

    // Signature Pad Controller
    let isSigning = false;
    const sigCtx = signatureCanvas.getContext("2d");
    sigCtx.lineWidth = 2;
    sigCtx.strokeStyle = "#000000";

    function getCanvasPos(e) {
      const rect = signatureCanvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return { x: clientX - rect.left, y: clientY - rect.top };
    }

    function startSign(e) { isSigning = true; const p = getCanvasPos(e); sigCtx.beginPath(); sigCtx.moveTo(p.x, p.y); }
    function moveSign(e) { if (!isSigning) return; const p = getCanvasPos(e); sigCtx.lineTo(p.x, p.y); sigCtx.stroke(); }
    function endSign() { isSigning = false; }

    signatureCanvas.addEventListener("mousedown", startSign);
    signatureCanvas.addEventListener("mousemove", moveSign);
    window.addEventListener("mouseup", endSign);
    signatureCanvas.addEventListener("touchstart", startSign);
    signatureCanvas.addEventListener("touchmove", moveSign);
    signatureCanvas.addEventListener("touchend", endSign);

    clearSignBtn.onclick = () => sigCtx.clearRect(0, 0, signatureCanvas.width, signatureCanvas.height);
    cancelSignBtn.onclick = () => signModal.classList.add("hidden");
    useSignBtn.onclick = () => {
      currentSignatureDataUrl = signatureCanvas.toDataURL("image/png");
      signModal.classList.add("hidden");
      updateStatus("บันทึกลายเซ็นเรียบร้อย! คลิกตรงจุดที่ต้องการวางลายเซ็นบน PDF", false, true);
    };

    function openSignatureModal() {
      sigCtx.clearRect(0, 0, signatureCanvas.width, signatureCanvas.height);
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

    function renderOverlayItems() {
      const overlayLayer = document.getElementById("overlayLayer");
      overlayLayer.innerHTML = "";

      const currentAnns = annotationsByPage[currentPageNum] || [];
      currentAnns.forEach((ann, index) => {
        const elem = document.createElement("div");
        elem.style.position = "absolute";
        elem.style.left = `${ann.x}px`;
        elem.style.top = `${ann.y}px`;
        elem.style.pointerEvents = "auto";

        if (ann.type === "text") {
          elem.style.fontSize = `${ann.size}px`;
          elem.style.color = ann.color;
          elem.style.fontWeight = "bold";
          elem.style.whiteSpace = "nowrap";
          elem.textContent = ann.text;
        } else if (ann.type === "whiteout") {
          elem.style.width = `${ann.width}px`;
          elem.style.height = `${ann.height}px`;
          elem.style.background = "#ffffff";
          elem.style.border = "1px dashed #cbd5e1";
        } else if (ann.type === "highlight") {
          elem.style.width = `${ann.width}px`;
          elem.style.height = `${ann.height}px`;
          elem.style.background = "rgba(255, 235, 59, 0.4)";
        } else if (ann.type === "image") {
          const img = document.createElement("img");
          img.src = ann.dataUrl;
          img.style.width = `${ann.width}px`;
          img.style.height = `${ann.height}px`;
          elem.appendChild(img);
        }

        const delBtn = document.createElement("span");
        delBtn.textContent = "✕";
        delBtn.style.cssText = "position:absolute; top:-10px; right:-10px; background:#dc2626; color:#fff; border-radius:50%; width:16px; height:16px; font-size:10px; display:flex; align-items:center; justify-content:center; cursor:pointer;";
        delBtn.onclick = (e) => {
          e.stopPropagation();
          currentAnns.splice(index, 1);
          renderOverlayItems();
        };

        elem.appendChild(delBtn);
        overlayLayer.appendChild(elem);
      });
    }

    // แปลงข้อความภาษาไทยเป็น Image Canvas เพื่อเรนเดอร์ลงใน PDF ได้แม่นยำ 100%
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
              // ใช้ Canvas แปลงข้อความ (รองรับภาษาไทย) เป็น PNG แปะลง PDF
              const textImgData = textToImageCanvas(ann.text, ann.size / currentScale, ann.color);
              const embeddedTextImg = await pdfDoc.embedPng(textImgData.dataUrl);

              pdfPage.drawImage(embeddedTextImg, {
                x: pdfX,
                y: pdfY - textImgData.height,
                width: textImgData.width,
                height: textImgData.height
              });
            } else if (ann.type === "whiteout") {
              pdfPage.drawRectangle({
                x: pdfX,
                y: pdfY - (ann.height / currentScale),
                width: ann.width / currentScale,
                height: ann.height / currentScale,
                color: PDFLib.rgb(1, 1, 1)
              });
            } else if (ann.type === "highlight") {
              pdfPage.drawRectangle({
                x: pdfX,
                y: pdfY - (ann.height / currentScale),
                width: ann.width / currentScale,
                height: ann.height / currentScale,
                color: PDFLib.rgb(1, 0.92, 0.23),
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