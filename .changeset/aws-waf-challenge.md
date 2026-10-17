---
"@forkpoint/agent-lighthouse-core": patch
---

An AWS WAF Challenge or CAPTCHA response now names AWS WAF as the bot wall. AWS documents both actions as answering with the header `x-amzn-waf-action` (`challenge` with HTTP 202, `captcha` with HTTP 405), often with an empty body. Such a homepage was reported as a page with too little evidence to score; it is now reported as refused by AWS WAF.
