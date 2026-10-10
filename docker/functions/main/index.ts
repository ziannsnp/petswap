// Main service of the compose stack's Edge Runtime (see docker-compose.yml).
//
// The runtime sends every request here; this routes /<name>/... to the function
// in supabase/functions/<name>/, which is how `supabase start` and the hosted
// platform address functions. It does not verify JWTs: supabase/config.toml sets
// verify_jwt = false for `sign-in`, the only function. A function that needs a
// verified caller must check the token itself or this router must learn to.

const FUNCTIONS_ROOT = '/home/deno/functions';
const functionNamePattern = /^[a-z0-9][a-z0-9_-]*$/;

Deno.serve(async (request: Request) => {
  const name = new URL(request.url).pathname.split('/')[1] ?? '';

  if (!functionNamePattern.test(name)) {
    return Response.json({ error: 'Missing or invalid function name.' }, { status: 400 });
  }

  const servicePath = `${FUNCTIONS_ROOT}/${name}`;
  try {
    await Deno.stat(`${servicePath}/index.ts`);
  } catch {
    return Response.json({ error: `Function "${name}" does not exist.` }, { status: 404 });
  }

  try {
    // @ts-ignore EdgeRuntime is a global provided by supabase/edge-runtime.
    const worker = await EdgeRuntime.userWorkers.create({
      servicePath,
      memoryLimitMb: 150,
      workerTimeoutMs: 60_000,
      noModuleCache: false,
      importMapPath: null,
      envVars: Object.entries(Deno.env.toObject()),
    });
    return await worker.fetch(request);
  } catch (error) {
    console.error(`Function "${name}" failed to start:`, error);
    return Response.json({ error: `Function "${name}" failed to start.` }, { status: 500 });
  }
});
