export type MarketPriceBand='all'|'under100'|'100to500'|'over500';
/** Leave room for fractional web viewports rounded by React Native's dimensions. */
export function marketGridLayout(width:number){
 const contentWidth=Math.max(0,Math.floor(Math.min(Number.isFinite(width)?width:320,1100))-34),gap=12;
 const columns=contentWidth<280?1:contentWidth>900?4:contentWidth>600?3:2;
 return {contentWidth,columns,gap,cardWidth:Math.max(0,Math.floor((contentWidth-gap*(columns-1))/columns))};
}
export function marketPrice(item:{price_from?:unknown;price_type?:string|null}):number|null {
 if(item.price_type==='negotiable'||item.price_from==null||item.price_from==='')return null;
 const value=Number(item.price_from);return Number.isFinite(value)&&value>=0?value:null;
}
export function matchesMarketPrice(item:Parameters<typeof marketPrice>[0],band:MarketPriceBand):boolean {
 if(band==='all')return true;const value=marketPrice(item);if(value===null)return false;
 return band==='under100'?value<100:band==='100to500'?value>=100&&value<=500:value>500;
}
export function compareMarketPrices(a:Parameters<typeof marketPrice>[0],b:Parameters<typeof marketPrice>[0],descending=false):number {
 const left=marketPrice(a),right=marketPrice(b);
 if(left===null)return right===null?0:1;if(right===null)return -1;
 return descending?right-left:left-right;
}
