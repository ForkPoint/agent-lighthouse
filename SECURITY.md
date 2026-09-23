# Security Policy

The Agent Lighthouse team and ForkPoint take security seriously. We appreciate your efforts to responsibly disclose any vulnerabilities you find.

## Supported Versions

We provide security updates and patches for the following versions:

| Version | Supported          |
| :------ | :----------------- |
| Latest  | :white_check_mark: |
| < 1.0.0 | :white_check_mark: |
| main    | :white_check_mark: |

Please ensure you are using the latest version of `@forkpoint/agent-lighthouse` before reporting an issue.

## Reporting a Vulnerability

**Please do not report security vulnerabilities via public GitHub issues or discussions.**

Instead, report vulnerabilities through one of the following channels:

### 1. GitHub Private Vulnerability Reporting (Recommended)

You can report a vulnerability directly and privately through GitHub:

- Navigate to the [Security Advisories](https://github.com/ForkPoint/agent-lighthouse/security/advisories) tab of this repository.
- Click **"Report a vulnerability"** to open a private draft advisory.

### 2. Email

If you are unable to use GitHub Security Advisories, send an email to:

- **[hello@forkpoint.com](mailto:hello@forkpoint.com)** with the subject line `[SECURITY] Agent Lighthouse Vulnerability Report`.

### What to Include in Your Report

To help us triage and resolve the issue quickly, please provide:

- A description of the vulnerability and its potential impact.
- Affected package(s) (`@forkpoint/agent-lighthouse`, `core`, `report`, `mcp`, or action).
- Clear steps to reproduce the issue (proof-of-concept script, sample URL, or scan command).
- Any proposed mitigations or fixes, if available.

## Response Process & Timelines

1. **Acknowledgment**: We aim to acknowledge receipt of your report within 48 hours.
2. **Investigation**: We will verify the vulnerability, evaluate its severity, and determine affected components within 5 business days.
3. **Remediation**: We will work on a fix in a private fork or advisory workspace.
4. **Coordinated Disclosure**: Once a patch is released to npm, we will publish a security advisory crediting you for the discovery (unless you prefer to remain anonymous).

## Safe Harbor

We will not pursue legal action against researchers who report vulnerabilities in accordance with this policy and conduct security research in good faith:

- Do not exploit a vulnerability beyond what is necessary to demonstrate its presence.
- Do not access, modify, or destroy user data or third-party infrastructure.
- Give us reasonable time to remediate the vulnerability before public disclosure.
