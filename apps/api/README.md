# apps/api — Backend API & matching algorithm

Stack not decided yet. See [docs/proposals/backend.md](../../docs/proposals/backend.md).
Owner: BE team.

The matching engine is in place as a pure JS module (Node 22, no build): see [ENGINE.md](ENGINE.md).
It reads the 90 pilot settlements from MongoDB, seeded by [data/pipeline/seed-mongo.mjs](../../data/pipeline/seed-mongo.mjs).
