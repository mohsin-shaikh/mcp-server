# Releasing @zuupee/mcp-server

This project follows [Semantic Versioning](https://semver.org/).

## Pre-release checklist

1. Ensure `main` is green: `pnpm test && pnpm lint && pnpm typecheck`
2. Update `CHANGELOG.md` (move Unreleased items to a new version section)
3. Bump version in `package.json`
4. Commit: `chore: release vX.Y.Z`

## Publish to npm

```bash
pnpm install
pnpm test
npm login
npm publish --access public
```

`prepublishOnly` runs build and tests automatically.

## Tag the release

```bash
git tag vX.Y.Z
git push origin vX.Y.Z
```

Create a GitHub release from the tag and paste the changelog section.

## Docker (optional)

```bash
pnpm docker:build
docker tag zuupee/mcp-server:local zuupee/mcp-server:X.Y.Z
docker push zuupee/mcp-server:X.Y.Z
```

## Version guidance

| Change                                             | Bump  |
| -------------------------------------------------- | ----- |
| Breaking MCP module API or config removals         | MAJOR |
| New modules, tools, env vars (backward compatible) | MINOR |
| Bug fixes, docs, internal refactors                | PATCH |
