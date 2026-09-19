const input=document.getElementById("fileInput"),drop=document.getElementById("drop"),list=document.getElementById("list"),mergeBtn=document.getElementById("mergeBtn"),clearBtn=document.getElementById("clearBtn"),status=document.getElementById("status"),chooseBtn=document.getElementById("chooseBtn");
let files=[];
chooseBtn.addEventListener("click",e=>{e.preventDefault();input.click()});
input.addEventListener("change",()=>addFiles([...input.files]));
["dragenter","dragover"].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add("over")}));
["dragleave","drop"].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove("over")}));
drop.addEventListener("drop",e=>addFiles([...e.dataTransfer.files].filter(f=>f.type==="application/pdf"||f.name.toLowerCase().endsWith(".pdf"))));
function addFiles(newFiles){files.push(...newFiles);render()}
function render(){
 list.innerHTML="";
 list.classList.toggle("hidden",files.length===0); clearBtn.classList.toggle("hidden",files.length===0); mergeBtn.disabled=files.length<2;
 files.forEach((f,i)=>{
  const row=document.createElement("div"); row.className="item"; row.draggable=true; row.dataset.i=i;
  row.innerHTML=`<span class="handle">☰</span><span class="fname">${escapeHtml(f.name)}</span><span class="size">${fmt(f.size)}</span><button class="remove" title="ลบ">×</button>`;
  row.querySelector(".remove").onclick=()=>{files.splice(i,1);render()};
  row.addEventListener("dragstart",e=>e.dataTransfer.setData("text/plain",i));
  row.addEventListener("dragover",e=>e.preventDefault());
  row.addEventListener("drop",e=>{e.preventDefault();const from=+e.dataTransfer.getData("text/plain"),to=i;if(from===to)return;const [x]=files.splice(from,1);files.splice(to,0,x);render()});
  list.appendChild(row);
 });
}
clearBtn.onclick=()=>{files=[];render();status.textContent=""};
mergeBtn.onclick=merge;
async function merge(){
 mergeBtn.disabled=true; status.textContent="กำลังรวม PDF…";
 try{
  const out=await PDFLib.PDFDocument.create();
  for(let i=0;i<files.length;i++){
   status.textContent=`กำลังรวมไฟล์ ${i+1}/${files.length}…`;
   const bytes=await files[i].arrayBuffer();
   const src=await PDFLib.PDFDocument.load(bytes,{ignoreEncryption:false});
   const pages=await out.copyPages(src,src.getPageIndices());
   pages.forEach(p=>out.addPage(p));
  }
  const bytes=await out.save();
  const blob=new Blob([bytes],{type:"application/pdf"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`รวมPDF_${dateStamp()}.pdf`;a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  status.textContent="รวม PDF สำเร็จ ✓ ดาวน์โหลดไฟล์แล้ว";
 }catch(err){console.error(err);status.textContent="เกิดข้อผิดพลาด: ไฟล์อาจมีการเข้ารหัสหรือเสียหาย"}
 finally{mergeBtn.disabled=files.length<2}
}
function fmt(n){return n<1024*1024?(n/1024).toFixed(0)+" KB":(n/1024/1024).toFixed(1)+" MB"}
function dateStamp(){return new Date().toISOString().slice(0,10)}
function escapeHtml(s){return s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
