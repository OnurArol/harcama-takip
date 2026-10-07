import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const server=createServer(async(req,res)=>{try{const path=new URL(req.url,'http://localhost').pathname;const data=await readFile(new URL(path==='/'?'index.html':path.slice(1),root));res.setHeader('Content-Type',path.endsWith('.js')?'application/javascript':path.endsWith('.css')?'text/css':'text/html');res.end(data);}catch{res.writeHead(404);res.end();}});
await new Promise(resolve=>server.listen(8765,'127.0.0.1',resolve));
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { validateReceipt } from '../supabase/functions/analyze-receipt/schema.ts';
const fixture={merchant:'Migros',receipt_date:'2026-10-07',amount:1284.50,currency:'TRY',category:'Market',payment:'Kredi Kartı',note:'Market alışverişi',products:[{name:'Süt',quantity:2,total:85.50},{name:'Bebek bezi',quantity:1,total:1199}],warnings:[]};
const invalid=validateReceipt({...fixture,amount:-1,receipt_date:'2026-02-30',products:[{name:'Süt',quantity:-2,total:-1}],warnings:[]});
assert.equal(invalid.amount,null);assert.equal(invalid.receipt_date,null);assert.equal(invalid.products[0].quantity,null);assert.equal(invalid.products[0].total,null);
const browser=await chromium.launch({headless:true,...(process.env.RECEIPTS_CHROMIUM_PATH?{executablePath:process.env.RECEIPTS_CHROMIUM_PATH}:{})});
const errors=[];
try{
 const context=await browser.newContext({viewport:{width:390,height:844},locale:'tr-TR',serviceWorkers:'block'});
 await context.addInitScript(()=>{
  const today=new Date();const date=today.getFullYear()+'-'+String(today.getMonth()+1).padStart(2,'0')+'-'+String(today.getDate()).padStart(2,'0');
  localStorage.setItem('harcama_ios_v2',JSON.stringify([{id:100,date,amount:150,cat:'Yakıt',pay:'Nakit',desc:'Eski harcama'}]));
  localStorage.setItem('harcama_income_v1',JSON.stringify([{id:'old-income',date,amount:5000,cat:'Maaş',desc:'Eski gelir'}]));
  window.__initialLocal=localStorage.getItem('harcama_ios_v2');
  window.__mock={rows:[],files:{},user:{id:'11111111-1111-4111-8111-111111111111',email:'test@example.com'},failOCR:false,ocrCalls:0};
  const m=window.__mock;
  class Query{
   constructor(){this.filters=[];this.start=0;this.end=Infinity;this.operation='select';}
   select(){return this;}eq(k,v){this.filters.push([k,v]);return this;}order(){return this;}range(a,b){this.start=a;this.end=b;return this;}
   insert(v){this.operation='insert';this.values=v;return this;}update(v){this.operation='update';this.values=v;return this;}delete(){this.operation='delete';return this;}single(){this.one=true;return this;}
   then(resolve,reject){return Promise.resolve().then(()=>{
    let data=m.rows.filter(r=>this.filters.every(([k,v])=>r[k]===v));
    if(this.operation==='insert'){
     if(m.rows.some(r=>r.image_hash===this.values.image_hash))return {data:null,error:{code:'23505'}};
     const r={...this.values,merchant:null,receipt_date:null,amount:null,currency:null,category:'Diğer',payment:'Diğer',note:'',products:[],warnings:[],created_at:new Date().toISOString()};m.rows.unshift(r);data=[r];
    }else if(this.operation==='update')data.forEach(r=>Object.assign(r,this.values));
    else if(this.operation==='delete'){m.rows=m.rows.filter(r=>!data.includes(r));data=[];}
    else data=data.slice(this.start,this.end+1);
    return {data:this.one?data[0]:structuredClone(data),error:null};
   }).then(resolve,reject);}
  }
  const cli={
   auth:{getUser:async()=>({data:{user:m.user},error:null}),onAuthStateChange:fn=>{m.authCallback=fn;},signOut:async()=>{m.user=null;m.authCallback('SIGNED_OUT',null);return{error:null};},signInWithPassword:async()=>({data:{user:m.user},error:null}),signUp:async()=>({data:{session:null},error:null})},
   from:()=>new Query(),
   storage:{from:()=>({upload:async(path,file)=>{m.files[path]=file;return {data:{path},error:null};},createSignedUrl:async path=>({data:{signedUrl:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jwz8AAAAASUVORK5CYII='},error:null}),remove:async paths=>{paths.forEach(p=>delete m.files[p]);return{data:[],error:null};}})},
   rpc:async(_name,p)=>{const r=m.rows.find(r=>r.id===p.receipt_id);Object.assign(r,{merchant:p.merchant_value,receipt_date:p.date_value,amount:p.amount_value,category:p.category_value,payment:p.payment_value,note:p.note_value,products:p.products_value,status:'confirmed',currency:'TRY'});return{data:structuredClone(r),error:null};},
   functions:{invoke:async(_name,{body})=>{m.ocrCalls++;if(m.failOCR)return{error:{message:'network failed'}};const r=m.rows.find(r=>r.id===body.receiptId);Object.assign(r,{merchant:'Migros',receipt_date:date,amount:1284.50,currency:'TRY',category:'Market',payment:'Kredi Kartı',note:'Market alışverişi',products:[{name:'Süt',quantity:2,total:85.50},{name:'Bebek bezi',quantity:1,total:1199}],warnings:[],status:'analyzed'});return{data:{receipt:structuredClone(r)},error:null};}}
  };
  window.supabase={createClient:()=>cli};
 });
 await context.route('**/receipt-config.js*',route=>route.fulfill({contentType:'application/javascript',body:"window.RECEIPT_CONFIG={supabaseUrl:'https://test.supabase.co',supabasePublishableKey:'public-test'};"}));
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8765');await page.waitForFunction(()=>window.ReceiptExpenses);
 const visibleAmount=await page.locator('#mt').innerText();assert.match(visibleAmount,/150/);
 await page.locator('[data-p="add"]').click();await page.locator('#amount').fill('25.50');await page.locator('#desc').fill('Yeni manuel kayıt');await page.locator('#f button[type="submit"]').first().click();
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('harcama_ios_v2')).length),2);
 await page.locator('[data-p="balance"]').click();assert.match(await page.locator('#balIncome').innerText(),/5.000/);
 await page.locator('[data-p="home"]').click();await page.locator('#openPayments').click();await page.locator('#paymentName').fill('Elektrik');await page.locator('#paymentAmount').fill('500');await page.locator('#paymentForm button[type="submit"]').click();assert.match(await page.locator('#paymentItems').innerText(),/Elektrik/);
 await page.locator('[data-p="receipts"]').click();await page.waitForFunction(()=>!document.getElementById('receiptUpload').hidden && !document.getElementById('receiptCamera').disabled);
 const file={name:'receipt.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jwz8AAAAASUVORK5CYII=','base64')};
 await page.locator('#receiptGalleryFile').setInputFiles(file);await page.waitForFunction(()=>document.getElementById('receiptMerchant').value==='Migros' && !document.getElementById('receiptConfirm').disabled);
 // Reading alone must not add an expense. Correct a total before confirmation.
 assert.equal(await page.evaluate(()=>window.__mock.rows[0].status),'analyzed');
 assert.match(await page.locator('#mt').innerText(),/175,50/);
 await page.locator('#receiptAmount').fill('1300');await page.locator('#receiptConfirm').click();await page.waitForFunction(()=>window.__mock.rows[0].status==='confirmed' && !document.getElementById('receiptConfirm').disabled);
 assert.match(await page.locator('#mt').innerText(),/1.475,50/);
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('harcama_ios_v2')).length),2);
 assert.equal(await page.evaluate(()=>localStorage.getItem('harcama_ios_v2').includes('receipt:')),false);
 // Repeat the same bytes: no second row and no second paid AI request.
 await page.locator('#receiptGalleryFile').setInputFiles(file);await page.waitForFunction(()=>document.getElementById('receiptStatus').textContent.includes('zaten kayıtlı'));
 assert.equal(await page.evaluate(()=>window.__mock.rows.length),1);assert.equal(await page.evaluate(()=>window.__mock.ocrCalls),1);
 await page.locator('[data-p="list"]').click();await page.locator('[data-receipt-id]').click();await page.waitForFunction(()=>!document.getElementById('receiptEditor').hidden&&!document.getElementById('receiptConfirm').disabled);
 await page.locator('#receiptView').click();await page.waitForFunction(()=>!document.getElementById('receiptViewer').hidden);await page.locator('#receiptViewerClose').click();
 await page.locator('#receiptNote').fill('<img src=x onerror=alert(1)>');await page.locator('#receiptAmount').fill('1400');await page.locator('#receiptConfirm').click();await page.waitForFunction(()=>window.__mock.rows[0].amount===1400&&!document.getElementById('receiptConfirm').disabled);assert.match(await page.locator('#mt').innerText(),/1.575,50/);assert.equal(await page.locator('#receiptList img').count(),0);
 // A second photo survives OCR failure and can be retried without reuploading.
 await page.evaluate(()=>window.__mock.failOCR=true);
 await page.locator('#receiptGalleryFile').setInputFiles({...file,name:'second.png',buffer:Buffer.concat([file.buffer,Buffer.from('different')])});
 await page.waitForFunction(()=>document.getElementById('receiptStatus').textContent.includes('otomatik okuma tamamlanamadı'));
 assert.equal(await page.evaluate(()=>window.__mock.rows.length),2);assert.equal(await page.evaluate(()=>Object.keys(window.__mock.files).length),2);
 await page.evaluate(()=>window.__mock.failOCR=false);await page.locator('#receiptAnalyze').click();await page.waitForFunction(()=>window.__mock.rows[0].status==='analyzed'&&!document.getElementById('receiptConfirm').disabled);
 // Tiny phone layouts must not spill horizontally.
 for(const width of [320,390,768]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);}
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'receipts-preview.png',fullPage:true});
 page.on('dialog',d=>d.accept());await page.locator('[data-receipt-delete]').first().click();await page.waitForFunction(()=>window.__mock.rows.length===1&&!document.getElementById('receiptCamera').disabled);
 await page.locator('#receiptSignout').click();await page.waitForFunction(()=>!document.getElementById('receiptAuth').hidden);assert.match(await page.locator('#mt').innerText(),/175,50/);assert.equal(await page.locator('#receiptPreview').getAttribute('src'),null);
 assert.deepEqual(errors,[]);
 await context.close();
 // No cloud config: original app remains fully usable and receipt setup is explicit.
 const plain=await browser.newContext({serviceWorkers:'block'});const pp=await plain.newPage();pp.on('pageerror',e=>errors.push(e.message));await pp.goto('http://127.0.0.1:8765');await pp.locator('[data-p="receipts"]').click();assert.equal(await pp.locator('#receiptSetup').isVisible(),true);await pp.locator('[data-p="add"]').click();assert.equal(await pp.locator('#f').isVisible(),true);assert.deepEqual(errors,[]);await plain.close();
 console.log('PASS: manual expense/income/payments, receipt upload/review/confirm/edit/view, duplicate prevention, OCR retry, XSS escaping, signout, unconfigured mode, mobile layouts, output validation.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
