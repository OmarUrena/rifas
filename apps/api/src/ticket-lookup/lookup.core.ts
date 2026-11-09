/** Exact phone matching. Only the explicit Dominican local forms gain +1. */
export function normalizeLookupPhone(input:string):string|undefined {
  let phone=input.trim().replace(/[\s().-]/g,'');
  if(/^(809|829|849)[0-9]{7}$/.test(phone))phone='+1'+phone;
  else if(/^1(809|829|849)[0-9]{7}$/.test(phone))phone='+'+phone;
  return /^\+[1-9][0-9]{7,14}$/.test(phone)?phone:undefined;
}
/** Hide at least half, including every character of one-character values. */
export function maskHalf(input:string):string {
  const chars=Array.from(input.trim());
  const visible=Math.floor(chars.length/2);
  return chars.slice(0,visible).join('')+'*'.repeat(chars.length-visible);
}
export function maskLookupEmail(email:string|null):string|null {
  if(!email?.trim())return null;
  const value=email.trim(),at=value.lastIndexOf('@');
  if(at<1||at===value.length-1)return '***';
  return maskHalf(value.slice(0,at))+'@'+maskHalf(value.slice(at+1));
}
