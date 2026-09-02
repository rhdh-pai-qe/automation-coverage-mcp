---
name: react-component-coverage
description: >-
  Guidance for RTL test generation. Use when
  asked to generate react component tests.
---

# Test Fundamentals

When generating the react component tests, follow these rules:
 - assertions in test cases must be specific enough that they only apply to the state the test case is verifying
 - avoid creating test cases that telescope other test cases, such as adding an additional assertion over an existing test case
   - if the setup is the same for both test cases, these should be merged
   - if the setup is different, consider extracting the common code into a function or a hook
 - do not create assertions that cannot fail