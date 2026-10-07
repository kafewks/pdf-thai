// app.js - SPA Router & Controller
document.addEventListener("DOMContentLoaded", () => {
  // 1. ตั้งค่า pdf.js worker
  if (window.pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  }

  // 2. ป้องกันการ Drag-Drop ไฟล์เปิดในเบราว์เซอร์โดยไม่ตั้งใจ (ทั้งหน้า)
  ["dragover", "drop"].forEach(eventName => {
    window.addEventListener(eventName, e => e.preventDefault(), false);
  });

  // 3. ผูก Event Listener สำหรับลิงก์เมนู และ การ์ดเครื่องมือ
  document.querySelectorAll(".nav-link, .tool-card").forEach(link => {
    link.addEventListener("click", (e) => {
      const href = link.getAttribute("href");
      if (href && href.startsWith("#")) {
        const tool = href.replace("#", "").trim();
        if (tool) {
          window.location.hash = tool;
        }
      }
    });
  });

  // 4. เรียกทำงาน Routing เมื่อโหลดหน้าครั้งแรก
  handleRoute();
});

function handleRoute() {
  const rawHash = window.location.hash.replace("#", "").trim();
  
  // รายการ tools ทั้งหมดที่อนุญาต
  const validTools = ["hub", "merge", "rotate", "split", "img2pdf", "pdf2img", "protect", "edit"];
  
  const hash = validTools.includes(rawHash) ? rawHash : "hub";

  // ซ่อนทุก view section ก่อน
  document.querySelectorAll(".view-section").forEach(el => el.classList.add("hidden"));

  // อัปเดตสถานะ active บนแถบเมนู Navigation
  document.querySelectorAll(".nav-link").forEach(link => {
    const linkTool = link.dataset.tool || link.getAttribute("href")?.replace("#", "");
    link.classList.toggle("active", linkTool === hash || (hash === "hub" && linkTool === ""));
  });

  // แสดงหน้า View ที่เลือก
  const targetView = document.getElementById(`view-${hash}`) || document.getElementById("view-hub");
  if (targetView) {
    targetView.classList.remove("hidden");
  }
  window.scrollTo({ top: 0, behavior: "smooth" });

  // เรียกใช้งานฟังก์ชันเริ่มต้นของแต่ละเครื่องมือ
  if (hash === "merge" && typeof window.initMergeTool === "function") window.initMergeTool();
  if (hash === "rotate" && typeof window.initRotateTool === "function") window.initRotateTool();
  if (hash === "split" && typeof window.initSplitTool === "function") window.initSplitTool();
  if (hash === "img2pdf" && typeof window.initImg2PdfTool === "function") window.initImg2PdfTool();
  if (hash === "pdf2img" && typeof window.initPdf2ImgTool === "function") window.initPdf2ImgTool();
  if (hash === "protect" && typeof window.initProtectTool === "function") window.initProtectTool();
  if (hash === "edit" && typeof window.initEditTool === "function") window.initEditTool();
}

// ผูก Event Listener สำหรับ Hash Change
window.addEventListener("hashchange", handleRoute);

/**
 * แสดงข้อความแจ้งสถานะ (Status / Toast Message)
 */
function showStatus(el, text, isError = false, isSuccess = false) {
  if (!el) return;
  el.textContent = text;
  el.style.color = isError ? "#e53e3e" : isSuccess ? "#2563eb" : "#4a5568";
}

/**
 * แปลงวันที่เป็น Format YYYYMMDD สำหรับตั้งชื่อไฟล์ดาวน์โหลด
 */
function dateStamp() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}