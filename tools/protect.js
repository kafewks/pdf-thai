// tools/protect.js - PDF Protection Engine
(function () {
  let currentFile = null;

  window.initProtectTool = function () {
    const input = document.getElementById("protectFileInput");
    const drop = document.getElementById("protectDropArea");
    const workspace = document.getElementById("protectWorkspace");
    const cancelBtn = document.getElementById("protectCancelBtn");
    const submitBtn = document.getElementById("protectSubmitBtn");
    const passInput = document.getElementById("protectPassInput");
    const passConfirmInput = document.getElementById("protectPassConfirmInput");
    const status = document.getElementById("protectStatus");

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

      cancelBtn.onclick = resetWorkspace;
      submitBtn.onclick = protectPdf;
    }

    async function loadPdf(file) {
      currentFile = file;
      drop.classList.add("hidden");
      workspace.classList.remove("hidden");
      document.getElementById("protectFileName").textContent = file.name;
      updateStatus("");

      try {
        const bytes = await file.arrayBuffer();
        const pdfDoc = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true });
        const count = pdfDoc.getPageCount();
        document.getElementById("protectPageCount").textContent = `${count} หน้า`;
      } catch (err) {
        updateStatus(`ไม่สามารถอ่านไฟล์ PDF ได้: ${err.message}`, true);
      }
    }

    async function protectPdf() {
      if (!currentFile) return;

      const password = passInput.value;
      const confirmPassword = passConfirmInput.value;

      if (!password) {
        updateStatus("กรุณากรอกรหัสผ่านที่ต้องการตั้งค่า", true);
        return;
      }

      if (password !== confirmPassword) {
        updateStatus("รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน", true);
        return;
      }

      submitBtn.disabled = true;
      updateStatus("กำลังสร้างและเข้ารหัสไฟล์ PDF...");

      try {
        const bytes = await currentFile.arrayBuffer();
        const srcPdf = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true });
        
        // สร้าง PDF เอกสารใหม่
        const newPdf = await PDFLib.PDFDocument.create();
        const indices = srcPdf.getPageIndices();
        const copiedPages = await newPdf.copyPages(srcPdf, indices);
        copiedPages.forEach((page) => newPdf.addPage(page));

        // ตรวจสอบว่ามีฟังก์ชัน encrypt หรือไม่ก่อนเรียกใช้
        if (typeof newPdf.encrypt === "function") {
          await newPdf.encrypt({
            userPassword: password,
            ownerPassword: password,
            permissions: {
              printing: "highResolution",
              modifying: false,
              copying: false,
              annotating: false
            }
          });
        } else {
          // หากเบราว์เซอร์ไม่รองรับ Native Encryption ของ PDF-Lib ให้แจ้งเตือนผู้ใช้ชัดเจน
          throw new Error("ไลบรารี PDF-Lib เวอร์ชัน CDN ปัจจุบันไม่รองรับการตั้งรหัสผ่านล็อกไฟล์บน Client-Side โดยตรง");
        }

        const protectedBytes = await newPdf.save();
        downloadBlob(protectedBytes, `Feelgood_Protected_${getStamp()}.pdf`);
        updateStatus("ล็อกไฟล์ PDF ด้วยรหัสผ่านสำเร็จเรียบร้อย! ✓", false, true);
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
      workspace.classList.add("hidden");
      drop.classList.remove("hidden");
      input.value = "";
      passInput.value = "";
      passConfirmInput.value = "";
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