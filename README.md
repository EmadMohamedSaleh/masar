# Qoder Sites React starter

A React, TypeScript, Vite and Tailwind frontend with a bundled Shadcn component catalog. Vite produces static files in `dist/`. Server behavior belongs in the optional Qoder Sites Function, not a Node or framework server.

## Develop

Use Node 22.12 or later in the 22.x series:

```sh
npm ci
npm run dev
```

Use the loopback URL printed by Vite. Edit `src/App.tsx`, `src/globals.css` and the title/description in `index.html`. Replace the sample page with the requested product before presenting a first meaningful preview. Import existing UI primitives from `@/components/ui/<component>` and compose them for the site's design. The neutral starter theme is a starting point, not the finished visual direction.

For production output:

```sh
npm run build
npm run preview
```

The build fixes `NODE_ENV=production` before loading Vite, independently of the terminal environment. It checks the frontend and bundled component types and emits `dist/index.html` and assets. `npm run preview` serves this output locally. Reuse passing checks while source is unchanged; no additional unit-test suite or browser QA is required by the template.

## Optional Function

The default page is entirely static and does not call a Function. For server behavior, adapt the public, credential-free example in `functions/handler.ts`. `functions/index.ts` is the Deno deployment entry point. With Deno installed, use a separate terminal:

```sh
npm run check:function
npm run dev:function
```

The local service binds to `127.0.0.1:8000`; Vite development and built preview proxy `/functions/v1/app` to it, preserving the path. For example:

```sh
curl --fail 'http://127.0.0.1:5173/functions/v1/app?name=Visitor'
```

Use Vite's actual port if it differs. The same frontend request after deployment is routed by Qoder Sites. Local proxy configuration is not production routing. Keep local-only servers and fixtures in `dev/`, outside both publication directories. The included Function has no dependencies; add self-contained runtime imports as required. Frontend npm dependencies are not automatically installed in Functions.

## Publish with Qoder Sites

Open a local conversation in this project and follow the `sites-hosting` skill. Workspace registration is optional. Use the directory returned by `get_local_context` with:

- `webDirectory: "dist"` after the build.
- `spa: false` for the default single page; use `true` when adding client-side deep routes that need fallback.
- `functionDirectory: "functions"` only if the application uses the Function. Omit it for static-only delivery.

The Sites tools prepare artifacts and generate the publication descriptor; publish completed hosted work by default, unless the user explicitly requests a preview first or defers publication. Do not upload the project root, `node_modules`, `dev`, or source as the web artifact. A successful build or release does not prove an external integration works.

For a database-backed React page, the installed `sites-building` Skill provides `assets/database-react/App.tsx` and a matching three-file database Function. Follow its `references/database.md` to connect the page, apply the reviewed schema and publish. These optional assets stay in the Skill rather than being copied into every static project.

For database or Storage, follow the corresponding `sites-building` references and `sites-management` capability workflow. For AI, follow `sites-build-agent-app` and keep Cloud Agents access in the Function. Application credentials belong in server-side Sites Settings; frontend environment variables are public. This starter does not implement visitor login, database permissions, Cloud resource coordination or QCA sessions; add those only for the requested feature using the existing skills.

See `PROVENANCE.md` and `vendor/` for source attribution and the preserved stylesheet license.
