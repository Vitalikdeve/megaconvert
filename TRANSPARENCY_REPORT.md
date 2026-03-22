# Transparency Report

Last updated: March 22, 2026

## National Security Requests

- Requests received: 0
- Requests satisfied: 0

MegaConvert Business has not received any national security requests, secret directives, or comparable orders requiring disclosure of customer information.

## Law Enforcement Requests

- Requests received: 0
- Data disclosed: 0

MegaConvert Business is designed as a zero-access service. Message contents are end-to-end encrypted and local message storage is encrypted at rest. As a result, we do not possess server-side plaintext message history or device private keys that would allow us to disclose readable customer conversations.

If we receive a legally valid request in the future, we will evaluate it under applicable law, challenge overbroad requests where appropriate, and disclose only the minimal metadata available to us, if any.

## Architecture Overview

MegaConvert Business uses X25519 / Curve25519 style key agreement for peer secret derivation and AES-GCM-256 for authenticated encryption of message payloads. Local databases are encrypted on disk and private keys are intended to remain protected by Android Keystore hardware-backed facilities where available.

Application logging is treated as sensitive. Release builds are configured to strip Android `Log` calls, and secret-bearing values such as shared secrets, AES keys, plaintext message bodies, and private keys are excluded from crash and diagnostic reporting paths. Account deletion flows are designed to remove local encrypted databases, clear application session state, and destroy locally managed cryptographic material.
