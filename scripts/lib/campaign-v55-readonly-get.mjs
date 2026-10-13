/** Four bounded attempts for idempotent GET/body reads only. No validation
 * assertion, archive/hash mismatch, permission error or unknown data is waived. */
export function transientReadError(error){
 const codes=new Set(['UND_ERR_SOCKET','UND_ERR_CONNECT_TIMEOUT','UND_ERR_HEADERS_TIMEOUT','UND_ERR_BODY_TIMEOUT','ECONNRESET','ETIMEDOUT','EAI_AGAIN']);
 for(let value=error;value;value=value.cause)if(codes.has(value.code)||['TimeoutError','AbortError'].includes(value.name))return true;
 return /Actual provider GET failed: .* (?:429|500|502|503|504)$/.test(error?.message||'');
}
export async function retryReadonlyGet(operation,{wait=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}){
 for(let attempt=0;attempt<4;attempt++)try{return await operation();}catch(error){if(attempt===3||!transientReadError(error))throw error;await wait(1000*2**attempt);}
}
