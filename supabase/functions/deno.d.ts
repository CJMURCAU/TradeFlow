// Ambient declarations so the Deno edge functions type-check cleanly even if a
// TypeScript build happens to include them (the app tsconfig excludes
// supabase/functions, but some CI checkout contexts still pick them up). These
// are types only — the real Deno runtime / module resolution is used at deploy.

declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

declare module "npm:*";
declare module "jsr:*";
