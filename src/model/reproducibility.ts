/** Strict finite JSON; array order is significant, object key order is not. */
export function canonicalStringify(value: unknown): string {
  const parents=new Set<object>();
  function visit(item: unknown): string {
    if(item===null || typeof item==='boolean' || typeof item==='string') return JSON.stringify(item);
    if(typeof item==='number') {
      if(!Number.isFinite(item)) throw new TypeError('Canonical JSON requires finite numbers');
      return JSON.stringify(item);
    }
    if(typeof item!=='object' || item===null) throw new TypeError('Canonical JSON requires JSON values');
    if(parents.has(item)) throw new TypeError('Canonical JSON cannot contain cycles');
    parents.add(item);
    let output:string;
    if(Array.isArray(item)) output='['+Array.from(item,visit).join(',')+']';
    else {
      const prototype=Object.getPrototypeOf(item);
      if(prototype!==Object.prototype && prototype!==null) throw new TypeError('Canonical JSON requires plain objects');
      const obj=item as Record<string,unknown>;
      output='{'+Object.keys(obj).sort().map(key=>JSON.stringify(key)+':'+visit(obj[key])).join(',')+'}';
    }
    parents.delete(item); return output;
  }
  return visit(value);
}

export async function hashValue(value: unknown): Promise<string> {
  const bytes=new TextEncoder().encode(canonicalStringify(value));
  const digest=await globalThis.crypto.subtle.digest('SHA-256',bytes);
  return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
}
