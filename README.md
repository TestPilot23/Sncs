# Stitches-n-Color Studio

Marketing site for Stitches-n-Color Embroidery Studio: Vite 8, React 19 and TypeScript, with a
contact-form Lambda and Terraform-managed AWS hosting.

- Live: https://stitchesncolorstudio.com
- Project notes, layout and conventions: [`claude.md`](claude.md)
- Infrastructure (Terraform, bootstrap, tests): [`infrastructure/README.md`](infrastructure/README.md)
- Design and decisions: `openspec/`

## Develop

```sh
npm install
npm run dev      # dev server
npm test         # full regression suite
npm run lint     # oxlint
npm run build    # typecheck + production build
```

## Release

Push to the `release` branch. GitHub Actions verifies, plans, waits for approval in the `production`
environment, then applies, deploys to S3/CloudFront and smoke-tests the live site. To roll back,
release the previous good commit the same way. Details are in `claude.md`.
