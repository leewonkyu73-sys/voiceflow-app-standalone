export function claimCaptionRequest(captions,row,{limit=5000}={}){
  const current=Array.isArray(captions)?captions:[];
  const clientId=String(row?.client_id||'').trim();
  if(clientId){
    const existing=current.find(item=>item?.meeting_id===row.meeting_id&&item?.client_id===clientId);
    if(existing){
      return {
        kind:String(existing.text||'')===String(row.text||'')?'replay':'conflict',
        data:current,
        row:existing,
      };
    }
  }
  return {kind:'created',data:[...current,row].slice(-limit),row};
}
