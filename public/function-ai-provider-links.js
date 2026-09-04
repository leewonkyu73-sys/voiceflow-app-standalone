(()=>{
  const MAP={
    openai:'openai',
    gemini:'gemini',
    claude:'claude',
    deepl:'deepl',
    google_speech:'google_speech',
    elevenlabs:'elevenlabs',
    azure_speech:'azure_speech',
    google_vision:'google_vision'
  };
  function addButtons(){
    document.querySelectorAll('#providerStrip .p').forEach(card=>{
      if(card.querySelector('.provider-setup-link'))return;
      const title=card.querySelector('b')?.textContent||'';
      const id=Object.keys(MAP).find(k=>{
        const names={openai:'OpenAI',gemini:'Gemini',claude:'Claude',deepl:'DeepL',google_speech:'Google Speech',elevenlabs:'ElevenLabs',azure_speech:'Azure Speech',google_vision:'Google Vision'};
        return names[k]===title;
      });
      if(!id)return;
      const a=document.createElement('a');
      a.className='provider-setup-link';
      a.href=`/admin-integrations.html?provider=${encodeURIComponent(MAP[id])}`;
      a.textContent='설정 바로가기 →';
      a.style.cssText='display:inline-block;margin-top:9px;font-size:12px;font-weight:800;color:#2563eb;text-decoration:none';
      card.appendChild(a);
    });
  }
  const obs=new MutationObserver(addButtons);
  obs.observe(document.documentElement,{childList:true,subtree:true});
  addButtons();
})();