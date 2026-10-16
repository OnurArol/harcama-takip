/* Free, local OCR. Only OCR code/language assets are downloaded; receipt pixels stay in this browser. */
(function(root){
'use strict';
const fold=s=>String(s).toLocaleUpperCase('tr-TR').replace(/[İIı]/g,'I').replace(/Ş/g,'S').replace(/Ğ/g,'G').replace(/Ü/g,'U').replace(/Ö/g,'O').replace(/Ç/g,'C');
const round=n=>Math.round(n*100)/100;
function amountValue(s){
 let value=String(s).replace(/[^0-9,.]/g,'');
 if(!/[,.]\d{2}$/.test(value))return null;
 const decimal=value.length-3;
 value=value.slice(0,decimal).replace(/[,.]/g,'')+'.'+value.slice(decimal+1);
 const n=Number(value);return Number.isFinite(n)&&n>=0&&n<1e12?round(n):null;
}
function moneyAtEnd(line){
 const m=line.match(/(?:[₺*]\s*)?([0-9]+(?:[.,\s][0-9]{3})*[.,][0-9]{2})\s*(?:TL|TRY|₺|USD|EUR|\$|€)?\s*$/i);
 return m?{value:amountValue(m[1]),start:m.index,raw:m[0]}:null;
}
function validDate(y,m,d){const date=new Date(Date.UTC(y,m-1,d));return date.getUTCFullYear()===y&&date.getUTCMonth()===m-1&&date.getUTCDate()===d;}
function dateValue(line){
 let m=line.match(/\b(\d{4})[-/.](\d{2})[-/.](\d{2})\b/),y,month,d;
 if(m){y=Number(m[1]);month=Number(m[2]);d=Number(m[3]);}
 else {m=line.match(/\b(\d{2})[./-](\d{2})[./-](\d{4}|\d{2})\b/);if(!m)return null;d=Number(m[1]);month=Number(m[2]);y=Number(m[3]);if(y<100)y+=2000;}
 return y>=2000&&y<=2100&&validDate(y,month,d)?`${y}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`:null;
}
const subtotal=/\b(ARA\s*TOPLAM|TOPLAM\s*(KDV|VERGI|ISKONTO|INDIRIM)|TOPKDV|KDV|VERGI|NAKIT|KREDI|BANKA|KART|PARA\s*USTU|ODENEN|INDIRIM|ISKONTO|CHANGE|TENDER|SUBTOTAL|CASH|VAT)\b/;
const summary=/\b(TOPLAM|TOP\.?KDV|TOPKDV|KDV|VERGI|NAKIT|KREDI|BANKA|KART|PARA\s*USTU|ODENEN|ODENECEK|TAHSIL|INDIRIM|ISKONTO|TOTAL|CHANGE|TENDER|SUBTOTAL|CASH|VAT)\b/;
function parseText(text,confidence=100){
 const lines=String(text||'').split(/\r?\n/).map(s=>s.replace(/\s+/g,' ').trim()).filter(Boolean);
 const warnings=['Ücretsiz okuma sonucu: firma, tarih, toplam ve ürünleri fişle karşılaştırarak kontrol et.'];
 const dates=[...new Set(lines.map(dateValue).filter(Boolean))];
 let receipt_date=dates.length===1?dates[0]:null;
 if(dates.length>1)warnings.push('Fişte birden fazla tarih bulundu; doğru tarihi seç.');
 if(!receipt_date)warnings.push('Tarih doğrulanamadı; fişten kontrol ederek gir.');
 // Never choose the largest number: cash tendered/change and tax are not the payable total.
 const candidates=[];
 for(let i=0;i<lines.length;i++){
  const normalized=fold(lines[i]);
  if(subtotal.test(normalized))continue;
  const label=normalized.match(/\b(GENEL\s*TOPLAM|ODENECEK(?:\s*TUTAR)?|TOPLAM(?:\s*TUTAR)?|GRAND\s*TOTAL|TOTAL)\b/);
  if(!label)continue;
  let value=moneyAtEnd(lines[i]);
  if(value && value.start<label.index+label[0].length)value=null;
  if(!value && /^[\s:*₺TLTRY]*$/i.test(lines[i].slice(label.index+label[0].length)) && lines[i+1] && /^[*₺\d.,\s]+(?:TL|TRY|₺)?$/i.test(lines[i+1]))value=moneyAtEnd(lines[i+1]);
  if(value?.value>0)candidates.push(value.value);
 }
 const totals=[...new Set(candidates)];const amount=totals.length===1?totals[0]:null;
 if(!amount)warnings.push(totals.length>1?'Birden fazla toplam bulundu; ödenecek toplamı elle kontrol et.':'Ödenecek toplam okunamadı; fişten kontrol ederek gir.');
 let merchant=null;
 for(const line of lines.slice(0,8)){
  const normalized=fold(line);
  if(dateValue(line)||/\b(ADRES|TEL|TELEFON|VERGI|VKN|TCKN|FIS|TARIH|SAAT|MERSIS|SUBE|KASA|KASIYER|MAH|CAD|SOK|NO)\b/.test(normalized)||/https?:|www\.|@/.test(line))continue;
  if(/[A-ZÇĞİÖŞÜ]/i.test(line)&&line.replace(/[^A-Za-zÇĞİÖŞÜçğıöşü]/g,'').length>=3 && !moneyAtEnd(line)){merchant=line.slice(0,120);break;}
 }
 if(!merchant)warnings.push('Firma adı doğrulanamadı; fişten kontrol ederek gir.');
 const products=[];
 for(const line of lines){
  const normalized=fold(line), price=moneyAtEnd(line);
  if(!price||/[-−]\s*\d+[.,]\d{2}\s*(?:TL|TRY|₺)?$/i.test(line)||summary.test(normalized)||dateValue(line)||/\b(TEL|VERGI|FIS|TARIH|SAAT|VKN|TCKN|KASA|KASIYER|MERSIS)\b/.test(normalized))continue;
  let name=line.slice(0,price.start).replace(/\s*%\s*\d{1,2}\s*$/,'').trim();
  // A quantity/unit-price line is not another purchased item.
  if(!/[A-ZÇĞİÖŞÜ]/i.test(name)||/^\d+(?:[.,]\d+)?\s*(?:KG|G|LT|L|ADET)\b/i.test(fold(name)))continue;
  const quantityMatch=name.match(/^(\d+(?:[.,]\d+)?)\s*[xX×]\s*(.+)$/);
  let quantity=null;if(quantityMatch){quantity=Number(quantityMatch[1].replace(',','.'));name=quantityMatch[2];if(!/[A-ZÇĞİÖŞÜ]/i.test(name))continue;}
  products.push({name:name.slice(0,160),quantity,total:price.value});
 }
 let category='Diğer';const names=fold([merchant,...products.map(p=>p.name)].join(' '));
 const rules=[['Yakıt',/\b(OPET|SHELL|PETROL|BENZIN|MOTORIN|AKARYAKIT|TOTALENERGIES)\b/],['Sağlık',/\b(ECZANE|HASTANE|ILAC|SAGLIK)\b/],['Yemek',/\b(RESTORAN|RESTAURANT|LOKANTA|CAFE|KAFE|KEBAP|DONER)\b/],['Market',/\b(MIGROS|BIM|A101|SOK|CARREFOUR|MARKET|SUT|EKMEK|YOGURT|BEBEK BEZI)\b/],['Giyim',/\b(LCW|WAIKIKI|DEFACTO|KOTON|GIYIM|AYAKKABI)\b/]];
 for(const [cat,regex] of rules)if(regex.test(names)){category=cat;break;}
 if(category==='Diğer')warnings.push('Harcama türünü kontrol ederek seç.');
 let payment='Diğer';const normalized=fold(lines.join('\n'));
 if(/\bKREDI\s*KART/.test(normalized))payment='Kredi Kartı';else if(/\bBANKA\s*KART/.test(normalized))payment='Banka Kartı';else if(/\bNAKIT\b/.test(normalized))payment='Nakit';
 const currencies=[];if(/\b(TL|TRY)\b|₺/.test(normalized))currencies.push('TRY');if(/\bUSD\b|\$/.test(normalized))currencies.push('USD');if(/\bEUR\b|€/.test(normalized))currencies.push('EUR');
 const currency=currencies.length===1?currencies[0]:null;
 if(currency!=='TRY')warnings.push('Para birimi TL olarak doğrulanamadı; toplamı TL karşılığıyla kontrol et.');
 if(products.length===0)warnings.push('Ürünler ayrı ayrı okunamadı; gerekirse Ürün Ekle ile tamamla.');
 if(products.length&&amount&&Math.abs(round(products.reduce((s,p)=>s+p.total,0))-amount)>.02)warnings.push('Ürün toplamı fiş toplamından farklı; eksik ürün veya indirim olabilir.');
 if(confidence<70)warnings.push('Fotoğraf net okunamadı. Daha aydınlık ve düz açıdan çekmeyi deneyebilirsin.');
 return {merchant,receipt_date,amount,currency,category,payment,note:'',products:products.slice(0,200),warnings};
}
let scriptPromise;
function loadEngine(){
 if(root.Tesseract)return Promise.resolve(root.Tesseract);
 if(scriptPromise)return scriptPromise;
 scriptPromise=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/tesseract.min.js';s.onload=()=>resolve(root.Tesseract);s.onerror=()=>{s.remove();scriptPromise=null;reject(new Error('Ücretsiz okuma aracı indirilemedi. İnterneti kontrol edip yeniden dene.'));};document.head.appendChild(s);});return scriptPromise;
}
async function imageForOCR(blob){
 const url=URL.createObjectURL(blob);try{
  const image=new Image();image.src=url;await image.decode();
  // Limit working memory on phones; the untouched original remains in private cloud storage.
  const scale=Math.min(1,2400/image.naturalWidth,4200/image.naturalHeight,Math.sqrt(7000000/(image.naturalWidth*image.naturalHeight)));
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
  const context=canvas.getContext('2d',{willReadFrequently:true});context.fillStyle='white';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);return canvas;
 }finally{URL.revokeObjectURL(url);}
}
async function read(blob,onProgress=()=>{}){
 const engine=await loadEngine();const canvas=await imageForOCR(blob);let worker;
 try{
  worker=await engine.createWorker('tur+eng',1,{
   workerPath:'https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/worker.min.js',
   corePath:'https://cdn.jsdelivr.net/npm/tesseract.js-core@6.0.0',
   langPath:'https://tessdata.projectnaptha.com/4.0.0',
   logger:m=>onProgress(m.status==='recognizing text'?`Fiş cihazında okunuyor… %${Math.round((m.progress||0)*100)}`:'Ücretsiz okuma aracı hazırlanıyor…')
  });
  await worker.setParameters({preserve_interword_spaces:'1',user_defined_dpi:'300'});
  const {data}=await worker.recognize(canvas);return parseText(data.text,data.confidence);
 }finally{try{if(worker)await worker.terminate();}finally{canvas.width=canvas.height=1;}}
}
const api={parseText,read};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ReceiptOCR=api;
})(typeof window!=='undefined'?window:globalThis);
