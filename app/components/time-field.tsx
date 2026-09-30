'use client';
import { timeParts, secondsFromParts } from '@/lib/youtube';
export function TimeField({label,value,onChange}:{label:string;value:number;onChange:(value:number)=>void}){
 const parts=timeParts(value);
 return <fieldset className="time-field"><legend>{label}</legend><div>{(['hours','minutes','seconds'] as const).map((key,i)=><label key={key}><span className="sr-only">{label} {['hr','min','sec'][i]}</span><input aria-label={`${label} ${['hr','min','sec'][i]}`} type="number" inputMode={key==='seconds'?'decimal':'numeric'} min="0" max={key==='hours'?23:key==='seconds'?59.999:59} step={key==='seconds'?.1:1} value={parts[key]} onChange={e=>{const n=Number(e.target.value);if(!Number.isFinite(n)||n<0)return;const max=key==='hours'?23:key==='seconds'?59.999:59;onChange(secondsFromParts({...parts,[key]:Math.min(max,n)}));}}/><span>{['hr','min','sec'][i]}</span></label>)}</div></fieldset>;
}
