/** Review editions are selected by an actual separate entry/build, never by
 * an ordinary player's query string. Keep harmless diagnostics and a room
 * bookmark; the progression gate still validates that bookmark before init. */
export function normalizePlayerCampaignQuery(value,{development=false,reviewEntry=false}={}){
 const query=new URLSearchParams(value);
 if(!development&&!reviewEntry){
  query.set('edition','foundation');
  for(const name of ['tower41preview','tower41ratchet','pilot'])query.delete(name);
 }
 return query;
}
