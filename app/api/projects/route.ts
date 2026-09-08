import { listProjects } from "@/lib/projects";
import { handleApi, json } from "@/lib/admin-http";
export const dynamic = "force-dynamic";
export const GET = handleApi(async () => json(await listProjects()));
