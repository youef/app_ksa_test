import {productRequestError} from './productRequestWorkflow';
export function productRequestTotal(price: unknown, quantity: number): number | null {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) throw new Error('اختر كمية من ١ إلى ٢٠.');
  if (price === null || price === undefined || price === '') return null;
  const number = Number(price);
  if (!Number.isFinite(number) || number < 0 || number > 9999999) throw new Error('تعذر التحقق من سعر المنتج.');
  return Math.round(number * 100) * quantity;
}

/** Creation, price validation, locality and idempotency are atomic on the server. */
export async function sendProductRequest(client:any,input:{itemId:string;requestId:string;quantity:number;note:string;expectedPrice:unknown;fulfillment?:string}){
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.requestId)||input.note.trim().length>400)throw new Error('راجع بيانات الطلب وأعد المحاولة.');
 productRequestTotal(input.expectedPrice,input.quantity);
 const {data,error}=await client.rpc('hayna_create_product_request',{p_request:input.requestId,p_item:input.itemId,p_quantity:input.quantity,p_note:input.note.trim(),p_fulfillment:input.fulfillment||'بالاتفاق مع البائع',p_expected_price:input.expectedPrice==null||input.expectedPrice===''?null:Number(input.expectedPrice)});
 if(error||!data?.conversationId)throw new Error(productRequestError(error));
 return {conversationId:data.conversationId,reused:data.reused===true};
}
