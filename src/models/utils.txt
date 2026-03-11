export function clamp(x:number, lo:number, hi:number){
  return Math.max(lo, Math.min(hi, x));
}

export function seeded(seed:number){
  let x = Math.sin(seed) * 10000;

  return () => {
    x = Math.sin(x) * 10000;
    return x - Math.floor(x);
  };
}