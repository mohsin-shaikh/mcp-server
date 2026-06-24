# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Plugin loader for local modules under `MCP_PLUGINS_DIR`
- OpenAPI module (`openapi_list_operations`, `openapi_call`)
- Optional OpenTelemetry metrics (`OTEL_ENABLED`)
- `pnpm create-module <id>` scaffolding for plugin modules
- Release process documentation (`docs/RELEASING.md`)

## [0.1.0] - 2026-06-21

### Added

- Core MCP server framework with stdio and Streamable HTTP transports
- Built-in modules: `meta`, `http`, `json`, `datetime`, `docs`, `filesystem`
- Resources, prompts, read-only mode, and audit logging
- Docker image and deployment runbook

[Unreleased]: https://github.com/zuupee/mcp-server/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/zuupee/mcp-server/releases/tag/v0.1.0
