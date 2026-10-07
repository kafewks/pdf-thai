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

  // 3. ระบบ Routing ผ่าน Hash URL
  window.addEventListener("hashchange", handleRoute);
  handleRoute(); // รันครั้งแรกเมื่อโหลดหน้าเว็บ
});

function handleRoute() {
  const rawHash = window.location.hash.replace("#", "").trim();
  const validTools = ["hub", "merge", "rotate", "split", "img2pdf"]; // << เพิ่ม "img2pdf"
  
  const hash = validTools.includes(rawHash) ? rawHash : "hub";

  document.querySelectorAll(".view-section").forEach(el => el.classList.add("hidden"));

  document.querySelectorAll(".nav-link").forEach(link => {
    link.classList.toggle("active", link.dataset.tool === hash);
  });

  const targetView = document.getElementById(`view-${hash}`) || document.getElementById("view-hub");
  targetView.classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });

  // Initialize Tools
  if (hash === "merge" && typeof window.initMergeTool === "function") window.initMergeTool();
  if (hash === "rotate" && typeof window.initRotateTool === "function") window.initRotateTool();
  if (hash === "split" && typeof window.initSplitTool === "function") window.initSplitTool();
  if (hash === "img2pdf" && typeof window.initImg2PdfTool === "function") window.initImg2PdfTool(); // << เพิ่มบรรทัดนี้
}

/**
 * แสดงข้อความแจ้งสถานะ (Status / Toast Message)
 * @param {HTMLElement} el Element แสดงผล
 * @param {string} text ข้อความที่ต้องการแสดง
 * @param {boolean} isError สถานะข้อผิดพลาด (สีแดง)
 * @param {boolean} isSuccess สถานะสำเร็จ (สีเขียว)
 */
function showStatus(el, text, isError = false, isSuccess = false) {
  if (!el) return;
  el.textContent = text;
  el.style.color = isError ? "#e53e3e" : isSuccess ? "#2563eb" : "#4a5568";
}

/**
 * สุ่มหรือแปลงวันที่เป็น Format YYYYMMDD สำหรับตั้งชื่อไฟล์ดาวน์โหลด
 */
function dateStamp() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}