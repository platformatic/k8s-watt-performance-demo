import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// `process.env.__NEXT_SSRT` is inlined as a boolean literal at build time by the
// ssrt-next define-env step, so this reports whether the running bundle was
// built with `experimental.ssrTemplates`. The benchmark harness uses it to
// abort when the deployed image does not match the requested arm.
export async function GET() {
  const ssrt = (process.env.__NEXT_SSRT as unknown) === true;
  return NextResponse.json({ ssrt });
}
