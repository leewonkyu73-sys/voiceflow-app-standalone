#!/usr/bin/env sh
set -eu

IMAGE='ghcr.io/ggml-org/whisper.cpp@sha256:479a53894c39c912bec0e06c010313602f070bfef6ac6ca26e143b61a54b2b3b'
PORT=$((4300 + ${GITHUB_RUN_NUMBER:-0} % 200))
NAME="voiceflow-vad-test-${GITHUB_RUN_ID:-local}-$$"
TMP_DIR=$(mktemp -d /tmp/voiceflow-vad.XXXXXX)

cleanup(){
  docker rm -f "$NAME" >/dev/null 2>&1 || true
  find "$TMP_DIR" -mindepth 1 -delete 2>/dev/null || true
  rmdir "$TMP_DIR" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

if ss -ltn | awk '{print $4}' | grep -q ":${PORT}$"; then
  echo "test port ${PORT} is already in use"
  exit 1
fi

TMP_DIR="$TMP_DIR" node --input-type=module <<'NODE'
import fs from 'node:fs';
import path from 'node:path';

const sampleRate=16000,sampleCount=sampleRate*3;
function writeWav(name,sampleAt){
  const out=Buffer.alloc(44+sampleCount*2);
  out.write('RIFF',0);out.writeUInt32LE(out.length-8,4);out.write('WAVE',8);
  out.write('fmt ',12);out.writeUInt32LE(16,16);out.writeUInt16LE(1,20);
  out.writeUInt16LE(1,22);out.writeUInt32LE(sampleRate,24);out.writeUInt32LE(sampleRate*2,28);
  out.writeUInt16LE(2,32);out.writeUInt16LE(16,34);out.write('data',36);out.writeUInt32LE(sampleCount*2,40);
  for(let i=0;i<sampleCount;i+=1)out.writeInt16LE(sampleAt(i),44+i*2);
  fs.writeFileSync(path.join(process.env.TMP_DIR,name),out);
}
writeWav('silence.wav',()=>0);
let seed=0x45f10a,pink=0;
writeWav('noise.wav',()=>{
  seed=(seed*1664525+1013904223)>>>0;
  const white=(seed/0xffffffff)*2-1;
  pink=0.92*pink+0.08*white;
  return Math.max(-98,Math.min(98,Math.round(pink*420)));
});
NODE

docker run -d --name "$NAME" --network host -v "$TMP_DIR:/models" "$IMAGE"   "./models/download-ggml-model.sh tiny /models && ./models/download-vad-model.sh silero-v6.2.0 /models && ffmpeg -loglevel error -ss 0 -t 2.2 -i ./samples/jfk.wav -ar 16000 -ac 1 -c:a libopus -b:a 16k -application voip -y /models/speech.webm && whisper-server --host 127.0.0.1 --port ${PORT} --model /models/ggml-tiny.bin --threads 2 --convert --vad-model /models/ggml-silero-v6.2.0.bin" >/dev/null

ready=0
for _ in $(seq 1 90); do
  if curl -fsS "http://127.0.0.1:${PORT}/" >/dev/null 2>&1; then ready=1; break; fi
  sleep 2
done
if [ "$ready" != "1" ]; then
  docker logs "$NAME" 2>&1 || true
  echo 'VAD whisper server did not become ready'
  exit 1
fi

for sample in silence noise; do
  response=$(curl -fsS "http://127.0.0.1:${PORT}/inference"     -F "file=@$TMP_DIR/${sample}.wav;type=audio/wav"     -F 'response_format=json'     -F 'language=ko'     -F 'temperature=0'     -F 'vad=true'     -F 'vad_threshold=0.50'     -F 'vad_min_speech_duration_ms=250'     -F 'vad_min_silence_duration_ms=100'     -F 'vad_speech_pad_ms=30')
  SAMPLE="$sample" RESPONSE="$response" node --input-type=module -e "
    const data=JSON.parse(process.env.RESPONSE||'{}');
    const text=String(data.text||'').trim();
    if(text){console.error(JSON.stringify({sample:process.env.SAMPLE,text}));process.exit(1)}
    console.log(JSON.stringify({sample:process.env.SAMPLE,text:'',pass:true}));
  "
done

speech_response=$(curl -fsS "http://127.0.0.1:${PORT}/inference"     -F "file=@$TMP_DIR/speech.webm;type=audio/webm"     -F 'response_format=json'     -F 'language=en'     -F 'temperature=0'     -F 'vad=true'     -F 'vad_threshold=0.50'     -F 'vad_min_speech_duration_ms=250'     -F 'vad_min_silence_duration_ms=100'     -F 'vad_speech_pad_ms=30')
SAMPLE='speech' RESPONSE="$speech_response" node --input-type=module -e "
  const data=JSON.parse(process.env.RESPONSE||'{}');
  const text=String(data.text||'').trim();
  if(!text){console.error(JSON.stringify({sample:process.env.SAMPLE,text,pass:false}));process.exit(1)}
  console.log(JSON.stringify({sample:process.env.SAMPLE,text,pass:true}));
"

echo 'VOICEFLOW_LOCAL_STT_VAD_RUNTIME_PASS'
