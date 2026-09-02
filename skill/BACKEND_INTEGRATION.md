---
name: plugin-backend-coverage
description: >-
  Guidance for backend integration test generation. Use when
  asked to generate L2 backend integration tests.
---

# Setup

When preparing the L2 tests, mind the following:
 - prefer using packages that are already part of the workspace
   - do not add extra packages unless necessary

# Tests

Use these rules when generating tests:
 - when checking for unauthenticated requests specifically
   - mind that `startTestBackend` wires `mockServices.httpAuth`, and `MockHttpAuthService` falls back to `mockCredentials.user()`
   - to truly test without authentication, the header `Authorization: mockCredentials.none.header()` must be set
   - `mockCredentials` can be imported from `@backstage/backend-test-utils`