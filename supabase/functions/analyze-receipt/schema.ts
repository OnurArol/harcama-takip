export const categories = ['Market','Yemek','Yakıt','Fatura','Ev','Çocuk','Sağlık','Giyim','Eğlence','İş','Diğer'];
export const payments = ['Nakit','Kredi Kartı','Banka Kartı','Havale / EFT','Diğer'];
export const receiptSchema = {
 type:'object', additionalProperties:false,
 properties:{
  merchant:{type:['string','null']}, receipt_date:{type:['string','null']},
  amount:{type:['number','null']}, currency:{type:['string','null'],enum:['TRY','USD','EUR','OTHER',null]},
  category:{type:'string',enum:categories},payment:{type:'string',enum:payments},note:{type:'string'},
  products:{type:'array',items:{type:'object',additionalProperties:false,properties:{name:{type:'string'},quantity:{type:['number','null']},total:{type:['number','null']}},required:['name','quantity','total']}},
  warnings:{type:'array',items:{type:'string'}}
 },required:['merchant','receipt_date','amount','currency','category','payment','note','products','warnings']
};
export function validateReceipt(v:any){
 if(!v||typeof v!=='object'||!categories.includes(v.category)||!payments.includes(v.payment))throw new Error('Geçersiz okuma sonucu.');
 if(v.amount!==null && (typeof v.amount!=='number'||!Number.isFinite(v.amount)||v.amount<=0||v.amount>=1e12))v.amount=null;
 if(v.receipt_date!==null){const d=String(v.receipt_date);if(!/^\d{4}-\d{2}-\d{2}$/.test(d)||!Number.isFinite(Date.parse(d))||new Date(d).toISOString().slice(0,10)!==d)v.receipt_date=null;}
 v.merchant=typeof v.merchant==='string'?v.merchant.slice(0,120):null;
 v.note=typeof v.note==='string'?v.note.slice(0,500):'';
 if(![null,'TRY','USD','EUR','OTHER'].includes(v.currency))v.currency=null;
 if(!Array.isArray(v.products)||!Array.isArray(v.warnings))throw new Error('Geçersiz ürün listesi.');
 v.products=v.products.slice(0,200).map((p:any)=>({name:String(p.name||'').slice(0,160),quantity:typeof p.quantity==='number'&&Number.isFinite(p.quantity)&&p.quantity>0?p.quantity:null,total:typeof p.total==='number'&&Number.isFinite(p.total)&&p.total>=0?Math.round(p.total*100)/100:null})).filter((p:any)=>p.name.trim());
 v.warnings=v.warnings.filter((s:any)=>typeof s==='string').slice(0,20).map((s:string)=>s.slice(0,500));
 if(v.amount===null)v.warnings.push('Toplam okunamadı; fişten kontrol ederek gir.');
 if(v.receipt_date===null)v.warnings.push('Tarih okunamadı; fişten kontrol ederek gir.');
 if(v.currency!== 'TRY')v.warnings.push('Para birimi TL olarak doğrulanamadı; toplamı TL karşılığıyla kontrol et.');
 return v;
}
