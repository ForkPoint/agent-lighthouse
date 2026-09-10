# Compare scans carefully

A benchmark compares scans across a set of websites. It can help test the scanner or study repeated findings. It is not a ranking of business quality.

## The earlier store study

The repository includes a study of 100 stores from before version 2. That study reported an average score of 53.6 out of 100.

Later releases changed the checks and scoring rules. Do not use that average as a target for a current scan. The earlier study is not proof of what AI systems can do today.

In particular, missing `llms.txt` or an optional API description does not by itself prove a site is unusable by AI. Read each check's current rules and evidence.

## Make a useful comparison

- Use the same scanner version and options for every site.
- Record the scan date and the pages assessed.
- Separate blocked or unscored scans from numeric results.
- Compare relevant findings, not only the overall score.
- Keep the underlying reports so others can inspect the result.

## Run the repository script

This option is for contributors with the repository and its dependencies installed. It contacts the websites in the benchmark list, so allow time for multiple scans.

```bash
pnpm tsx scripts/benchmark-stores.ts
```

The script writes results under `reports/investigation/`. Check the [benchmark script](https://github.com/ForkPoint/agent-lighthouse/blob/main/scripts/benchmark-stores.ts) for its current options and output.

The [historical study](https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/benchmark.md) preserves the earlier results. Treat its claims as historical, not current guidance.
