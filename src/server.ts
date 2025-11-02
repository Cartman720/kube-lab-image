import { createProbeManager } from "./probes";
import * as fs from "fs";
import * as path from "path";
import os from "os";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";

const probeManager = createProbeManager({
  minDelaySeconds: 15,
  maxDelaySeconds: 60,
});

const port = Number(process.env.PORT || 8080);
const publicDir = path.resolve(process.cwd(), "public");

async function readNamespace(): Promise<string | undefined> {
  const nsPath = "/var/run/secrets/kubernetes.io/serviceaccount/namespace";
  try {
    const ns = await fs.promises.readFile(nsPath, "utf-8");
    return ns.trim();
  } catch {
    return undefined;
  }
}

/**
 * Get the network addresses of the system.
 * @returns The network addresses of the system in the format { interfaceName: string; addresses: string[] }.
 */
function getNetworkAddresses(): {
  interfaceName: string;
  addresses: string[];
}[] {
  const nets = os.networkInterfaces();
  const result: { interfaceName: string; addresses: string[] }[] = [];
  for (const [name, infos] of Object.entries(nets)) {
    if (!infos) continue;
    const addresses = infos
      .filter((i) => i.family === "IPv4" && !i.internal)
      .map((i) => i.address);
    if (addresses.length > 0) result.push({ interfaceName: name, addresses });
  }
  return result;
}

const app = Fastify({ logger: false });

// Static files
await app.register(fastifyStatic, {
  root: publicDir,
  prefix: "/",
  index: ["index.html"],
});

// Probes
app.get("/healthz", async (_req: any, reply: any) => {
  const status = probeManager.getStatus("healthz");
  reply
    .code(status.ok ? 200 : 503)
    .type("application/json")
    .send({ status: status.ok ? "ok" : "unavailable", ...status });
});

app.get("/readyz", async (_req: any, reply: any) => {
  const status = probeManager.getStatus("readyz");
  reply
    .code(status.ok ? 200 : 503)
    .type("application/json")
    .send({ status: status.ok ? "ok" : "unavailable", ...status });
});

app.get("/livez", async (_req: any, reply: any) => {
  const status = probeManager.getStatus("livez");
  reply
    .code(status.ok ? 200 : 503)
    .type("application/json")
    .send({ status: status.ok ? "ok" : "unavailable", ...status });
});

// Info endpoint
app.get("/info", async (_req: any, reply: any) => {
  const namespace = await readNamespace();
  const env = process.env;

  const possibleEnvKeys = [
    "HOSTNAME",
    "POD_NAME",
    "POD_NAMESPACE",
    "NODE_NAME",
    "SERVICE_NAME",
    "CLUSTER_NAME",
    "KUBERNETES_SERVICE_HOST",
    "KUBERNETES_PORT_443_TCP_ADDR",
    "KUBERNETES_PORT",
  ];

  const collectedEnv: Record<string, string> = {};
  for (const key of possibleEnvKeys) {
    if (env[key]) collectedEnv[key] = env[key] as string;
  }

  reply.type("application/json").send({
    app: {
      name: "kube-lab-image",
      version: env.APP_VERSION || "dev",
      bun: Bun.version,
      nodeCompat: process.version,
      startedAt: new Date(
        probeManager.getStatus("healthz").since
      ).toISOString(),
      port,
    },
    probes: {
      healthz: probeManager.getStatus("healthz"),
      readyz: probeManager.getStatus("readyz"),
      livez: probeManager.getStatus("livez"),
    },
    kubernetes: {
      namespace: namespace || collectedEnv["POD_NAMESPACE"],
      podName: collectedEnv["POD_NAME"] || env["HOSTNAME"],
      nodeName: collectedEnv["NODE_NAME"],
      serviceName: collectedEnv["SERVICE_NAME"],
      clusterName: collectedEnv["CLUSTER_NAME"],
      api: {
        host: collectedEnv["KUBERNETES_SERVICE_HOST"],
        port:
          collectedEnv["KUBERNETES_PORT"] ||
          collectedEnv["KUBERNETES_PORT_443_TCP_ADDR"],
      },
    },
    container: {
      network: getNetworkAddresses(),
      pid: process.pid,
      platform: process.platform,
      arch: process.arch,
      envKeys: Object.keys(env).length,
    },
  });
});

// Start server
try {
  await app.listen({ port, host: "0.0.0.0" });
  console.log(`Server listening on http://localhost:${port}`);
} catch (err) {
  const e: unknown = err;
  const code = (e as { code?: string })?.code;

  switch (code) {
    case "EADDRINUSE":
      console.error(`Port ${port} is in use. Set PORT or free it.`);
      break;
    default:
      console.error("Failed to start server:", err);
      break;
  }

  process.exit(1);
}
