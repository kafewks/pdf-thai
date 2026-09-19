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

    input.addEventListener("change", () => {
      addFiles([...input.files]);
      input.value = "";
    });

    ["dragenter", "dragover"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add("over"); }));
    ["dragleave", "drop"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove("over"); }));

    drop.addEventListener("drop", e => {
      const dropped = [...e.dataTransfer.files].filter(f => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"));
      if (dropped.length) addFiles(dropped);
    });

    clearBtn.onclick = () => { files = []; render(); };
    mergeBtn.onclick = executeMerge;

    function addFiles(newFiles) {
      files.push(...newFiles);
      render();
    }

    function render() {
      list.innerHTML = "";
      const hasFiles = files.length > 0;
      list.classList.toggle("hidden", !hasFiles);
      clearBtn.classList.toggle("hidden", !hasFiles);
      mergeBtn.disabled = files.length < 2;

      files.forEach((f, i) => {
        const row = document.createElement("div");
        row.className = "item";
        row.innerHTML = `
          <span class="handle">☰</span>
          <span class="fname">${f.name}</span>
          <button type="button" class="remove">×</button>
        `;
        row.querySelector(".remove").onclick = () => { files.splice(i, 1); render(); };
        list.appendChild(row);
      });
    }

    async function executeMerge() {
      const status = document.getElementById("mergeStatus");
      mergeBtn.disabled = true;
      showStatus(status, "กำลังรวม PDF…");

      try {
        const out = await PDFLib.PDFDocument.create();
        for (let i = 0; i < files.length; i++) {
          showStatus(status, `กำลังรวมไฟล์ที่ ${i + 1}/${files.length}…`);
          const bytes = await files[i].arrayBuffer();
          const src = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true });
          const pages = await out.copyPages(src, src.getPageIndices());
          pages.forEach(p => out.addPage(p));
        }

        const pdfBytes = await out.save();
        const blob = new Blob([pdfBytes], { type: "application/pdf" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `Feelgood_Merged_${dateStamp()}.pdf`;
        a.click();
        showStatus(status, "รวม PDF สำเร็จ! ✓", false, true);
      } catch (err) {
        showStatus(status, `เกิดข้อผิดพลาด: ${err.message}`, true);
      } finally {
        mergeBtn.disabled = files.length < 2;
      }
    }
  };
})();