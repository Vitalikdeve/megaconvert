# Worker Isolation Spec

## Goals
- Zero plaintext persistence
- No outbound network
- Per-job isolation
- Memory-only key handling

## Container/VM Requirements
- Root FS: read-only
- Temp storage: tmpfs (RAM)
- No swap
- No core dumps (`ulimit -c 0`)
- No privilege escalation
- seccomp profile with syscall allowlist

## Network Policy
- Allow only S3/MinIO + Redis
- Deny all other egress
- No inbound except orchestrator

## Process Model
- One job per sandbox
- Destroy sandbox after job
- Wipe tmpfs on exit

## Runtime Settings
- CPU and memory limits
- Max execution time per job
- Kill on timeout

## Kubernetes (Target)
- Separate node pool for workers
- NetworkPolicy with egress allowlist
- PodSecurity: restricted
- ReadOnlyRootFilesystem: true
- EmptyDir (tmpfs) for /tmp

## Notes
This repository does not enforce ephemeral VMs. It requires infra-level enforcement.
