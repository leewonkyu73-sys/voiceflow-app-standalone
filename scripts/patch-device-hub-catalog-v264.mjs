import fs from 'node:fs/promises';
const file=new URL('../services/integration-hub-bridge-service.mjs',import.meta.url);
let s=await fs.readFile(file,'utf8');
if(!s.includes('device_tapjoin')){
  const re=/total_erp:\{secret:\['ERP_API_TOKEN'\],config:\['ERP_API_BASE'\]\}(,?)/;
  if(!re.test(s))throw new Error('hub_catalog_anchor_missing');
  s=s.replace(re,"total_erp:{secret:['ERP_API_TOKEN'],config:['ERP_API_BASE']},\n  device_tapjoin:{secret:[],config:['DEVICE_NEARBY_ENABLED','NFC_TAPJOIN_ENABLED','TAPJOIN_TTL_MINUTES','TAPJOIN_CARD_MODE','DEVICE_NATIVE_BRIDGE_SCHEME']}");
}
await fs.writeFile(file,s,'utf8');
console.log('Integration Hub catalog includes device_tapjoin');
