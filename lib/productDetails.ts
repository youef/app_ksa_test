export function parseProductDetails(value: unknown): {body:string;specs:{label:string;value:string}[]} {
 const text=typeof value==='string'?value:'';
 const marker='\n\nتفاصيل المنتج\n',offset=text.lastIndexOf(marker);
 if(offset<0)return {body:text,specs:[]};
 const allowed=new Set(['التصنيف','الحالة','العلامة التجارية','الموديل','المقاسات','الاستلام']);
 const lines=text.slice(offset+marker.length).split('\n').filter(Boolean);
 const specs=lines.map(line=>{const colon=line.indexOf(':');return {label:line.slice(0,colon).trim(),value:line.slice(colon+1).trim()};});
 if(!specs.length || specs.some(x=>!allowed.has(x.label)||!x.value))return {body:text,specs:[]};
 return {body:text.slice(0,offset),specs};
}
export function productDisplayPrice(price:unknown,kind:unknown):string{
 if(kind==='تبرع')return 'مجاني';
 if(price===null||price===undefined||price==='')return 'السعر بالتفاوض';
 const amount=Number(price);if(!Number.isFinite(amount)||amount<0)return 'تواصل لمعرفة السعر';
 return new Intl.NumberFormat('ar-SA',{style:'currency',currency:'SAR',maximumFractionDigits:2}).format(amount);
}
