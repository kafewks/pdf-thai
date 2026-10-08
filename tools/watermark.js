// tools/watermark.js - PDF Watermark Engine with Realtime Preview
(function () {
  let currentFile = null;
  let pdfJsDoc = null;
  let watermarkImageFile = null;
  let watermarkImageDataUrl = null;

  window.initWatermarkTool = function () {
    const input = document.getElementById("watermarkFileInput");
    const drop = document.getElementById("watermarkDropArea");
    const workspace = document.getElementById("watermarkWorkspace");
    const cancelBtn = document.getElementById("watermarkCancelBtn");
    const submitBtn = document.getElementById("wmSubmitBtn");
    const status = document.getElementById("wmStatus");

    const wmTypeRadios = document.querySelectorAll('input[name="wmType"]');
    const textOptions = document.getElementById("wmTextOptions");
    const imageOptions = document.getElementById("wmImageOptions");

    const textInput = document.getElementById("wmTextInput");
    const fontSizeInput = document.getElementById("wmFontSize");
    const textColorInput = document.getElementById("wmTextColor");

    const imgFileInput = document.getElementById("wmImageFileInput");
    const chooseImgBtn = document.getElementById("wmChooseImgBtn");
    const imgNameSpan = document.getElementById("wmImgName");

    const opacitySlider = document.getElementById("wmOpacity");
    const opacityValSpan = document.getElementById("wmOpacityVal");
    const rotationSlider = document.getElementById("wmRotation");
    const rotationValSpan = document.getElementById("wmRotationVal");

    if (!input || input.dataset.bound) return;
    input.dataset.bound = "true";

    drop.addEventListener("click", () => input.click());

    input.addEventListener("change", (e) => {
      if (e.target.files && e.target.files[0]) loadPdf(e.target.files[0]);
    });

    // สลับระหว่างลายน้ำข้อความ / รูปภาพ
    wmTypeRadios.forEach(r => {
      r.addEventListener("change", (e) => {
        if (e.target.value === "text") {
          textOptions.classList.remove("hidden");
          imageOptions.classList.add("hidden");
        } else {
          textOptions.classList.add("hidden");
          imageOptions.classList.remove("hidden");
        }
        renderPreview();
      });
    });

    // ปุ่มเลือกรูปโลโก้
    chooseImgBtn.onclick = () => imgFileInput.click();
    imgFileInput.addEventListener("change", (e) => {
      if (e.target.files && e.target.files[0]) {
        watermarkImageFile = e.target.files[0];
        imgNameSpan.textContent = watermarkImageFile.name;

        const reader = new FileReader();
        reader.onload = (ev) => {
          watermarkImageDataUrl = ev.target.result;
          renderPreview();
        };
        reader.readAsDataURL(watermarkImageFile);
      }
    });

    // Event อัปเดตตัวเลือกแบบ Realtime
    [textInput, fontSizeInput, textColorInput].forEach(el => el.addEventListener("input", renderPreview));

    opacitySlider.addEventListener("input", (e) => {
      opacityValSpan.textContent = `${Math.round(e.target.value * 100)}%`;
      renderPreview();
    });

    rotationSlider.addEventListener("input", (e) => {
      rotationValSpan.textContent = `${e.target.value}°`;
      renderPreview();
    });

    cancelBtn.onclick = resetWorkspace;
    submitBtn.onclick = applyWatermark;

    async function loadPdf(file) {
      currentFile = file;
      drop.classList.add("hidden");
      workspace.classList.remove("hidden");
      document.getElementById("watermarkFileName").textContent = file.name;
      updateStatus("");

      try {
        const bytes = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: bytes });
        pdfJsDoc = await loadingTask.promise;

        document.getElementById("watermarkPageCount").textContent = `${pdfJsDoc.numPages} หน้า`;
        renderPreview();
      } catch (err) {
        updateStatus(`ไม่สามารถอ่านไฟล์ PDF ได้: ${err.message}`, true);
      }
    }

    // เรนเดอร์หน้าแรกพร้อมลายน้ำแบบสดบน Canvas
    async function renderPreview() {
      if (!pdfJsDoc) return;

      const page = await pdfJsDoc.getPage(1);
      const viewport = page.getViewport({ scale: 1.0 });

      const canvas = document.getElementById("wmCanvas");
      const ctx = canvas.getContext("2d");
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({ canvasContext: ctx, viewport: viewport }).promise;

      // วาดลายน้ำทับบน Canvas สำหรับพรีวิว
      const wmType = document.querySelector('input[name="wmType"]:checked').value;
      const opacity = parseFloat(opacitySlider.value);
      const angle = (parseFloat(rotationSlider.value) * Math.PI) / 180;

      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.translate(viewport.width / 2, viewport.height / 2);
      ctx.rotate(angle);

      if (wmType === "text") {
        const text = textInput.value || "สำเนาถูกต้อง";
        const fontSize = parseInt(fontSizeInput.value, 10) || 48;
        const color = textColorInput.value || "#dc2626";

        ctx.font = `bold ${fontSize}px 'Sarabun', sans-serif`;
        ctx.fillStyle = color;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(text, 0, 0);
      } else if (wmType === "image" && watermarkImageDataUrl) {
        const img = new Image();
        img.onload = () => {
          const imgW = 200;
          const imgH = (img.height / img.width) * imgW;
          ctx.drawImage(img, -imgW / 2, -imgH / 2, imgW, imgH);
          ctx.restore();
        };
        img.src = watermarkImageDataUrl;
        return;
      }

      ctx.restore();
    }

    // ช่วยแปลงข้อความลายน้ำภาษาไทยเป็น PNG Canvas ก่อนใส่ลงใน PDF
    function textWatermarkToPng(text, fontSize, colorHex) {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const font = `bold ${fontSize * 2}px 'Sarabun', sans-serif`;
      ctx.font = font;

      const metrics = ctx.measureText(text);
      const width = metrics.width + 20;
      const height = fontSize * 3;

      canvas.width = width;
      canvas.height = height;

      ctx.font = font;
      ctx.fillStyle = colorHex;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, width / 2, height / 2);

      return {
        dataUrl: canvas.toDataURL("image/png"),
        width: width / 2,
        height: height / 2
      };
    }

    // ประมวลผลใส่ลายน้ำลงในทุกหน้า PDF
    async function applyWatermark() {
      if (!currentFile) return;

      submitBtn.disabled = true;
      updateStatus("กำลังประทับลายน้ำลงบนทุกหน้าของ PDF...");

      try {
        const bytes = await currentFile.arrayBuffer();
        const pdfDoc = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true });
        const pages = pdfDoc.getPages();

        const wmType = document.querySelector('input[name="wmType"]:checked').value;
        const opacity = parseFloat(opacitySlider.value);
        const rotationDegrees = parseFloat(rotationSlider.value);

        let embeddedImage = null;
        let imgWidth = 0, imgHeight = 0;

        if (wmType === "text") {
          const text = textInput.value || "สำเนาถูกต้อง";
          const fontSize = parseInt(fontSizeInput.value, 10) || 48;
          const color = textColorInput.value || "#dc2626";

          const textPng = textWatermarkToPng(text, fontSize, color);
          embeddedImage = await pdfDoc.embedPng(textPng.dataUrl);
          imgWidth = textPng.width;
          imgHeight = textPng.height;
        } else if (wmType === "image") {
          if (!watermarkImageFile) {
            updateStatus("กรุณาเลือกรูปภาพโลโก้ก่อนกดประทับลายน้ำ", true);
            submitBtn.disabled = false;
            return;
          }
          const imgBuffer = await watermarkImageFile.arrayBuffer();
          if (watermarkImageFile.type === "image/png") {
            embeddedImage = await pdfDoc.embedPng(imgBuffer);
          } else {
            embeddedImage = await pdfDoc.embedJpg(imgBuffer);
          }
          imgWidth = 200;
          imgHeight = (embeddedImage.height / embeddedImage.width) * imgWidth;
        }

        // ประทับลายน้ำกึ่งกลางหน้ากระดาษของทุกหน้า
        pages.forEach((page) => {
          const { width, height } = page.getSize();
          
          page.drawImage(embeddedImage, {
            x: (width - imgWidth) / 2,
            y: (height - imgHeight) / 2,
            width: imgWidth,
            height: imgHeight,
            opacity: opacity,
            rotate: PDFLib.degrees(rotationDegrees)
          });
        });

        const newPdfBytes = await pdfDoc.save();
        downloadBlob(newPdfBytes, `Feelgood_Watermarked_${getStamp()}.pdf`);
        updateStatus("ประทับลายน้ำสำเร็จเรียบร้อย! ✓", false, true);
      } catch (err) {
        updateStatus(`เกิดข้อผิดพลาดในการประทับลายน้ำ: ${err.message}`, true);
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
      pdfJsDoc = null;
      watermarkImageFile = null;
      watermarkImageDataUrl = null;
      workspace.classList.add("hidden");
      drop.classList.remove("hidden");
      input.value = "";
      imgFileInput.value = "";
      imgNameSpan.textContent = "ยังไม่ได้เลือกรูปภาพ";
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