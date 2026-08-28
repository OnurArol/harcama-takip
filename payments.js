(()=>{
const ROOT_KEY='harcama_payments_v1';
const $=id=>document.getElementById(id);
const money=n=>new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY'}).format(Number(n)||0);
const pad=n=>String(n).padStart(2,'0');
const today=()=>{const d=new Date();return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`};
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const parseDate=s=>{const [y,m,d]=String(s).split('-').map(Number);return new Date(y,m-1,d,12,0,0,0)};
const diffDays=(a,b)=>Math.round((parseDate(a)-parseDate(b))/86400000);
let items=[];
try{items=JSON.parse(localStorage.getItem(ROOT_KEY)||'[]')}catch{}
if(!Array.isArray(items))items=[];
function save(){localStorage.setItem(ROOT_KEY,JSON.stringify(items));render()}
function addMonths(dateStr,n){const [y,m,d]=dateStr.split('-').map(Number);const dt=new Date(y,m-1+n,d,12);return `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}`}
function addYears(dateStr,n){const [y,m,d]=dateStr.split('-').map(Number);const dt=new Date(y+n,m-1,d,12);return `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}`}
function repeatText(v){return v==='monthly'?'Her ay':v==='yearly'?'Her yıl':'Tek sefer'}
function reminderText(v){const n=Number(v)||0;return n===0?'Aynı gün':`${n} gün önce`}
function statusFor(x){
 if(x.paid&&x.repeat==='once')return {text:'Ödendi',cls:'paid'};
 const d=diffDays(x.due,today());
 if(d<0)return {text:`${Math.abs(d)} gün gecikti`,cls:'overdue'};
 if(d===0)return {text:'Bugün ödenecek',cls:'today'};
 if(d<=7)return {text:`${d} gün kaldı`,cls:'soon'};
 return {text:`${d} gün kaldı`,cls:''};
}
function upcoming(){return items.filter(x=>!(x.paid&&x.repeat==='once')).slice().sort((a,b)=>String(a.due).localeCompare(String(b.due)))}
function openPayments(){
 document.querySelectorAll('.page').forEach(p=>p.classList.toggle('on',p.id==='payments'));
 document.querySelectorAll('.nav button').forEach(b=>b.classList.remove('on'));
 window.scrollTo({top:0,behavior:'smooth'});
 render();
}
$('openPayments')?.addEventListener('click',openPayments);
$('openPayments2')?.addEventListener('click',openPayments);
$('backPayments')?.addEventListener('click',()=>document.querySelector('.nav button[data-p="home"]')?.click());
if($('paymentDate'))$('paymentDate').value=today();
$('paymentForm')?.addEventListener('submit',e=>{
 e.preventDefault();
 const name=$('paymentName').value.trim();
 const amount=Number($('paymentAmount').value);
 const due=$('paymentDate').value;
 if(!name)return alert('Ödeme adı gir.');
 if(!(amount>0))return alert('Geçerli bir tutar gir.');
 if(!due)return alert('Son ödeme tarihi seç.');
 items.push({
   id:String(Date.now())+Math.random().toString(16).slice(2),
   name,amount:Math.round(amount*100)/100,due,
   repeat:$('paymentRepeat').value,
   remind:Number($('paymentReminder').value)||0,
   time:$('paymentTime').value||'09:00',
   note:$('paymentNote').value.trim(),paid:false,createdAt:new Date().toISOString()
 });
 save();
 $('paymentName').value='';$('paymentAmount').value='';$('paymentDate').value=today();$('paymentRepeat').value='monthly';$('paymentReminder').value='1';$('paymentTime').value='09:00';$('paymentNote').value='';
});
function icsEscape(v){return String(v||'').replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;')}
function dtStamp(){const d=new Date();return d.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'')}
function icsDateTime(date,time){const [y,m,d]=date.split('-');const [hh,mm]=(time||'09:00').split(':');return `${y}${m}${d}T${hh}${mm}00`}
function makeICS(x){
 const start=icsDateTime(x.due,x.time||'09:00');
 const [hh,mm]=(x.time||'09:00').split(':').map(Number);const endM=hh*60+mm+15;const eh=pad(Math.floor(endM/60)%24),em=pad(endM%60);const end=icsDateTime(x.due,`${eh}:${em}`);
 const trig=(Number(x.remind)||0)===0?'PT0M':`-P${Number(x.remind)}D`;
 const rrule=x.repeat==='monthly'?'RRULE:FREQ=MONTHLY\r\n':x.repeat==='yearly'?'RRULE:FREQ=YEARLY\r\n':'';
 return `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Harcama Takip//TR\r\nCALSCALE:GREGORIAN\r\nMETHOD:PUBLISH\r\nBEGIN:VEVENT\r\nUID:${x.id}@harcama-takip\r\nDTSTAMP:${dtStamp()}\r\nDTSTART:${start}\r\nDTEND:${end}\r\n${rrule}SUMMARY:${icsEscape('Ödeme: '+x.name)}\r\nDESCRIPTION:${icsEscape((x.note?x.note+' - ':'')+'Tutar: '+money(x.amount))}\r\nBEGIN:VALARM\r\nACTION:DISPLAY\r\nDESCRIPTION:${icsEscape(x.name+' ödeme hatırlatması')}\r\nTRIGGER:${trig}\r\nEND:VALARM\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`;
}
function downloadICS(x){
 const blob=new Blob([makeICS(x)],{type:'text/calendar;charset=utf-8'});
 const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`odeme-${x.name.toLocaleLowerCase('tr-TR').replace(/[^a-z0-9çğıöşü]+/gi,'-')}.ics`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
}
$('paymentItems')?.addEventListener('click',e=>{
 const b=e.target.closest('button[data-action]');if(!b)return;const x=items.find(i=>String(i.id)===b.dataset.id);if(!x)return;
 if(b.dataset.action==='calendar'){downloadICS(x);setTimeout(()=>alert('Takvim dosyası hazırlandı. iPhone dosyayı açtığında Takvim’e ekle; bildirimleri iOS Takvim gönderecek.'),250)}
 if(b.dataset.action==='delete'&&confirm('Bu ödeme hatırlatması silinsin mi?')){items=items.filter(i=>String(i.id)!==b.dataset.id);save()}
 if(b.dataset.action==='paid'){
   if(x.repeat==='monthly'){x.lastPaid=x.due;x.due=addMonths(x.due,1);x.paid=false}
   else if(x.repeat==='yearly'){x.lastPaid=x.due;x.due=addYears(x.due,1);x.paid=false}
   else{x.paid=true;x.lastPaid=x.due}
   save();
 }
});
$('clearPayments')?.addEventListener('click',()=>{if(items.length&&confirm('Tüm ödeme hatırlatmaları silinsin mi?')){items=[];save()}});
function render(){
 const up=upcoming();
 const urgent=up.filter(x=>diffDays(x.due,today())<=7).length;
 if($('paymentDueCount'))$('paymentDueCount').textContent=urgent?String(urgent):'';
 const q=$('paymentQuickList');
 if(q){q.innerHTML=up.length?up.slice(0,3).map(x=>{const s=statusFor(x);return `<div class="paymentQuickItem ${s.cls==='overdue'?'paymentAlert':''}"><div><div class="paymentQuickName">${esc(x.name)}</div><div class="paymentQuickMeta">${esc(x.due)} • ${esc(s.text)}</div></div><div class="paymentQuickAmt">${money(x.amount)}</div></div>`}).join(''):'<div class="empty">Planlanmış ödeme yok.</div>'}
 const list=$('paymentItems');
 if(list){list.innerHTML=up.length?up.map(x=>{const s=statusFor(x);return `<div class="paymentItem"><div class="paymentItemTop"><div><div class="paymentName">${esc(x.name)}</div><div class="paymentNote">${esc(x.note||'')}</div></div><div class="paymentAmount">${money(x.amount)}</div></div><div class="paymentMeta"><span>Son tarih: ${esc(x.due)}</span><span>${esc(repeatText(x.repeat))}</span><span>${esc(reminderText(x.remind))}, ${esc(x.time||'09:00')}</span></div><div class="paymentStatus ${s.cls}">${esc(s.text)}</div><div class="paymentActions"><button class="calendarBtn" data-action="calendar" data-id="${esc(x.id)}" type="button">Takvime Ekle</button><button class="paidBtn" data-action="paid" data-id="${esc(x.id)}" type="button">Ödendi</button><button class="danger" data-action="delete" data-id="${esc(x.id)}" type="button">Sil</button></div></div>`}).join(''):'<div class="paymentEmpty">Henüz ödeme hatırlatması yok.</div>'}
 if($('paymentCountText'))$('paymentCountText').textContent=`${up.length} aktif ödeme planı`;
}
render();
})();