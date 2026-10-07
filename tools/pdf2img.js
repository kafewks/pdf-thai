// tools/pdf2img.js - PDF to Image Converter Engine
(function () {
  let currentFile = null;
  let pdfJsDoc = null;
  let renderedImages = []; // เก็บ Data URL ของรูปภาพแต่ละหน้า { pageNum, dataUrl, extension }

  window.initPdf2ImgTool = function () {
    const input = document.getElementById("pdf2imgFileInput");
    const drop = document.getElementById("pdf2imgDropArea");
    const workspace = document.getElementById("pdf2imgWorkspace");
    const grid = document.getElementById("pdf2imgGrid");
    const cancelBtn = document.getElementById("pdf2imgCancelBtn");
    const downloadAllBtn = document.getElementById("pdf2imgDownloadAllBtn");
    const formatSelect = document.getElementById("pdf2imgFormat");
    const scaleSelect = document.getElementById("pdf2imgScale");
    const status = document.getElementById("pdf2imgStatus");

    if (!input) return;

    if (!input.dataset.bound) {
      input.dataset.bound = "true";

      drop.addEventListener("click", (e) => {
        e.preventDefault();
        input.click();
      });

      input.addEventListener("change", (e) => {
        if (e.target.files && e.target.files[0]) {
          loadPdf(e.target.files[0]);
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

        const f = e.dataTransfer.files[0];
        if (f && (f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"))) {
          loadPdf(f);
        } else {
          updateStatus("กรุณาเลือกไฟล์ PDF เท่านั้น", true);
        }
      });

      // เปลี่ยนตัวเลือกให้เรนเดอร์ใหม่
      formatSelect.addEventListener("change", renderAllPages);
      scaleSelect.addEventListener("change", renderAllPages);

      cancelBtn.onclick = resetWorkspace;
      downloadAllBtn.onclick = downloadAllAsZip;
    }

    async function loadPdf(file) {
      currentFile = file;
      drop.classList.add("hidden");
      workspace.classList.remove("hidden");
      document.getElementById("pdf2imgFileName").textContent = file.name;
      updateStatus("");

      try {
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        pdfJsDoc = await loadingTask.promise;

        document.getElementById("pdf2imgPageCount").textContent = `${pdfJsDoc.numPages} หน้า`;
        await renderAllPages();
      } catch (err) {
        updateStatus(`ไม่สามารถอ่านไฟล์ PDF ได้: ${err.message}`, true);
      }
    }

    async function renderAllPages() {
      if (!pdfJsDoc) return;

      grid.innerHTML = '<p style="text-align:center; width:100%; color:#64748b;">กำลังแปลงหน้า PDF เป็นรูปภาพ...</p>';
      downloadAllBtn.disabled = true;
      renderedImages = [];

      const format = formatSelect.value;
      const scale = parseFloat(scaleSelect.value);
      const ext = format === "image/png" ? "png" : "jpg";

      grid.innerHTML = "";

      for (let pageNum = 1; pageNum <= pdfJsDoc.numPages; pageNum++) {
        try {
          const page = await pdfJsDoc.getPage(pageNum);
          const viewport = page.getViewport({ scale: scale });

          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");
          canvas.height = viewport.height;
          canvas.width = viewport.width;

          await page.render({ canvasContext: context, viewport: viewport }).promise;

          const dataUrl = canvas.toDataURL(format, 0.92);
          renderedImages.push({ pageNum, dataUrl, ext });

          // สร้าง Card สำหรับแสดง พรีวิวและปุ่มดาวน์โหลดเดี่ยว
          const card = document.createElement("div");
          card.className = "page-card";
          card.style.cssText = "display:flex; flex-direction:column; align-items:center; background:#fff; padding:10px; border-radius:10px; border:1px solid #cbd5e1;";

          const img = document.createElement("img");
          img.src = dataUrl;
          img.style.cssText = "max-width:130px; max-height:160px; object-fit:contain; border-radius:4px; box-shadow:0 2px 4px rgba(0,0,0,0.1);";

          const label = document.createElement("span");
          label.textContent = `หน้า ${pageNum}`;
          label.style.cssText = "font-size:12px; font-weight:600; color:#475569; margin:8px 0 6px;";

          const singleDlBtn = document.createElement("a");
          singleDlBtn.textContent = "⬇ ดาวน์โหลด";
          singleDlBtn.href = dataUrl;
          singleDlBtn.download = `Page_${pageNum}.${ext}`;
          singleDlBtn.className = "secondary-sm";
          singleDlBtn.style.cssText = "text-decoration:none; font-size:11px; padding:4px 8px;";

          card.appendChild(img);
          card.appendChild(label);
          card.appendChild(singleDlBtn);
          grid.appendChild(card);
        } catch (e) {
          console.error(`Error rendering page ${pageNum}:`, e);
        }
      }

      downloadAllBtn.disabled = false;
      updateStatus("แปลงรูปภาพเสร็จสิ้น! สามารถเลือกดาวน์โหลดทีละรูป หรือกดดาวน์โหลดทั้งหมดเป็น ZIP ได้ครับ", false, true);
    }

    async function downloadAllAsZip() {
      if (renderedImages.length === 0 || !window.JSZip) return;

      downloadAllBtn.disabled = true;
      updateStatus("กำลังบีบอัดไฟล์ ZIP...");

      try {
        const zip = new JSZip();
        const folder = zip.folder("Feelgood_Images");

        renderedImages.forEach((item) => {
          // ดึงส่วน base64 data
          const base64Data = item.dataUrl.split(",")[1];
          folder.file(`Page_${item.pageNum}.${item.ext}`, base64Data, { base64: true });
        });

        const content = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(content);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Feelgood_Converted_Images_${getStamp()}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 10000);

        updateStatus("ดาวน์โหลดไฟล์ ZIP เรียบร้อยแล้ว! ✓", false, true);
      } catch (err) {
        updateStatus(`เกิดข้อผิดพลาดในการสร้าง ZIP: ${err.message}`, true);
      } finally {
        downloadAllBtn.disabled = false;
      }
    }

    function resetWorkspace() {
      currentFile = null;
      pdfJsDoc = null;
      renderedImages = [];
      workspace.classList.add("hidden");
      drop.classList.remove("hidden");
      input.value = "";
      grid.innerHTML = "";
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