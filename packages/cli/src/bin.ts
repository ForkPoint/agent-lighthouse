// The `agent-lighthouse` command. Source maps go on before the CLI bundle and
// core load, so stack traces and the `caller` field of log lines name the
// source files, not the bundle. Node reads a file's source map only when maps
// were already on as it loaded.
process.setSourceMapsEnabled(true);
void import("./main.js");
