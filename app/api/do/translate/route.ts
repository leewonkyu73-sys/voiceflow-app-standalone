import { NextRequest, NextResponse } from 'next/server';
export async function POST(req: NextRequest) {
  try {
    const { text, target } = await req.json();
    return NextResponse.json({ translated: `[${target}] ${text}`, target });
  } catch {
    return NextResponse.json({ translated: 'mock 번역' });
  }
}
