// tools/split.js - PDF Split Engine with Page Preview
(function () {
  let currentFile = null;
  let totalPagesCount = 0;

  window.initSplitTool = function () {
    const input = document.getElementById("splitFileInput");
    const drop = document.getElementById("splitDropArea");
    const workspace = document.getElementById("splitWorkspace");
    const submitBtn = document.getElementById("splitSubmitBtn");
    const cancelBtn = document.getElementById("splitCancelBtn");
    const status = document.getElementById("splitStatus");
    const rangeBox = document.getElementById("splitRangeBox");
    const modeRadios = document.querySelectorAll('input[name="splitMode"]');
    const pageGrid = document.getElementById("splitPageGrid");

    if (!input) return;

    if (!input.dataset.bound) {
      input.dataset.bound = "true";

      // 1. แก้ไขปัญหาเปิดเลือกไฟล์ซ้ำ 2 รอบ (สั่งคลิกจุดเดียวจาก Drop Area)
      drop.addEventListener("click", (e) => {
        e.preventDefault();
        input.click();
      });

      // 2. เลือกไฟล์ผ่าน File Dialog
      input.addEventListener("change", (e) => {
        if (e.target.files && e.target.files[0]) {
          loadPdf(e.target.files[0]);
        }
      });

      // 3. รองรับ Drag & Drop
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

      // 4. สลับโหมดแยกหน้า
      modeRadios.forEach((r) => {
        r.addEventListener("change", (e) => {
          if (e.target.value === "all") {
            rangeBox.classList.add("hidden");
          } else {
            rangeBox.classList.remove("hidden");
          }
        });
      });

      cancelBtn.onclick = resetWorkspace;
      submitBtn.onclick = executeSplit;
    }

    // โหลด PDF และเรนเดอร์ตัวอย่างหน้ากระดาษ (Preview)
    async function loadPdf(file) {
      currentFile = file;
      drop.classList.add("hidden");
      workspace.classList.remove("hidden");
      document.getElementById("splitFileName").textContent = file.name;
      pageGrid.innerHTML = '<p style="text-align:center; width:100%; color:#64748b;">กำลังโหลดตัวอย่างหน้าเอกสาร...</p>';
      updateStatus("");

      try {
        const bytes = await file.arrayBuffer();

        // 1. ใช้ PDF-Lib เพื่ออ่านโครงสร้างไฟล์หลัก
        const pdfDoc = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true });
        totalPagesCount = pdfDoc.getPageCount();

        document.getElementById("splitPageCount").textContent = `${totalPagesCount} หน้า`;
        document.getElementById("splitPagesInput").placeholder = `เช่น 1-${totalPagesCount}`;

        // 2. ใช้ PDF.js เพื่อ Render ตัวอย่างรูปภาพแต่ละหน้า (Preview Only)
        if (window.pdfjsLib) {
          const loadingTask = pdfjsLib.getDocument({ data: bytes });
          const pdfJsDoc = await loadingTask.promise;
          pageGrid.innerHTML = ""; // ล้าง Loading

          for (let pageNum = 1; pageNum <= totalPagesCount; pageNum++) {
            renderPagePreview(pdfJsDoc, pageNum);
          }
        } else {
          pageGrid.innerHTML = '<p style="color:#64748b; text-align:center;">ไม่สามารถแสดงพรีวิวได้ แต่ยังสามารถแยกหน้าได้ตามปกติ</p>';
        }
      } catch (err) {
        updateStatus(`ไม่สามารถอ่านไฟล์ PDF ได้: ${err.message}`, true);
      }
    }

    // ฟังก์ชันสร้าง Canvas เรนเดอร์รูปภาพของแต่ละหน้า PDF
    async function renderPagePreview(pdfJsDoc, pageNum) {
      try {
        const page = await pdfJsDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale: 0.3 }); // ย่อสเกลสำหรับ Preview

        const pageCard = document.createElement("div");
        pageCard.className = "page-card";
        pageCard.style.cssText = "display:flex; flex-direction:column; align-items:center; background:#fff; padding:8px; border-radius:8px; border:1px solid #cbd5e1;";

        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: context,
          viewport: viewport
        };

        const pageLabel = document.createElement("span");
        pageLabel.className = "page-num";
        pageLabel.textContent = `หน้า ${pageNum}`;
        pageLabel.style.cssText = "font-size:12px; font-weight:600; color:#475569; margin-top:6px;";

        pageCard.appendChild(canvas);
        pageCard.appendChild(pageLabel);
        pageGrid.appendChild(pageCard);

        await page.render(renderContext).promise;
      } catch (e) {
        console.error("Error rendering page preview:", e);
      }
    }

    function parsePageRange(rangeStr, maxPages) {
      const pages = new Set();
      const parts = rangeStr.split(",");

      for (let part of parts) {
        part = part.trim();
        if (part.includes("-")) {
          const [start, end] = part.split("-").map((n) => parseInt(n.trim(), 10));
          if (!isNaN(start) && !isNaN(end)) {
            for (let i = Math.max(1, start); i <= Math.min(maxPages, end); i++) {
              pages.add(i - 1);
            }
          }
        } else {
          const pageNum = parseInt(part, 10);
          if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= maxPages) {
            pages.add(pageNum - 1);
          }
        }
      }
      return Array.from(pages).sort((a, b) => a - b);
    }

    async function executeSplit() {
      if (!currentFile) return;

      const mode = document.querySelector('input[name="splitMode"]:checked').value;
      submitBtn.disabled = true;
      updateStatus("กำลังแยกหน้า PDF...");

      try {
        const bytes = await currentFile.arrayBuffer();
        const srcPdf = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true });

        if (mode === "range") {
          const rangeVal = document.getElementById("splitPagesInput").value.trim() || `1-${totalPagesCount}`;
          const pageIndices = parsePageRange(rangeVal, totalPagesCount);

          if (pageIndices.length === 0) {
            updateStatus("กรุณาระบุช่วงหน้าให้ถูกต้อง (เช่น 1-3)", true);
            submitBtn.disabled = false;
            return;
          }

          const newPdf = await PDFLib.PDFDocument.create();
          const copiedPages = await newPdf.copyPages(srcPdf, pageIndices);
          copiedPages.forEach((p) => newPdf.addPage(p));

          const newBytes = await newPdf.save();
          downloadBlob(newBytes, `Feelgood_Split_${getStamp()}.pdf`);
          updateStatus("แยกหน้า PDF สำเร็จเรียบร้อย! ✓", false, true);
        } else {
          for (let i = 0; i < totalPagesCount; i++) {
            const newPdf = await PDFLib.PDFDocument.create();
            const [copiedPage] = await newPdf.copyPages(srcPdf, [i]);
            newPdf.addPage(copiedPage);

            const newBytes = await newPdf.save();
            downloadBlob(newBytes, `Feelgood_Page_${i + 1}_${getStamp()}.pdf`);
          }
          updateStatus(`แยกไฟล์เรียบร้อยทั้งหมด ${totalPagesCount} หน้า! ✓`, false, true);
        }
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

    function resetWorkspace() {
      currentFile = null;
      totalPagesCount = 0;
      workspace.classList.add("hidden");
      drop.classList.remove("hidden");
      input.value = "";
      document.getElementById("splitPagesInput").value = "";
      pageGrid.innerHTML = "";
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