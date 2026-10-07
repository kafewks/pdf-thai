// tools/protect.js - PDF Protection Engine (Powered by jsPDF)
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
      updateStatus("กำลังใส่รหัสผ่านและเข้ารหัสไฟล์ PDF...");

      try {
        const arrayBuffer = await currentFile.arrayBuffer();
        
        // 1. อ่านหน้าไฟล์ PDF ด้วย PDF.js
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdfJsDoc = await loadingTask.promise;
        const totalPages = pdfJsDoc.numPages;

        const { jsPDF } = window.jspdf;
        let doc = null;

        // 2. วนลูปสร้าง PDF ใหม่ทีละหน้าพร้อมตั้งค่า Encryption
        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
          const page = await pdfJsDoc.getPage(pageNum);
          const viewport = page.getViewport({ scale: 2.0 });

          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");
          canvas.height = viewport.height;
          canvas.width = viewport.width;

          await page.render({ canvasContext: context, viewport: viewport }).promise;
          const imgData = canvas.toDataURL("image/jpeg", 0.95);

          const orientation = viewport.width > viewport.height ? "l" : "p";
          
          if (pageNum === 1) {
            doc = new jsPDF({
              orientation: orientation,
              unit: "px",
              format: [viewport.width, viewport.height],
              encryption: {
                userPassword: password,
                ownerPassword: password,
                userPermissions: ["print", "modify", "copy", "annot-forms"]
              }
            });
            doc.addImage(imgData, "JPEG", 0, 0, viewport.width, viewport.height);
          } else {
            doc.addPage([viewport.width, viewport.height], orientation);
            doc.addImage(imgData, "JPEG", 0, 0, viewport.width, viewport.height);
          }
        }

        // 3. บันทึกและดาวน์โหลดไฟล์ที่ล็อกรหัสผ่านแล้ว
        const pdfBlob = doc.output("blob");
        const url = URL.createObjectURL(pdfBlob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Feelgood_Protected_${getStamp()}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 10000);

        updateStatus("ล็อกไฟล์ PDF ด้วยรหัสผ่านสำเร็จเรียบร้อย! ✓", false, true);
      } catch (err) {
        updateStatus(`เกิดข้อผิดพลาดในการใส่รหัสผ่าน: ${err.message}`, true);
      } finally {
        submitBtn.disabled = false;
      }
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