'use client';
import { useState, useRef } from 'react';
export default function Page(){
  const [rec,setRec]=useState(false); const [blob,setBlob]=useState<Blob|null>(null);
  const [text,setText]=useState(''); const [tr,setTr]=useState('');
  const ref=useRef<MediaRecorder|null>(null); const ch=useRef<Blob[]>([]);
  const start=async()=>{const s=await navigator.mediaDevices.getUserMedia({audio:true}); ch.current=[]; const mr=new MediaRecorder(s); ref.current=mr; mr.ondataavailable=e=>ch.current.push(e.data); mr.onstop=()=>{setBlob(new Blob(ch.current,{type:'audio/webm'})); s.getTracks().forEach(t=>t.stop());}; mr.start(); setRec(true);};
  const stop=()=>{ref.current?.stop(); setRec(false);};
  const toText=async()=>{ if(!blob) return; const fd=new FormData(); fd.append('audio',blob,'rec.webm'); const r=await fetch('/api/do/transcribe',{method:'POST',body:fd}); const j=await r.json(); setText(j.text);};
  const toTrans=async(t:string)=>{ const r=await fetch('/api/do/translate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,target:t})}); const j=await r.json(); setTr(j.translated);};
  return(<div style={{padding:32,maxWidth:720,margin:'0 auto',fontFamily:'sans-serif'}}><h1 style={{fontSize:36,fontWeight:900}}>DO</h1><div style={{color:'#666',marginBottom:24}}>녹음 → 텍스트 → 번역 | do.ab80.net</div><button onClick={rec?stop:start} style={{padding:'18px 36px',background:rec?'#ef4444':'#000',color:'#fff',borderRadius:14,border:'none',fontSize:20,cursor:'pointer'}}>{rec?'● 중지':'● 녹음 시작'}</button>{blob&&<button onClick={toText} style={{marginLeft:12,padding:'18px 28px',borderRadius:14,border:'1px solid #000',cursor:'pointer',fontSize:16}}>텍스트 변환</button>}{text&&<div style={{marginTop:24,padding:16,background:'#f5f5f5',borderRadius:12}}><b>원문:</b> {text}<div style={{marginTop:12}}><button onClick={()=>toTrans('en')} style={{marginRight:8,padding:'8px 14px'}}>영어로</button><button onClick={()=>toTrans('vi')} style={{padding:'8px 14px'}}>베트남어로</button></div></div>}{tr&&<div style={{marginTop:16,padding:16,background:'#000',color:'#fff',borderRadius:12}}><b>번역:</b> {tr}</div>}</div>);
}
