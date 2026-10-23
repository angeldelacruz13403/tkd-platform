import { GET as baseGET, POST as basePOST } from "../route";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return baseGET(request);
}

export async function POST(request: Request) {
  return basePOST(request);
}
