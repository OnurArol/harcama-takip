(() => {
'use strict';
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const money = n => new Intl.NumberFormat('tr-TR', {style:'currency',currency:'TRY'}).format(Number(n)||0);
const cats = ['Market','Yemek','Yakıt','Fatura','Ev','Çocuk','Sağlık','Giyim','Eğlence','İş','Diğer'];
const pays = ['Nakit','Kredi Kartı','Banka Kartı','Havale / EFT','Diğer'];
const options = a => a.map(v => `<option>${esc(v)}</option>`).join('');
const baseUrl = location.origin + location.pathname;
let client, user, rows = [], selected, busy = false, initPromise;
let previewUrl, viewerUrl, localPreview, authGeneration = 0;
$('settings').insertAdjacentHTML('beforebegin', `
<section id="receipts" class="page receiptPage">
 <div class="card">
  <div class="sectionHead"><div><h2>Fişlerim</h2><div class="sub">Fotoğrafı yükle, bilgileri kontrol et, harcamaya ekle.</div></div></div>
  <div id="receiptSetup" class="receiptInfo" hidden>Fişleri bulutta saklamak için hesap bağlantısı kurulmalı. <a href="https://github.com/OnurArol/harcama-takip/blob/feature/receipt-scanning/FIS_KURULUM.md" target="_blank" rel="noopener">Kurulum adımları</a></div>
  <div id="receiptAuth" hidden><p class="receiptConsent">Fişlerine başka telefondan da ulaşabilmek için e-posta adresinle giriş yap.</p>
   <form id="receiptLogin"><label for="receiptEmail">E-posta</label><input id="receiptEmail" type="email" autocomplete="username" required>
    <label for="receiptPassword">Şifre</label><input id="receiptPassword" type="password" autocomplete="current-password" minlength="8" required>
    <div class="receiptToolbar"><button class="primary" type="submit">Giriş Yap</button><button id="receiptSignup" class="soft" type="button">Hesap Oluştur</button></div>
   </form>
  </div>
  <div id="receiptAccount" hidden><div class="sub" id="receiptAccountName"></div><div class="receiptToolbar"><button id="receiptRefresh" class="soft" type="button">Fişleri Yenile</button><button id="receiptSignout" class="soft" type="button">Çıkış Yap</button></div></div>
  <div id="receiptStatus" class="receiptStatus" role="status" aria-live="polite"></div>
 </div>
 <div id="receiptUpload" class="card" hidden><h2>Yeni Fiş Ekle</h2>
  <div class="receiptToolbar"><button id="receiptCamera" class="primary" type="button">Fotoğraf Çek</button><button id="receiptGallery" class="soft" type="button">Galeriden Seç</button></div>
  <input id="receiptCameraFile" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" hidden>
  <input id="receiptGalleryFile" type="file" accept="image/jpeg,image/png,image/webp" hidden>
  <p class="receiptConsent">Fotoğraf hesabına yüklenir ve otomatik okuma için yapay zekâ servisine gönderilir. JPEG, PNG veya WebP, en fazla 10 MB. Buluta kaydedildi mesajından sonra galerideki kopyayı tutman gerekmez.</p>
 </div>
 <div id="receiptEditor" class="card" hidden><h2>Fişi Kontrol Et</h2><img id="receiptPreview" class="receiptPreview" alt="Seçilen fiş fotoğrafı" hidden>
  <div class="receiptToolbar"><button id="receiptView" class="soft" type="button">Fişi Büyüt</button><button id="receiptAnalyze" class="soft" type="button">Yeniden Otomatik Oku</button></div>
  <p id="receiptWarnings" class="receiptInfo" hidden></p>
  <form id="receiptForm"><div class="receiptGrid">
   <div class="full"><label for="receiptMerchant">Firma / mağaza</label><input id="receiptMerchant" maxlength="120" required></div>
   <div><label for="receiptDate">Fiş tarihi</label><input id="receiptDate" type="date" required></div>
   <div><label for="receiptAmount">Toplam (₺)</label><input id="receiptAmount" type="number" inputmode="decimal" step="0.01" min="0.01" required></div>
   <div><label for="receiptCategory">Harcama türü</label><select id="receiptCategory">${options(cats)}</select></div>
   <div><label for="receiptPayment">Ödeme yöntemi</label><select id="receiptPayment">${options(pays)}</select></div>
   <div class="full"><label for="receiptNote">Açıklama</label><input id="receiptNote" maxlength="500"></div>
  </div><h3 style="margin-top:20px">Neye harcandı?</h3><p class="sub">Ürün tutarı satır toplamıdır. İndirimler nedeniyle ürün toplamı fiş toplamından farklı olabilir.</p>
  <div id="receiptProducts"></div><button id="receiptAddProduct" class="soft" type="button">Ürün Ekle</button>
  <div class="formActions"><button id="receiptConfirm" class="primary" type="submit">Kontrol Ettim, Harcamaya Ekle</button><button id="receiptClose" class="soft" type="button">Kapat</button></div></form>
 </div>
 <div id="receiptArchive" class="card" hidden><h2>Kayıtlı Fişler</h2><label for="receiptSearch">Firma, ürün veya açıklamada ara</label><input id="receiptSearch" type="search" placeholder="Örn. Migros, süt, bebek bezi"><div id="receiptList"></div></div>
</section>`);
$('home').insertAdjacentHTML('beforeend', '<div class="card"><h2>Fişten Harcama Ekle</h2><div class="sub">Alışveriş fişlerini hesabında sakla ve otomatik oku.</div><div class="formActions"><button id="receiptHome" class="primary" type="button">Fiş Tara / Fişlerim</button></div></div>');
document.body.insertAdjacentHTML('beforeend','<div id="receiptViewer" class="receiptViewer" role="dialog" aria-modal="true" aria-label="Fiş fotoğrafı" hidden><button id="receiptViewerClose" class="soft" type="button">Kapat</button><img id="receiptViewerImage" alt="Fişin orijinal fotoğrafı"></div>');
function status(message, error=false) {$('receiptStatus').textContent=message;$('receiptStatus').classList.toggle('error',error);}
function setBusy(value){busy=value;document.querySelectorAll('#receipts button').forEach(b=>b.disabled=value);}
async function task(fn){if(busy)return;setBusy(true);try{await fn();}catch(e){status(e.message||'İşlem tamamlanamadı. İnternet bağlantını kontrol edip yeniden dene.',true);}finally{setBusy(false);}}
function check(result){if(result.error)throw result.error;return result.data;}
function configured(){const c=window.RECEIPT_CONFIG||{};return /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(c.supabaseUrl||'') && !!c.supabasePublishableKey;}
function loadSDK(){return new Promise((resolve,reject)=>{if(window.supabase)return resolve();const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/dist/umd/supabase.js';script.onload=resolve;script.onerror=()=>{script.remove();reject(new Error('Hesap bağlantısı yüklenemedi. İnterneti kontrol edip Fişler sekmesini tekrar aç.'));};document.head.appendChild(script);});}
async function initialize(){
 if(!configured()){$('receiptSetup').hidden=false;return;}
 if(initPromise)return initPromise;
 initPromise=(async()=>{await loadSDK();const c=window.RECEIPT_CONFIG;client=window.supabase.createClient(c.supabaseUrl,c.supabasePublishableKey);
  const {data,error}=await client.auth.getUser();if(error && error.name!=='AuthSessionMissingError')throw error;
  await changeUser(data.user);
  client.auth.onAuthStateChange((_event,session)=>{setTimeout(()=>changeUser(session?.user).catch(e=>status(e.message,true)),0);});
 })().catch(e=>{initPromise=null;throw e;});return initPromise;
}
function syncExpenses(){window.ReceiptExpenses?.set(rows.filter(r=>r.status==='confirmed').map(r=>({id:'receipt:'+r.id,receiptId:r.id,date:r.receipt_date,amount:Number(r.amount),cat:r.category,pay:r.payment,desc:[r.merchant,r.note].filter(Boolean).join(' • ')})));}
async function changeUser(next){
 const same=user?.id && next?.id===user.id;user=next||null;
 $('receiptAuth').hidden=!!user;$('receiptAccount').hidden=!user;$('receiptUpload').hidden=!user;$('receiptArchive').hidden=!user;
 $('receiptAccountName').textContent=user?`Giriş yapıldı: ${user.email}`:'';
 if(!same){authGeneration++;rows=[];selected=null;closeEditor();syncExpenses();renderList();}
 if(user)await refresh();
}
async function refresh(){if(!user)return;const generation=authGeneration;let all=[];
 // Read all pages: the default PostgREST row limit must not truncate expense totals.
 for(let from=0;;from+=500){const page=check(await client.from('receipts').select('*').eq('owner_id',user.id).order('created_at',{ascending:false}).order('id').range(from,from+499));all.push(...page);if(page.length<500)break;}
 if(generation!==authGeneration)return;rows=all;syncExpenses();renderList();
}
function renderList(){const q=$('receiptSearch').value.trim().toLocaleLowerCase('tr-TR');const visible=rows.filter(r=>[r.merchant,r.note,...(r.products||[]).map(p=>p.name)].join(' ').toLocaleLowerCase('tr-TR').includes(q));
 $('receiptList').innerHTML=visible.length?visible.map(r=>`<div class="receiptRow"><div class="receiptRowHead"><strong>${esc(r.merchant||'Okunmayı bekleyen fiş')}</strong><span>${r.amount?money(r.amount):'—'}</span></div><div class="sub">${esc(r.receipt_date||'Tarih bekleniyor')} • ${esc(r.category||'Diğer')}</div><span class="receiptTag ${r.status==='confirmed'?'':'draft'}">${r.status==='confirmed'?'Harcamaya eklendi':r.status==='uploading'?'Yükleme tamamlanmadı':'Kontrol bekliyor'}</span><div class="receiptToolbar"><button class="soft" type="button" data-receipt-open="${r.id}">Görüntüle / Düzenle</button><button class="danger" type="button" data-receipt-delete="${r.id}">Fişi Sil</button></div></div>`).join(''):'<div class="empty">Fiş bulunamadı.</div>';
}
function clearPreview(){if(localPreview)URL.revokeObjectURL(localPreview);localPreview=null;previewUrl=null;$('receiptPreview').removeAttribute('src');$('receiptPreview').hidden=true;}
function closeEditor(){selected=null;clearPreview();$('receiptEditor').hidden=true;}
function productRow(p={}){const div=document.createElement('div');div.className='receiptProduct';div.innerHTML=`<div><label>Ürün</label><input data-product-name maxlength="160" value="${esc(p.name||'')}" required aria-label="Ürün adı"></div><div><label>Adet/kg</label><input data-product-qty type="number" min="0.001" step="0.001" value="${esc(p.quantity??'')}" aria-label="Ürün miktarı"></div><div><label>Tutar (₺)</label><input data-product-total type="number" min="0" step="0.01" value="${esc(p.total??'')}" aria-label="Ürün satır tutarı"></div><button class="danger" type="button" data-product-remove aria-label="Ürünü kaldır">×</button>`;$('receiptProducts').appendChild(div);}
function fillEditor(r){selected=r;$('receiptEditor').hidden=false;$('receiptMerchant').value=r.merchant||'';$('receiptDate').value=r.receipt_date||'';$('receiptAmount').value=r.amount??'';$('receiptCategory').value=r.category||'Diğer';$('receiptPayment').value=r.payment||'Diğer';$('receiptNote').value=r.note||'';$('receiptProducts').innerHTML='';(r.products||[]).forEach(productRow);const warnings=[...(r.warnings||[])];if(r.currency && r.currency!=='TRY')warnings.push('Fiş TL değil. Toplamı TL karşılığıyla düzeltmeden kaydetme.');$('receiptWarnings').textContent=warnings.join(' ');$('receiptWarnings').hidden=!warnings.length;$('receiptConfirm').textContent=r.status==='confirmed'?'Değişiklikleri Kaydet':'Kontrol Ettim, Harcamaya Ekle';$('receiptAnalyze').hidden=r.status==='confirmed';$('receiptView').disabled=r.status==='uploading';}
async function openReceipt(id){const r=rows.find(r=>r.id===id);if(!r)return;clearPreview();fillEditor(r);if(r.status==='uploading'){status('Bu fişin fotoğraf yüklemesi tamamlanmamış. Aynı fotoğrafı tekrar seçerek yüklemeyi tamamlayabilirsin.',true);return;}
 const data=check(await client.storage.from('receipts').createSignedUrl(r.image_path,300));previewUrl=data.signedUrl;$('receiptPreview').src=previewUrl;$('receiptPreview').hidden=false;$('receiptEditor').scrollIntoView({behavior:'smooth',block:'start'});
}
async function sha256(file){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()))].map(n=>n.toString(16).padStart(2,'0')).join('');}
async function upload(file){if(!user)throw new Error('Önce hesabına giriş yap.');const types={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};if(!types[file.type])throw new Error('JPEG, PNG veya WebP fotoğraf seç. HEIC fotoğrafları JPEG olarak dışa aktarabilir veya Fotoğraf Çek düğmesini kullanabilirsin.');if(!file.size||file.size>10*1024*1024)throw new Error('Fotoğraf 10 MB veya daha küçük olmalı.');
 status('Fotoğraf yükleniyor…');const hash=await sha256(file);let r=rows.find(r=>r.image_hash===hash);
 if(!r){const id=crypto.randomUUID();const payload={id,owner_id:user.id,image_hash:hash,image_path:`${user.id}/${id}.${types[file.type]}`,image_mime:file.type,status:'uploading'};const result=await client.from('receipts').insert(payload).select().single();if(result.error?.code==='23505'){r=check(await client.from('receipts').select('*').eq('image_hash',hash).single());}else r=check(result);}
 if(r.status!=='uploading'){await refresh();await openReceipt(r.id);status('Bu fotoğraf zaten kayıtlı. Mevcut fiş açıldı.');return;}
 // Upsert permits recovery when the bytes arrived but the status update was interrupted.
 check(await client.storage.from('receipts').upload(r.image_path,file,{contentType:file.type,upsert:true}));
 r=check(await client.from('receipts').update({status:'uploaded'}).eq('id',r.id).select().single());
 await refresh();await openReceipt(r.id);status('Fotoğraf buluta kaydedildi. Fiş okunuyor…');
 await analyze(r.id);
}
async function analyze(id){status('Fiş otomatik okunuyor…');const result=await client.functions.invoke('analyze-receipt',{body:{receiptId:id}});
 if(result.error){await refresh();throw new Error('Fotoğraf buluta kaydedildi; otomatik okuma tamamlanamadı. Yeniden Otomatik Oku ile deneyebilir veya bilgileri elle tamamlayabilirsin.');}
 if(result.data?.error)throw new Error(result.data.error);
 await refresh();await openReceipt(id);status('Okuma tamamlandı. Firma, tarih, toplam ve ürünleri kontrol edip kaydet.');
}
$('receiptHome').addEventListener('click',()=>document.querySelector('.nav button[data-p="receipts"]').click());
document.querySelector('.nav button[data-p="receipts"]').addEventListener('click',()=>task(initialize));
$('receiptLogin').addEventListener('submit',e=>{e.preventDefault();task(async()=>{await initialize();check(await client.auth.signInWithPassword({email:$('receiptEmail').value.trim(),password:$('receiptPassword').value}));$('receiptPassword').value='';status('Giriş yapıldı.');});});
$('receiptSignup').addEventListener('click',()=>{if(!$('receiptLogin').reportValidity())return;task(async()=>{const data=check(await client.auth.signUp({email:$('receiptEmail').value.trim(),password:$('receiptPassword').value,options:{emailRedirectTo:baseUrl}}));$('receiptPassword').value='';status(data.session?'Hesap oluşturuldu.':'E-postandaki doğrulama bağlantısını aç. Sonra şifrenle giriş yap.');});});
$('receiptSignout').addEventListener('click',()=>task(async()=>{check(await client.auth.signOut());await changeUser(null);status('Hesaptan çıkış yapıldı.');}));
$('receiptRefresh').addEventListener('click',()=>task(async()=>{await refresh();status('Fişler yenilendi.');}));
for(const [button,input] of [['receiptCamera','receiptCameraFile'],['receiptGallery','receiptGalleryFile']]){$(button).addEventListener('click',()=>$(input).click());$(input).addEventListener('change',e=>{const file=e.target.files?.[0];e.target.value='';if(file)task(()=>upload(file));});}
$('receiptAnalyze').addEventListener('click',()=>{if(selected && selected.status!=='confirmed')task(()=>analyze(selected.id));});
$('receiptClose').addEventListener('click',closeEditor);$('receiptSearch').addEventListener('input',renderList);
$('receiptAddProduct').addEventListener('click',()=>productRow());$('receiptProducts').addEventListener('click',e=>e.target.closest('[data-product-remove]')?.closest('.receiptProduct').remove());
$('receiptForm').addEventListener('submit',e=>{e.preventDefault();if(!selected)return;task(async()=>{if(selected.status==='uploading')throw new Error('Önce fotoğrafın yüklemesini tamamla.');const products=[...document.querySelectorAll('.receiptProduct')].map(el=>({name:el.querySelector('[data-product-name]').value.trim(),quantity:el.querySelector('[data-product-qty]').value?Number(el.querySelector('[data-product-qty]').value):null,total:el.querySelector('[data-product-total]').value?Number(el.querySelector('[data-product-total]').value):null}));
 const id=selected.id;check(await client.rpc('confirm_receipt',{receipt_id:id,merchant_value:$('receiptMerchant').value.trim(),date_value:$('receiptDate').value,amount_value:Number($('receiptAmount').value),category_value:$('receiptCategory').value,payment_value:$('receiptPayment').value,note_value:$('receiptNote').value.trim(),products_value:products}));
 await refresh();await openReceipt(id);status('Fiş kaydedildi ve harcama toplamlarına eklendi.');
 });});
$('receiptList').addEventListener('click',e=>{const open=e.target.closest('[data-receipt-open]');if(open)return task(()=>openReceipt(open.dataset.receiptOpen));const del=e.target.closest('[data-receipt-delete]');if(!del)return;const r=rows.find(r=>r.id===del.dataset.receiptDelete);if(!r||!confirm('Fiş fotoğrafı ve bu fişe bağlı harcama silinsin mi?'))return;
 task(async()=>{check(await client.storage.from('receipts').remove([r.image_path]));check(await client.from('receipts').delete().eq('id',r.id));if(selected?.id===r.id)closeEditor();await refresh();status('Fiş ve bağlı harcama silindi.');});
});
document.addEventListener('click',e=>{const b=e.target.closest('[data-receipt-id]');if(!b)return;document.querySelectorAll('.page').forEach(p=>p.classList.toggle('on',p.id==='receipts'));document.querySelectorAll('.nav button').forEach(n=>n.classList.toggle('on',n.dataset.p==='receipts'));task(async()=>{await initialize();await openReceipt(b.dataset.receiptId);});});
$('receiptView').addEventListener('click',()=>task(async()=>{if(!selected||selected.status==='uploading')return;const data=check(await client.storage.from('receipts').createSignedUrl(selected.image_path,300));viewerUrl=data.signedUrl;$('receiptViewerImage').src=viewerUrl;$('receiptViewer').hidden=false;$('receiptViewerClose').focus();}));
function closeViewer(){$('receiptViewer').hidden=true;$('receiptViewerImage').removeAttribute('src');viewerUrl=null;$('receiptView').focus();}
$('receiptViewerClose').addEventListener('click',closeViewer);document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('receiptViewer').hidden)closeViewer();});
// Restore cloud expenses without delaying the original local application.
window.addEventListener('load',()=>{if(configured())task(initialize);});
})();
