'use client';
import { useState, useRef } from 'react';
export default function DoPage() {
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob|null>(null);
  const [text, setText] = useState(''); const [translated, setTranslated] = useState('');
  const mediaRef = useRef<MediaRecorder|null>(null);
  const chunks = useRef<Blob[]>([]);
  const start = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    chunks.current = []; const mr = new MediaRecorder(stream); mediaRef.current = mr;
    mr.ondataavailable = e => chunks.current.push(e.data);
    mr.onstop = () => { setAudioBlob(new Blob(chunks.current, {type:'audio/webm'})); stream.getTracks().forEach(t=>t.stop()); };
    mr.start(); setRecording(true);
  };
  const stop = () => { mediaRef.current?.stop(); setRecording(false); };
  const handleTranscribe = async () => {
    if(!audioBlob) return; const fd = new FormData(); fd.append('audio', audioBlob, 'rec.webm');
    const r = await fetch('/api/do/transcribe', {method:'POST', body:fd}); const j = await r.json(); setText(j.text);
  };
  const handleTranslate = async (t: string) => {
    const r = await fetch('/api/do/translate', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({text, target:t})}); const j = await r.json(); setTranslated(j.translated);
  };
  return (
    <div style={{padding:32, maxWidth:720, margin:'0 auto', fontFamily:'sans-serif'}}>
      <h1 style={{fontSize:32, fontWeight:800}}>DO - 녹음 → 텍스트 → 번역</h1>
      <button onClick={recording?stop:start} style={{marginTop:24, padding:'16px 32px', background: recording?'#ef4444':'#000', color:'#fff', borderRadius:12, fontSize:18, border:'none', cursor:'pointer'}}>{recording ? '● 녹음 중지' : '● 녹음 시작'}</button>
      {audioBlob && <button onClick={handleTranscribe} style={{marginLeft:12, padding:'16px 24px', border:'1px solid #000', borderRadius:12}}>텍스트 변환</button>}
      {text && <div style={{marginTop:24, padding:16, background:'#f5f5f5', borderRadius:12}}><b>원문:</b> {text}<div style={{marginTop:12}}><button onClick={()=>handleTranslate('en')} style={{marginRight:8}}>영어로</button><button onClick={()=>handleTranslate('vi')}>베트남어로</button></div></div>}
      {translated && <div style={{marginTop:16, padding:16, background:'#000', color:'#fff', borderRadius:12}}><b>번역:</b> {translated}</div>}
    </div>
  );
}
