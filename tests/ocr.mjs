import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {parseText}=createRequire(import.meta.url)('../receipt-ocr.js');
const a=parseText(`MİGROS TİCARET A.Ş.
TARİH: 16.10.2026 SAAT: 17:30
SÜT %1 *85,50
BEBEK BEZİ %20 *1.199,00
ARA TOPLAM *1.100,00
TOPLAM KDV *184,50
TOPLAM *1.284,50 TL
NAKİT *2.000,00
PARA ÜSTÜ *715,50`);
assert.equal(a.merchant,'MİGROS TİCARET A.Ş.');assert.equal(a.amount,1284.50);assert.equal(a.receipt_date,'2026-10-16');assert.equal(a.category,'Market');assert.equal(a.payment,'Nakit');assert.equal(a.products.length,2);assert.equal(a.products[1].name,'BEBEK BEZİ');assert.equal(a.products[1].total,1199);
assert.equal(parseText('MAGAZA\nTOPLAM\n*1.284,50 TL').amount,1284.5);
assert.equal(parseText('MAGAZA\nTOPLAM *1,284.50 TL').amount,1284.5);
assert.equal(parseText('MAGAZA\nTOPLAM *1234,56 TL').amount,1234.56);
assert.equal(parseText('MAGAZA\nTOPLAM *1 284,50 TL').amount,1284.5);
assert.equal(parseText('MAGAZA\nTOPLAM *100,00\nGENEL TOPLAM *120,00').amount,null);
assert.equal(parseText('MAGAZA\nARA TOPLAM *100,00\nTOPLAM KDV *20,00\nNAKIT *200,00\nPARA USTU *80,00').amount,null);
assert.equal(parseText('MAGAZA\nTOPLAM *120,00 TL\nTOTAL *120,00 TL').amount,120);
assert.equal(parseText('MAGAZA\nTARIH 31.02.2026\nTOPLAM *10,00').receipt_date,null);
assert.equal(parseText('MAGAZA\nTARIH 16/10/26\nTOPLAM *10,00').receipt_date,'2026-10-16');
assert.equal(parseText('MAGAZA\nTARIH 16.10.2026\nSON ODEME 17.10.2026').receipt_date,null);
assert.equal(parseText('ECZANE\nTOPLAM *20,00 TL').category,'Sağlık');
assert.equal(parseText('OPET\nTOPLAM *200,00 TL').category,'Yakıt');
assert.equal(parseText('MAGAZA\nTOPLAM *20,00 USD').currency,'USD');
assert.equal(parseText('MAGAZA\nTOPLAM *20,00').currency,null);
assert.ok(parseText('',30).warnings.some(w=>w.includes('net okunamadı')));
assert.equal(parseText('MAGAZA\n2 x SUT %1 *40,00\nTOPLAM *40,00 TL').products[0].quantity,2);
assert.ok(parseText('MARKET\nSUT *20,00\nTOPLAM *30,00 TL').warnings.some(w=>w.includes('Ürün toplamı')));
assert.equal(parseText('MARKET\nIADE SUT -20,00\nTOPLAM *30,00 TL').products.length,0);
console.log('PASS: Turkish/English money, spaced thousands, dates, products, categories, subtotal/tax/cash/change exclusion, ambiguous totals, low-confidence warnings.');
