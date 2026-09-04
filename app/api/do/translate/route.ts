import { NextRequest, NextResponse } from 'next/server';
export async function POST(req: NextRequest) {
  const { text, target } = await req.json();
  return NextResponse.json({ translated: `[${target}] ${text} (번역 mock)`, target });
}
