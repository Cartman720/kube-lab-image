# kube-lab-image

<p>
  <a href="https://bun.sh"><img alt="Bun" src="https://img.shields.io/badge/Bun-1.x-000?logo=bun&logoColor=fff"></a>
  <a href="https://www.typescriptlang.org/"><img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=fff"></a>
  <a href="https://fastify.dev/"><img alt="Fastify" src="https://img.shields.io/badge/Fastify-4.x-000000?logo=fastify&logoColor=white"></a>
  <a href="https://www.docker.com/"><img alt="Docker" src="https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white"></a>
  <a href="https://kubernetes.io/"><img alt="Kubernetes" src="https://img.shields.io/badge/Kubernetes-lab-326CE5?logo=kubernetes&logoColor=white"></a>
</p>

Simple Bun-based HTTP server for Kubernetes learning.

## Purpose

I often need to show how things work live in a cluster. I made this image so I can run it anywhere and clearly demonstrate a few basics: how Services send traffic, how readiness and liveness probes affect rollouts, and what happens when some replicas are unhealthy.

There are other demo images, but many don’t include health probes with delays or a small page to see what the pod is doing. This one does. It starts quickly and has no extra dependencies.

If you want a simple, friendly hello example, I recommend [paulbouwer/hello-kubernetes](https://github.com/paulbouwer/hello-kubernetes). It’s great for quick demos. When I need probe timing and a small UI to watch readiness and traffic behavior, I use this image.

This project is that “observable lab.” It intentionally includes probe delays, a simple HTML dashboard, and a JSON API so you can see what Kubernetes is doing as it happens. It’s simple, fast to start, and has no external dependencies.

## What's inside

- Probes: `/healthz`, `/readyz`, `/livez` with randomized startup delays between 15–60s (per probe)
- Static page at `/` showing Kubernetes details (Pod, Node, Service, Cluster) and app/container info
- JSON info endpoint: `/info`

## Examples

- Service routing and failover
  - Run several replicas and send requests to the Service. See how traffic spreads.
  - While some pods fail `/readyz`, check that only ready pods get traffic.

- Probe timing and rollouts
  - Use the 15–60s randomized delay to act like a slow start. Watch `/healthz` and `/readyz` move from 503 to 200.
  - Change probe settings (initialDelaySeconds, periodSeconds, timeoutSeconds, failureThreshold, successThreshold) and see how rollouts change.

- Resilience
  - Delete a pod and see traffic continue to the others.
  - Scale up and down and watch how the Service behaves.

- Environment details
  - Add Downward API env vars to show Pod, Namespace, and Node on the page.
  - Check that the namespace from the service account file is read inside the cluster.

## Dev

```bash
bun install
bun run dev
```

Server runs on `http://localhost:8080` by default (override with `PORT`).

## Build Docker image

```bash
docker build -t kube-lab-image:local .
```

Run locally:

```bash
docker run --rm -p 8080:8080 \
  -e PORT=8080 \
  --name kube-lab kube-lab-image:local
```

Open `http://localhost:8080`.

## Kubernetes Notes

The HTML page and `/info` endpoint attempt to read Kubernetes metadata from common sources:

- Environment variables: `HOSTNAME`, `POD_NAME`, `POD_NAMESPACE`, `NODE_NAME`, `SERVICE_NAME`, `CLUSTER_NAME`, `KUBERNETES_SERVICE_HOST`, `KUBERNETES_PORT`.
- ServiceAccount namespace file: `/var/run/secrets/kubernetes.io/serviceaccount/namespace`.

To ensure values are populated, add Downward API env vars in your Pod spec, for example:

```yaml
env:
  - name: POD_NAME
    valueFrom:
      fieldRef:
        fieldPath: metadata.name
  - name: POD_NAMESPACE
    valueFrom:
      fieldRef:
        fieldPath: metadata.namespace
  - name: NODE_NAME
    valueFrom:
      fieldRef:
        fieldPath: spec.nodeName
```

Probes are exposed at:

- `/healthz`
- `/readyz`
- `/livez`

Each probe will return HTTP 503 until its randomized startup delay (15–60s) elapses, then return 200. Response body includes remaining seconds to assist with testing failovers.

## Project Structure

```
kube-lab-image/
├── Dockerfile
├── bun.config.ts
├── src/
│   ├── server.ts
│   └── probes.ts
├── public/
│   └── index.html
├── package.json
└── README.md
```

