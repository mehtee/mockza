# Phase 6 Specification: Over-The-Air (OTA) Content Pack Expansion (Epic X4.1)

---

## 1. Executive Summary & Architecture Goals

Mockza v1.0 bundles starter seed assets in the application binary and supports downloading verified CDN packs from a static manifest. Phase 6 (Epic X4.1) expands this foundation into a fully dynamic, cryptographically signed Over-The-Air (OTA) content delivery pipeline.

### Core Objectives
1. **Zero App Store Review Dependency**: Content authors can publish new mock exam packs, vocabulary thematic modules, and micro-drills weekly without waiting for App Store / Play Store binary reviews.
2. **Cryptographic Integrity & Authenticity**: Every remote pack is signed with an Ed25519 author key; clients verify the Ed25519 signature before writing to local disk or executing SQLite migrations.
3. **Delta Patching & Bandwidth Minimization**: High-bitrate audio listening packs support bsdiff/brotli byte-level delta patches, reducing recurring pack update downloads from 25 MB to under 1.5 MB.
4. **Resilient Background Downloading**: Downloads resume automatically across flaky network connections using HTTP Range requests and atomic temporary file renames.

---

## 2. Remote Manifest & Catalog Schema (v2.0)

```typescript
export interface OtaCatalogManifestV2 {
  manifestVersion: 2;
  catalogEpoch: number;
  publishedAtUtc: string;
  signature: {
    algorithm: 'Ed25519';
    publicKeyId: string;
    signatureHex: string;
  };
  packs: OtaPackEntryV2[];
}

export interface OtaPackEntryV2 {
  packId: string;
  examTrack: 'ielts_academic' | 'ielts_general' | 'pte_academic' | 'toefl_ibt' | 'det';
  version: string; // Semantic versioning, e.g. "1.2.0"
  minAppVersion: string; // Pinned compatibility constraint, e.g. ">= 1.0.0"
  skillKind: 'reading' | 'listening' | 'speaking' | 'writing' | 'fullMock';
  title: string;
  description: string;
  byteLength: number;
  sha256Hex: string;
  cdnUrl: string;
  deltaPatches?: Array<{
    fromVersion: string;
    deltaByteLength: number;
    deltaSha256Hex: string;
    deltaUrl: string;
  }>;
}
```

---

## 3. Client Download, Verification & Decryption Lifecycle

```
[App Background Downloader]
        │
        ▼
1. Fetch GET /v2/catalog/manifest (Conditional 304 ETag)
        │
        ▼
2. Verify Manifest Ed25519 Signature against Bundled Root Public Key
        │
        ▼ (If valid)
3. Download Pack / Delta Stream via HTTP Range requests (.tmp)
        │
        ▼
4. Verify SHA-256 Digest against Manifest
        │ (If corrupted -> Abort & emit DownloadIntegrityFailure)
        ▼ (If valid)
5. Atomic Rename: move .tmp -> final pack location
        │
        ▼
6. Ingest into Drift SQLite database (ExamPacks table) in atomic transaction
```

---

## 4. Security & Trademark Constraints

- All remote packs must pass automated pre-flight checks in the CI content pipeline (`validate-pack.ts`) before being signed with the release Ed25519 key.
- Zero copyrighted questions or materials from Cambridge, IDP, British Council, ETS, or Pearson may ever be ingested into OTA channels.
