// tools/merge.js - PDF Merge Engine
(function() {
  let files = [];

  window.initMergeTool = function() {
    const input = document.getElementById("mergeFileInput");
    const drop = document.getElementById("mergeDropArea");
    const list = document.getElementById("mergeFileList");
    const mergeBtn = document.getElementById("mergeSubmitBtn");
    const clearBtn = document.getElementById("mergeClearBtn");

    if (!input || input.dataset.bound) return;
    input.dataset.bound = "true";

    // 1. รับไฟล์จาก File Input
    input.addEventListener("change", () => {
      addFiles([...input.files]);
      input.value = "";
    });

    // 2. Drag & Drop สไตล์พื้นที่รับไฟล์ (Dropzone)
    ["dragenter", "dragover"].forEach(ev => drop.addEventListener(ev, e => { 
      e.preventDefault(); 
      drop.classList.add("over"); 
    }));
    ["dragleave", "drop"].forEach(ev => drop.addEventListener(ev, e => { 
      e.preventDefault(); 
      drop.classList.remove("over"); 
    }));

    drop.addEventListener("drop", e => {
      const dropped = [...e.dataTransfer.files].filter(f => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"));
      if (dropped.length) addFiles(dropped);
    });

    clearBtn.onclick = () => { 
      files = []; 
      render(); 
      showStatus(document.getElementById("mergeStatus"), "");
    };

    mergeBtn.onclick = executeMerge;

    function addFiles(newFiles) {
      files.push(...newFiles);
      render();
    }

    // 3. Render รายการไฟล์ พร้อม Drag & Drop จัดเรียงลำดับ
    function render() {
      list.innerHTML = "";
      const hasFiles = files.length > 0;
      list.classList.toggle("hidden", !hasFiles);
      clearBtn.classList.toggle("hidden", !hasFiles);
      mergeBtn.disabled = files.length < 2;

      files.forEach((f, i) => {
        const row = document.createElement("div");
        row.className = "item";
        row.draggable = true; // เปิดใช้งานการลากสลับลำดับ
        row.dataset.index = i;

        // คำนวณขนาดไฟล์ให้อ่านง่าย (KB/MB)
        const sizeFormatted = f.size > 1024 * 1024 
          ? (f.size / (1024 * 1024)).toFixed(2) + " MB" 
          : (f.size / 1024).toFixed(1) + " KB";

        row.innerHTML = `
          <div class="file-details">
            <span class="handle" style="cursor: grab; color: #9aa5b5; font-size: 18px;">☰</span>
            <span class="file-name" title="${f.name}">${i + 1}. ${f.name}</span>
            <span class="file-size">(${sizeFormatted})</span>
          </div>
          <button type="button" class="btn-remove" title="ลบไฟล์นี้">×</button>
        `;

        // ปุ่มลบไฟล์ออกจากรายการ
        row.querySelector(".btn-remove").onclick = (e) => {
          e.stopPropagation();
          files.splice(i, 1);
          render();
        };

        // Event Listeners สำหรับการลากสลับลำดับ (Drag & Drop Reorder)
        row.addEventListener("dragstart", e => {
          e.dataTransfer.setData("text/plain", i);
          row.classList.add("dragging");
        });

        row.addEventListener("dragend", () => row.classList.remove("dragging"));

        row.addEventListener("dragover", e => {
          e.preventDefault();
          row.style.borderTop = "2px solid #356ae6";
        });

        row.addEventListener("dragleave", () => {
          row.style.borderTop = "";
        });

        row.addEventListener("drop", e => {
          e.preventDefault();
          row.style.borderTop = "";
          const fromIndex = parseInt(e.dataTransfer.getData("text/plain"), 10);
          const toIndex = i;

          if (fromIndex !== toIndex && !isNaN(fromIndex)) {
            // สลับตำแหน่งไฟล์ใน array
            const movedItem = files.splice(fromIndex, 1)[0];
            files.splice(toIndex, 0, movedItem);
            render();
          }
        });

        list.appendChild(row);
      });
    }

    // 4. การประมวลผล รวมไฟล์ PDF ด้วย pdf-lib
    async function executeMerge() {
      const status = document.getElementById("mergeStatus");
      mergeBtn.disabled = true;
      showStatus(status, "กำลังเริ่มรวมไฟล์ PDF…");

      try {
        const out = await PDFLib.PDFDocument.create();

        for (let i = 0; i < files.length; i++) {
          showStatus(status, `กำลังรวมไฟล์ที่ ${i + 1} จาก ${files.length} (${files[i].name})…`);
          
          const bytes = await files[i].arrayBuffer();
          // ignoreEncryption เพื่อข้าม PDF ที่ล็อกสิทธิ์ย่อยแต่เปิดอ่านได้
          const src = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true });
          const pages = await out.copyPages(src, src.getPageIndices());
          
          pages.forEach(p => out.addPage(p));
        }

        showStatus(status, "กำลังสร้างไฟล์ PDF ใหม่…");
        const pdfBytes = await out.save();
        const blob = new Blob([pdfBytes], { type: "application/pdf" });
        
        // ดาวน์โหลดไฟล์อัตโนมัติ
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = `Feelgood_Merged_${dateStamp()}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        // คืน RAM
        setTimeout(() => URL.revokeObjectURL(downloadUrl), 10000);

        showStatus(status, "รวมไฟล์ PDF เรียบร้อยแล้ว! ดาวน์โหลดสำเร็จ ✓", false, true);
      } catch (err) {
        console.error(err);
        showStatus(status, `เกิดข้อผิดพลาด: ${err.message || "ไม่สามารถอ่านไฟล์ PDF ได้"}`, true);
      } finally {
        mergeBtn.disabled = files.length < 2;
      }
    }
  };
})();