// tools/merge.js - PDF Merge Engine with Page Preview
(function () {
  let selectedFiles = [];

  window.initMergeTool = function () {
    const input = document.getElementById("mergeFileInput");
    const drop = document.getElementById("mergeDropArea");
    const fileList = document.getElementById("mergeFileList");
    const submitBtn = document.getElementById("mergeSubmitBtn");
    const clearBtn = document.getElementById("mergeClearBtn");
    const status = document.getElementById("mergeStatus");

    if (!input) return;

    if (!input.dataset.bound) {
      input.dataset.bound = "true";

      input.addEventListener("change", (e) => {
        if (e.target.files && e.target.files.length > 0) {
          addFiles(Array.from(e.target.files));
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

        const validFiles = Array.from(e.dataTransfer.files).filter(
          (f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")
        );
        if (validFiles.length > 0) {
          addFiles(validFiles);
        } else {
          updateStatus("กรุณาเลือกไฟล์ PDF เท่านั้น", true);
        }
      });

      clearBtn.onclick = () => {
        selectedFiles = [];
        input.value = "";
        renderList();
        updateStatus("");
      };

      submitBtn.onclick = executeMerge;
    }

    function addFiles(files) {
      selectedFiles.push(...files);
      renderList();
      updateStatus("");
    }

    async function renderList() {
      if (selectedFiles.length === 0) {
        fileList.classList.add("hidden");
        fileList.innerHTML = "";
        clearBtn.classList.add("hidden");
        submitBtn.disabled = true;
        return;
      }

      fileList.classList.remove("hidden");
      clearBtn.classList.remove("hidden");
      submitBtn.disabled = false;
      fileList.innerHTML = "";

      // สร้าง Item รายการไฟล์
      for (let index = 0; index < selectedFiles.length; index++) {
        const file = selectedFiles[index];
        const item = document.createElement("div");
        item.className = "merge-item";
        item.style.cssText = "background: #fff; border: 1px solid #cbd5e1; border-radius: 12px; padding: 12px; margin-bottom: 12px;";

        const itemHeader = document.createElement("div");
        itemHeader.style.cssText = "display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;";
        itemHeader.innerHTML = `
          <div style="font-weight: 600; color: #1e293b;">
            📄 ${index + 1}. ${file.name}
            <span id="pageCount_${index}" style="font-size: 12px; color: #64748b; margin-left: 8px;">(กำลังคำนวณหน้า...)</span>
          </div>
        `;

        const removeBtn = document.createElement("button");
        removeBtn.textContent = "✕ ลบ";
        removeBtn.className = "secondary-sm";
        removeBtn.style.cssText = "color: #dc2626; border-color: #fca5a5; padding: 2px 8px; font-size: 12px; cursor: pointer;";
        removeBtn.onclick = () => {
          selectedFiles.splice(index, 1);
          renderList();
        };

        itemHeader.appendChild(removeBtn);
        item.appendChild(itemHeader);

        // คอนเทนเนอร์แสดง Grid ตัวอย่างหน้ากระดาษ
        const pageGrid = document.createElement("div");
        pageGrid.className = "merge-page-grid";
        pageGrid.style.cssText = "display: flex; gap: 8px; overflow-x: auto; padding: 8px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; min-height: 80px; align-items: center;";
        pageGrid.innerHTML = '<span style="font-size: 12px; color: #94a3b8;">กำลังโหลดตัวอย่างหน้าเอกสาร...</span>';

        item.appendChild(pageGrid);
        fileList.appendChild(item);

        // โหลดข้อมูลไฟล์และแสดง Thumbnail ตัวอย่าง
        loadAndRenderPreviews(file, index, pageGrid);
      }
    }

    async function loadAndRenderPreviews(file, index, gridElement) {
      try {
        const bytes = await file.arrayBuffer();

        // 1. อ่านจำนวนหน้าด้วย PDF-Lib
        const pdfDoc = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true });
        const count = pdfDoc.getPageCount();
        const pageCountEl = document.getElementById(`pageCount_${index}`);
        if (pageCountEl) pageCountEl.textContent = `(${count} หน้า)`;

        // 2. Render ตัวอย่างแต่ละหน้าด้วย PDF.js
        if (window.pdfjsLib) {
          const loadingTask = pdfjsLib.getDocument({ data: bytes });
          const pdfJsDoc = await loadingTask.promise;
          gridElement.innerHTML = "";

          for (let pageNum = 1; pageNum <= count; pageNum++) {
            const page = await pdfJsDoc.getPage(pageNum);
            const viewport = page.getViewport({ scale: 0.2 }); // สเกลขนาด Thumbnail ย่อเล็กพอเหมาะ

            const pageCard = document.createElement("div");
            pageCard.style.cssText = "display: flex; flex-direction: column; align-items: center; background: #fff; padding: 4px; border-radius: 6px; border: 1px solid #cbd5e1; flex-shrink: 0;";

            const canvas = document.createElement("canvas");
            const context = canvas.getContext("2d");
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            await page.render({ canvasContext: context, viewport: viewport }).promise;

            const label = document.createElement("span");
            label.textContent = `หน้า ${pageNum}`;
            label.style.cssText = "font-size: 10px; color: #64748b; margin-top: 4px;";

            pageCard.appendChild(canvas);
            pageCard.appendChild(label);
            gridElement.appendChild(pageCard);
          }
        } else {
          gridElement.innerHTML = '<span style="font-size: 12px; color: #94a3b8;">ไม่รองรับการแสดงพรีวิว</span>';
        }
      } catch (err) {
        gridElement.innerHTML = `<span style="font-size: 12px; color: #dc2626;">ไม่สามารถอ่านไฟล์ได้: ${err.message}</span>`;
      }
    }

    async function executeMerge() {
      if (selectedFiles.length === 0) return;

      submitBtn.disabled = true;
      updateStatus("กำลังรวมไฟล์ PDF...");

      try {
        const mergedPdf = await PDFLib.PDFDocument.create();

        for (const file of selectedFiles) {
          const bytes = await file.arrayBuffer();
          const pdf = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true });
          const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
          copiedPages.forEach((p) => mergedPdf.addPage(p));
        }

        const mergedBytes = await mergedPdf.save();
        downloadBlob(mergedBytes, `Feelgood_Merged_${getStamp()}.pdf`);
        updateStatus("รวมไฟล์ PDF เรียบร้อยแล้ว! ✓", false, true);
      } catch (err) {
        updateStatus(`เกิดข้อผิดพลาดในการรวมไฟล์: ${err.message}`, true);
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