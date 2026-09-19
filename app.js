// app.js - SPA Router & Controller
document.addEventListener("DOMContentLoaded", () => {
  // ตั้งค่า pdf.js worker
  if (window.pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  }

  // ป้องกันการ Drag-Drop หลุดนอกโซนทั้งหน้าจอ
  ["dragover", "drop"].forEach(eventName => {
    window.addEventListener(eventName, e => e.preventDefault(), false);
  });

  // ระบบ Routing ผ่าน Hash URL
  window.addEventListener("hashchange", handleRoute);
  handleRoute(); // รันครั้งแรกเมื่อโหลดหน้า
});

function handleRoute() {
  const hash = window.location.hash.replace("#", "") || "hub";
  
  // ซ่อนทุก View Section
  document.querySelectorAll(".view-section").forEach(el => el.classList.add("hidden"));
  
  // อัปเดต Nav Bar Link Highlight
  document.querySelectorAll(".nav-link").forEach(link => {
    link.classList.toggle("active", link.dataset.tool === hash);
  });

  // แสดง View Section ที่เลือก
  const targetView = document.getElementById(`view-${hash}`) || document.getElementById("view-hub");
  targetView.classList.remove("hidden");

  // Reset หรือ Initialize โมดูลเมื่อเปลี่ยนหน้า
  if (hash === "merge" && window.initMergeTool) window.initMergeTool();
  if (hash === "rotate" && window.initRotateTool) window.initRotateTool();
}

function showStatus(el, text, isError = false, isSuccess = false) {
  if (!el) return;
  el.textContent = text;
  el.style.color = isError ? "#e53e3e" : isSuccess ? "#38a169" : "#4a5568";
}

function dateStamp() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}