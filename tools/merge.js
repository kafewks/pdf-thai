// tools/merge.js - PDF Merge Engine with Reorder & Page Preview
(function () {
  let selectedFiles = [];
  let dragSrcIndex = null;

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

      // แสดงคำแนะนำการสลับลำดับ
      const hint = document.createElement("p");
      hint.style.cssText = "font-size: 13px; color: #64748b; margin-bottom: 12px;";
      hint.textContent = "💡 ทิป: คุณสามารถคลิกค้างแล้วลากการ์ดเพื่อจัดเรียงลำดับไฟล์ก่อนรวมได้";
      fileList.appendChild(hint);

      // สร้าง Item รายการไฟล์แบบลากสลับลำดับได้ (Draggable)
      for (let index = 0; index < selectedFiles.length; index++) {
        const file = selectedFiles[index];
        const item = document.createElement("div");
        item.className = "merge-item";
        item.draggable = true;
        item.dataset.index = index;
        item.style.cssText = "background: #fff; border: 2px dashed #cbd5e1; border-radius: 12px; padding: 12px; margin-bottom: 12px; cursor: grab; transition: background 0.2s, border-color 0.2s;";

        // Event สำหรับ Drag and Drop จัดลำดับไฟล์
        item.addEventListener("dragstart", (e) => {
          dragSrcIndex = index;
          e.dataTransfer.effectAllowed = "move";
          item.style.opacity = "0.5";
        });

        item.addEventListener("dragend", () => {
          item.style.opacity = "1";
          document.querySelectorAll(".merge-item").forEach((el) => {
            el.style.borderColor = "#cbd5e1";
            el.style.background = "#fff";
          });
        });

        item.addEventListener("dragover", (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          item.style.borderColor = "#3b82f6";
          item.style.background = "#eff6ff";
        });

        item.addEventListener("dragleave", () => {
          item.style.borderColor = "#cbd5e1";
          item.style.background = "#fff";
        });

        item.addEventListener("drop", (e) => {
          e.preventDefault();
          e.stopPropagation();
          const targetIndex = parseInt(item.dataset.index, 10);
          if (dragSrcIndex !== null && dragSrcIndex !== targetIndex) {
            // สลับตำแหน่งไฟล์ใน Array
            const movedItem = selectedFiles.splice(dragSrcIndex, 1)[0];
            selectedFiles.splice(targetIndex, 0, movedItem);
            renderList();
          }
        });

        const itemHeader = document.createElement("div");
        itemHeader.style.cssText = "display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;";
        itemHeader.innerHTML = `
          <div style="font-weight: 600; color: #1e293b; pointer-events: none;">
            ⋮⋮ 📄 ${index + 1}. ${file.name}
            <span id="pageCount_${index}" style="font-size: 12px; color: #64748b; margin-left: 8px;">(กำลังโหลด...)</span>
          </div>
        `;

        const removeBtn = document.createElement("button");
        removeBtn.textContent = "✕ ลบ";
        removeBtn.className = "secondary-sm";
        removeBtn.style.cssText = "color: #dc2626; border-color: #fca5a5; padding: 2px 8px; font-size: 12px; cursor: pointer;";
        removeBtn.onclick = (e) => {
          e.stopPropagation();
          selectedFiles.splice(index, 1);
          renderList();
        };

        itemHeader.appendChild(removeBtn);
        item.appendChild(itemHeader);

        // คอนเทนเนอร์แสดง Grid ตัวอย่างหน้ากระดาษ
        const pageGrid = document.createElement("div");
        pageGrid.className = "merge-page-grid";
        pageGrid.style.cssText = "display: flex; gap: 8px; overflow-x: auto; padding: 8px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; min-height: 80px; align-items: center; pointer-events: none;";
        pageGrid.innerHTML = '<span style="font-size: 12px; color: #94a3b8;">กำลังโหลดตัวอย่าง...</span>';

        item.appendChild(pageGrid);
        fileList.appendChild(item);

        // โหลดข้อมูลและแสดง Thumbnail
        loadAndRenderPreviews(file, index, pageGrid);
      }
    }

    async function loadAndRenderPreviews(file, index, gridElement) {
      try {
        const bytes = await file.arrayBuffer();

        const pdfDoc = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true });
        const count = pdfDoc.getPageCount();
        const pageCountEl = document.getElementById(`pageCount_${index}`);
        if (pageCountEl) pageCountEl.textContent = `(${count} หน้า)`;

        if (window.pdfjsLib) {
          const loadingTask = pdfjsLib.getDocument({ data: bytes });
          const pdfJsDoc = await loadingTask.promise;
          gridElement.innerHTML = "";

          for (let pageNum = 1; pageNum <= count; pageNum++) {
            const page = await pdfJsDoc.getPage(pageNum);
            const viewport = page.getViewport({ scale: 0.2 });

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
          gridElement.innerHTML = '<span style="font-size: 12px; color: #94a3b8;">ไม่รองรับพรีวิว</span>';
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