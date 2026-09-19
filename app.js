// 1. Selector Elements (ใช้ Optional Chaining หรือ Guard เพื่อป้องกัน Null Pointer)
const input = document.getElementById("fileInput");
const drop = document.getElementById("dropArea") || document.getElementById("drop");
const list = document.getElementById("fileList") || document.getElementById("list");
const mergeBtn = document.getElementById("mergeBtn");
const clearBtn = document.getElementById("clearBtn");
const statusEl = document.getElementById("status");

let files = [];

// 2. ป้องกันการเปิดไฟล์ PDF ในเบราว์เซอร์โดยตรงเมื่อดรอปนอกกรอบ
["dragover", "drop"].forEach(eventName => {
  window.addEventListener(eventName, e => e.preventDefault(), false);
});

// 3. Handle File Input Selection
if (input) {
  input.addEventListener("change", () => {
    addFiles([...input.files]);
    input.value = ""; // เคลียร์ค่าเพื่อให้เลือกไฟล์เดิมซ้ำได้ถ้ากดลบไป
  });
}

// 4. Handle Drag and Drop Zone
if (drop) {
  ["dragenter", "dragover"].forEach(ev => {
    drop.addEventListener(ev, e => {
      e.preventDefault();
      drop.classList.add("over");
    });
  });

  ["dragleave", "drop"].forEach(ev => {
    drop.addEventListener(ev, e => {
      e.preventDefault();
      drop.classList.remove("over");
    });
  });

  drop.addEventListener("drop", e => {
    const droppedFiles = [...e.dataTransfer.files].filter(
      f => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")
    );
    if (droppedFiles.length > 0) {
      addFiles(droppedFiles);
    } else {
      showStatus("กรุณาเลือกเฉพาะไฟล์ PDF เท่านั้น", true);
    }
  });
}

function addFiles(newFiles) {
  files.push(...newFiles);
  render();
  showStatus("");
}

// 5. Render File List with Drag-and-Drop Reordering
function render() {
  list.innerHTML = "";
  const hasFiles = files.length > 0;
  
  list.classList.toggle("hidden", !hasFiles);
  clearBtn.classList.toggle("hidden", !hasFiles);
  mergeBtn.disabled = files.length < 2;

  files.forEach((f, i) => {
    const row = document.createElement("div");
    row.className = "item";
    row.draggable = true;
    row.dataset.index = i;

    row.innerHTML = `
      <span class="handle" style="cursor:grab;">☰</span>
      <span class="fname">${escapeHtml(f.name)}</span>
      <span class="size">${fmt(f.size)}</span>
      <button type="button" class="remove" title="ลบไฟล์">×</button>
    `;

    // Remove file action
    row.querySelector(".remove").onclick = (e) => {
      e.stopPropagation();
      files.splice(i, 1);
      render();
    };

    // Reorder Drag Events
    row.addEventListener("dragstart", e => {
      e.dataTransfer.setData("text/plain", i);
      row.classList.add("dragging");
    });

    row.addEventListener("dragend", () => row.classList.remove("dragging"));

    row.addEventListener("dragover", e => {
      e.preventDefault();
      row.classList.add("drag-over");
    });

    row.addEventListener("dragleave", () => row.classList.remove("drag-over"));

    row.addEventListener("drop", e => {
      e.preventDefault();
      row.classList.remove("drag-over");
      const from = +e.dataTransfer.getData("text/plain");
      const to = i;

      if (from !== to && !isNaN(from)) {
        const [movedItem] = files.splice(from, 1);
        files.splice(to, 0, movedItem);
        render();
      }
    });

    list.appendChild(row);
  });
}

// 6. Clear All
clearBtn.onclick = () => {
  files = [];
  render();
  showStatus("");
};

// 7. Merge PDF Engine
mergeBtn.onclick = merge;

async function merge() {
  if (files.length < 2) return;

  mergeBtn.disabled = true;
  clearBtn.classList.add("hidden");
  showStatus("กำลังเริ่มต้นกระบวนการรวม PDF…");

  try {
    const mergedPdf = await PDFLib.PDFDocument.create();

    for (let i = 0; i < files.length; i++) {
      showStatus(`กำลังประมวลผลไฟล์ที่ ${i + 1} จาก ${files.length}: ${files[i].name}`);
      
      const bytes = await files[i].arrayBuffer();
      
      let srcPdf;
      try {
        srcPdf = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true });
      } catch (err) {
        throw new Error(`ไฟล์ "${files[i].name}" อาจติดรหัสผ่านหรือไฟล์ย่อยเสียหาย`);
      }

      const pages = await mergedPdf.copyPages(srcPdf, srcPdf.getPageIndices());
      pages.forEach(p => mergedPdf.addPage(p));
    }

    showStatus("กำลังสร้างไฟล์ PDF ฉบับรวม…");
    const mergedPdfBytes = await mergedPdf.save();

    // Trigger Download
    const blob = new Blob([mergedPdfBytes], { type: "application/pdf" });
    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = `Feelgood_Merged_${dateStamp()}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => URL.revokeObjectURL(downloadUrl), 5000);
    showStatus("รวม PDF สำเร็จเรียบร้อยแล้ว! ✓", false, true);

  } catch (err) {
    console.error(err);
    showStatus(`เกิดข้อผิดพลาด: ${err.message}`, true);
  } finally {
    mergeBtn.disabled = files.length < 2;
    clearBtn.classList.toggle("hidden", files.length === 0);
  }
}

// Helper Functions
function showStatus(text, isError = false, isSuccess = false) {
  statusEl.textContent = text;
  statusEl.style.color = isError ? "#e53e3e" : isSuccess ? "#38a169" : "#4a5568";
}

function fmt(n) {
  return n < 1024 * 1024 
    ? (n / 1024).toFixed(0) + " KB" 
    : (n / (1024 * 1024)).toFixed(1) + " MB";
}

function dateStamp() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[c]));
}