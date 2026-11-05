# React frontend component

This folder contains the static React/Vite frontend for the
[React + Express sample](../README.md). Use the repository root as the Builder
source directory so the sibling Express API is included in the deployment.

From this folder:

```sh
npm ci --ignore-scripts
npm run lint
npm run build
npm run preview -- --host 127.0.0.1 --port 8080 --strictPort
```

The API must also be running for the status card and `/api` links to work.
Local Vite development and preview proxy `/api` to `http://127.0.0.1:18089`.
Set `API_PROXY_TARGET` before starting Vite if the API uses another address.
The browser still calls relative `/api` URLs.

`dist/` is the production static output; neither Vite server is deployed.
See the [root README](../README.md) for running both components, integration
tests, deployment, and cleanup.
