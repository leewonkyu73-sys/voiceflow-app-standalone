import {LOCAL_WHISPER_PACK} from '../frontend-v4/packages/mobile-input-policy/index.mjs';

const suffixByDtype=Object.freeze({
  fp32:'',
  fp16:'_fp16',
  q4:'_q4',
  q8:'_quantized',
});

function modelAsset(moduleName,dtype){
  const suffix=suffixByDtype[dtype];
  if(suffix===undefined)throw new Error(`unsupported_dtype_${moduleName}_${dtype}`);
  return `onnx/${moduleName}${suffix}.onnx`;
}

const assets=[
  'config.json',
  'generation_config.json',
  'preprocessor_config.json',
  'tokenizer.json',
  'tokenizer_config.json',
  modelAsset('encoder_model',LOCAL_WHISPER_PACK.dtype.encoder_model),
  modelAsset('decoder_model_merged',LOCAL_WHISPER_PACK.dtype.decoder_model_merged),
];

const treeUrl=`https://huggingface.co/api/models/${LOCAL_WHISPER_PACK.modelId}/tree/${LOCAL_WHISPER_PACK.revision}?recursive=true&expand=false`;
const response=await fetch(treeUrl,{signal:AbortSignal.timeout(60_000)});
if(!response.ok)throw new Error(`local_whisper_tree_unavailable_${response.status}`);
const paths=new Set((await response.json()).map(item=>String(item.path||item.rfilename||'')));
for(const asset of assets){
  if(!paths.has(asset))throw new Error(`local_whisper_asset_missing_${asset}`);
  console.log(`LOCAL_WHISPER_ASSET_PASS ${asset}`);
}

console.log(`LOCAL_WHISPER_PACK_PASS ${LOCAL_WHISPER_PACK.modelId}@${LOCAL_WHISPER_PACK.revision}`);
