// tools/rotate.js - PDF Rotate & Delete Engine
(function() {
  let currentFile = null;
  let pageStates = []; // เก็บสถานะ { rotation: 0|90|180|270, deleted: boolean }

  window.initRotateTool = function() {
    const input = document.getElementById("rotateFileInput");
    const drop = document.getElementById("rotateDropArea");
    const workspace = document.getElementById("rotateWorkspace");
    const pageGrid = document.getElementById("rotatePageGrid");
    const saveBtn = document.getElementById("rotateSaveBtn");
    const cancelBtn = document.getElementById("rotateCancelBtn");
    const status = document.getElementById("rotateStatus");

    if (!input || input.dataset.bound) return;
    input.dataset.bound = "true";

    input.addEventListener("change", e => {
      if (e.target.files[0]) loadPdfFile(e.target.files[0]);
    });

    drop.addEventListener("drop", e => {
      const f = e.dataTransfer.files[0];
      if (f && (f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"))) {
        loadPdfFile(f);
      }
    });

    document.getElementById("rotateAllCwBtn").onclick = () => rotateAll(90);
    document.getElementById("rotateAllCcwBtn").onclick = () => rotateAll(-90);
    document.getElementById("rotateResetBtn").onclick = resetAll;
    cancelBtn.onclick = resetWorkspace;
    saveBtn.onclick = executeSave;

    async function loadPdfFile(file) {
      currentFile = file;
      drop.classList.add("hidden");
      workspace.classList.remove("hidden");
      pageGrid.innerHTML = "กำลังโหลดภาพตัวอย่าง...";
      showStatus(status, "");

      document.getElementById("rotateFileName").textContent = file.name;

      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const totalPages = pdfDoc.numPages;

        document.getElementById("rotatePageCount").textContent = `${totalPages} หน้า`;
        pageStates = Array.from({ length: totalPages }, () => ({ rotation: 0, deleted: false }));

        pageGrid.innerHTML = "";

        for (let i = 1; i <= totalPages; i++) {
          const pageCard = document.createElement("div");
          pageCard.className = "page-card";
          pageCard.dataset.pageIndex = i - 1;

          pageCard.innerHTML = `
            <canvas id="pdf-canvas-${i}"></canvas>
            <div class="page-num">หน้า ${i}</div>
            <div class="page-card-controls">
              <button class="btn-icon" title="หมุนซ้าย" data-act="ccw">↺</button>
              <button class="btn-icon" title="หมุนขวา" data-act="cw">↻</button>
              <button class="btn-icon delete-btn" title="ลบหน้านี้" data-act="del">🗑️</button>
            </div>
          `;

          // Button Events
          pageCard.querySelector('[data-act="ccw"]').onclick = () => rotatePage(i - 1, -90);
          pageCard.querySelector('[data-act="cw"]').onclick = () => rotatePage(i - 1, 90);
          pageCard.querySelector('[data-act="del"]').onclick = () => toggleDeletePage(i - 1);

          pageGrid.appendChild(pageCard);

          // Render Page Canvas
          const page = await pdfDoc.getPage(i);
          const viewport = page.getViewport({ scale: 0.3 });
          const canvas = pageCard.querySelector("canvas");
          const context = canvas.getContext("2d");
          canvas.height = viewport.height;
          canvas.width = viewport.width;

          await page.render({ canvasContext: context, viewport }).promise;
        }
      } catch (err) {
        showStatus(status, `ไม่สามารถอ่านไฟล์ได้: ${err.message}`, true);
      }
    }

    function rotatePage(index, deg) {
      pageStates[index].rotation = (pageStates[index].rotation + deg + 360) % 360;
      updateCardUI(index);
    }

    function toggleDeletePage(index) {
      pageStates[index].deleted = !pageStates[index].deleted;
      updateCardUI(index);
    }

    function rotateAll(deg) {
      pageStates.forEach((state, i) => {
        state.rotation = (state.rotation + deg + 360) % 360;
        updateCardUI(i);
      });
    }

    function resetAll() {
      pageStates.forEach((state, i) => {
        state.rotation = 0;
        state.deleted = false;
        updateCardUI(i);
      });
    }

    function updateCardUI(index) {
      const card = pageGrid.querySelector(`[data-page-index="${index}"]`);
      if (!card) return;

      const canvas = card.querySelector("canvas");
      const state = pageStates[index];

      canvas.style.transform = `rotate(${state.rotation}deg)`;
      card.classList.toggle("deleted", state.deleted);
    }

    function resetWorkspace() {
      currentFile = null;
      pageStates = [];
      workspace.classList.add("hidden");
      drop.classList.remove("hidden");
      input.value = "";
      showStatus(status, "");
    }

    async function executeSave() {
      if (!currentFile) return;

      const validPages = pageStates.filter(s => !s.deleted);
      if (validPages.length === 0) {
        showStatus(status, "ไม่สามารถบันทึกได้ เนื่องจากคุณลบออกทุกหน้า", true);
        return;
      }

      saveBtn.disabled = true;
      showStatus(status, "กำลังประมวลผล PDF ใหม่...");

      try {
        const bytes = await currentFile.arrayBuffer();
        const srcPdf = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true });
        const newPdf = await PDFLib.PDFDocument.create();

        for (let i = 0; i < pageStates.length; i++) {
          if (pageStates[i].deleted) continue;

          const [copiedPage] = await newPdf.copyPages(srcPdf, [i]);
          
          // กำหนดมุมหมุนเพิ่มเติม
          const currentRotation = copiedPage.getRotation().angle;
          copiedPage.setRotation(PDFLib.degrees(currentRotation + pageStates[i].rotation));
          
          newPdf.addPage(copiedPage);
        }

        const newBytes = await newPdf.save();
        const blob = new Blob([newBytes], { type: "application/pdf" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `Feelgood_Rotated_${dateStamp()}.pdf`;
        a.click();

        showStatus(status, "บันทึกไฟล์สำเร็จเรียบร้อย! ✓", false, true);
      } catch (err) {
        showStatus(status, `เกิดข้อผิดพลาด: ${err.message}`, true);
      } finally {
        saveBtn.disabled = false;
      }
    }
  };
})();