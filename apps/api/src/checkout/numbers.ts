import { randomInt } from 'node:crypto';

/** Uniform sampling without replacement from free ranks, then mapping ranks to gaps.
 * No rejection loop near exhaustion and no materialization of the whole universe.
 * The caller holds the raffle lock until numbers have been persisted as HELD.
 */
export function chooseNumbers(total:number,blocked:readonly number[],quantity:number,random:(max:number)=>number=randomInt):number[] {
  const gaps:{start:number;count:number;endRank:number}[]=[];
  let start=0,free=0;
  for(const number of blocked){
    if(number<start||number>=total)throw new Error('Invalid occupied inventory');
    if(number>start){free+=number-start;gaps.push({start,count:number-start,endRank:free});}
    start=number+1;
  }
  if(start<total){free+=total-start;gaps.push({start,count:total-start,endRank:free});}
  if(quantity<0||quantity>free)throw new Error('Insufficient free numbers');
  const swaps=new Map<number,number>(),chosen:number[]=[];
  for(let i=0;i<quantity;i++){
    const remaining=free-i,index=random(remaining),rank=swaps.get(index)??index;
    swaps.set(index,swaps.get(remaining-1)??remaining-1);swaps.delete(remaining-1);
    let lo=0,hi=gaps.length-1;
    while(lo<hi){const mid=(lo+hi)>>>1;if(rank<gaps[mid]!.endRank)hi=mid;else lo=mid+1;}
    const gap=gaps[lo]!;
    chosen.push(gap.start+rank-(gap.endRank-gap.count));
  }
  return chosen;
}
