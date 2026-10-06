// tools/split.js - PDF Split Engine
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

    if (!input) return;

    // ผูก Event บายดิ่งครั้งเดียวเพื่อป้องกันปัญหา Memory Leak หรือการทำงานซ้ำ
    if (!input.dataset.bound) {
      input.dataset.bound = "true";

      // 1. กดที่กล่อง Drop Zone เพื่อเปิดตัวเลือกไฟล์
      drop.addEventListener("click", () => input.click());

      // 2. เมื่อเลือกไฟล์ผ่าน File Dialog
      input.addEventListener("change", (e) => {
        if (e.target.files && e.target.files[0]) {
          loadPdf(e.target.files[0]);
        }
      });

      // 3. ป้องกัน Default Event และจัดการ Drag Over / Drop
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

      // 4. สลับโหมดการแยกหน้า (Range / All)
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

    // ฟังก์ชันอ่านไฟล์ PDF ด้วย PDF-Lib
    async function loadPdf(file) {
      currentFile = file;
      drop.classList.add("hidden");
      workspace.classList.remove("hidden");
      document.getElementById("splitFileName").textContent = file.name;
      updateStatus("");

      try {
        const bytes = await file.arrayBuffer();
        const pdfDoc = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true });
        totalPagesCount = pdfDoc.getPageCount();

        document.getElementById("splitPageCount").textContent = `${totalPagesCount} หน้า`;
        document.getElementById("splitPagesInput").placeholder = `เช่น 1-${totalPagesCount}`;
      } catch (err) {
        updateStatus(`ไม่สามารถอ่านไฟล์ PDF ได้: ${err.message}`, true);
      }
    }

    // ฟังก์ชันคำนวณช่วงหน้า เช่น "1-3, 5, 8-10" -> [0, 1, 2, 4, 7, 8, 9]
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

    // ประมวลผลการแยก PDF
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
          // โหมดแยกทุกหน้าเป็นไฟล์เดี่ยว
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