# Security policy

lbw-kit is a personal project. It is not an official Landbot product.

## Scope

The runtime (`runtime/lbw.js`) and the kit (`kit/`), where a widget could be made to do something the visitor or the page owner did not expect:

- tag parsing, and any value that comes from the model, a message, a URL or a data source (all untrusted);
- the links allowlist (`links`);
- rendering: text goes in with `textContent` only, never as HTML;
- field writes and the messages a widget sends as the visitor.

## Reporting a vulnerability

Use GitHub's private vulnerability reporting: open the **Security** tab of this repository and choose **Report a vulnerability**. Please do not open a public issue or pull request for a vulnerability.

Include the version, a minimal tag or config that reproduces it, and what it lets an attacker do.

## Supported versions

Only the latest release tag gets fixes.

## What to expect

A response on a best-effort basis; there is no service level.
