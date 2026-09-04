import { NextRequest, NextResponse } from 'next/server';
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get('audio') as Blob;
  if(!file) return NextResponse.json({error:'no audio'}, {status:400});
  return NextResponse.json({ text: '안녕하세요 do 앱 테스트입니다. (Whisper 연결 전 mock)', lang: 'ko' });
}
