#!/usr/bin/env node
// The `agent-lighthouse-mcp` command. Source maps go on before the server
// bundle and core load, so stack traces and the `caller` field of log lines
// name the source files, not the bundle. Node reads a file's source map only
// when maps were already on as it loaded.
process.setSourceMapsEnabled(true);
void import("./server.js");
