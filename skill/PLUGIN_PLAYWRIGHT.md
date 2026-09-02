---
name: plugin-playwright-coverage
description: >-
  Guidance for playwright test generation. Use when
  asked to generate plugin playwright tests.
---

# Test Setup

When setting up the playwright test harness, also do the following:
 - make sure the newly added test files are covered by `tsconfig.json` file
 - when launching the workspace using playwright's `webServer`, prefer using `wait` for `stdout` message such as `Plugin initialization complete`
 - add accessibility testing
   - use `@axe-core/playwright` package
   - create a common function that uses `AxeBuilder` to analyze the page, and asserts that no violations were found
   - add this check every time a test case encounters a new page contributed by the plugin under test
 - if eslint fails for the tests and playwright config, add them to `.eslintignore`

# Locator Strategy

When generating the test code, follow these guidelines for locators:
 - always prefer user facing locator to over DOM based (such as CSS or Xpath)
 - do not use overly specific locators, such as specific heading levels, as these might be prone to changes
 - when searching by text, some labels/headings will contain counts of other elements, such as `All (22)`
   - do not include the count in the locator, unless following an action that would change the count to an expected number 