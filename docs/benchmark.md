# Store benchmark

`scripts/benchmark-stores.ts` scans a list of online stores and saves every result. Use it to test the scanner across many real sites or to study repeated findings. It is not a ranking of the stores.

## Run it

```bash
pnpm tsx scripts/benchmark-stores.ts                        # every store in the list
pnpm tsx scripts/benchmark-stores.ts https://example.com    # only the given URLs
```

| Option              | Default | Effect                              |
| :------------------ | :------ | :---------------------------------- |
| `--gate`            | off     | Run with the scan evidence gate on. |
| `--concurrency=<n>` | `2`     | Stores scanned at once.             |
| `--delay=<ms>`      | `3000`  | Pause between stores.               |

- The store list is `packages/core/test-data/sites/benchmark-stores.json`, exported from the [brand corpus](./evidence/corpus.md). A full run takes hours.
- Results go to `reports/investigation/benchmark-stores-data.json`, written as the run goes. A run with URLs writes `benchmark-subset-data.json` instead. `--gate` adds a `-gated` suffix.
- Low concurrency and a delay keep shared rate limits from turning the run into a measure of its own throttling.

## Compare fairly

- Use the same scanner version and options for every site.
- Record the scan date and the pages assessed.
- Report blocked and unscored scans apart from numeric scores.
- Compare findings, not only the overall score.
- Keep the reports so others can check them.

## The pre-v2 study

An earlier run over 100 stores, before version 2, found:

| Finding                                            | Result     |
| :------------------------------------------------- | :--------- |
| Stores with OpenAPI, WebMCP or MCP action surfaces | 0%         |
| Stores with `llms.txt` or `llms-full.txt`          | 4%         |
| Average score                                      | 53.6 / 100 |

Later releases changed the audits, pass conditions and scoring. These figures are historical. Do not compare a current score with them.
