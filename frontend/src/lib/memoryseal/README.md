# MemorySeal typed client

Step 4E binds the frontend data contract to the frozen 30-method MemorySeal Intelligent Contract surface.

Boundaries:

- 20 view methods are exposed through `MemorySealReader`.
- Bradbury canonical reads use `TransactionHashVariant.LATEST_FINAL`.
- 10 write methods are represented as pure, frozen-address write intents.
- This module does **not** submit wallet transactions; provider-backed submission is deferred to Step 4H.
- No generic arbitrary-address or arbitrary-method write API is exposed.
- Counts are not treated as global enumerators. Discovery is by known/derived IDs, locally retained returned IDs, or subject-scoped history.
- The seven claim states remain distinct.
