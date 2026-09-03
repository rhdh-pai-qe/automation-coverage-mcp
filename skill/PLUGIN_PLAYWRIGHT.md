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

# Internationalization and Localization

Most frontend plugins are internationalized, and might include translations into several locales. The playwright tests should be able to test the plugin in each of these locales.

## Loading the Translations

Firstly, check if the plugin is internationalized by looking for a `translations` folder. Typically found directly in `src`, sometimes `src/alpha` folder.
The folder should contain a `ref.ts` file, which exports all the English labels. The export name should end with `Messages`.
Any typescript file named after a language code, such as `fr.ts`, exports the same labels for a given language. The default export will contain a `messages` property that contains the labels. Note that unlike the `ref` file, these labels are usually in a flat dot notation format.

Some messages might also contain replacement templates, noted by double curly braces `{{toreplace}}`.

If the plugin is internationalized, do the following:
 - create a new utility file that will handle loading the i18n labels
   - import the messages from the `ref.ts` file and regard them as the English messages (`en`)
   - import the translations from each lanugage file found in the `translations` folder
   - create a function that will transform the messages from each translation into the same format the ones from the `ref.ts` file
   - create a function that will serve the final messages based on language code
   - create a function that will replace template variables with actual values
 - in `playwright.config.ts`, add a list of locale codes based on the available translations
   - for each locale, generate a new project with the name of the locale
     - set the browser locale to the locale code, keep the rest the same across all projects

## Test Internationalization

When a test uses a text based locator, or makes an assertion about an elements text, such strings must be also internationalized in the tests.

To initialize a localized test do the following before the test cases launch:
 - find the browser's locale (this was set by the playwright project)
 - use the locale string to load translation messages for the given language using the utility functions described above
 - navigate to settings, find the language dropdown, and select the language matching the locale code

Now, whenever an element's text content is referenced, instead of a static string, use a matching translation from the loaded messages.

# Locator Strategy

When generating the test code, follow these guidelines for locators:
 - always prefer user facing locator to over DOM based (such as CSS or Xpath)
 - do not use overly specific locators, such as specific heading levels, as these might be prone to changes
 - when searching by text, some labels/headings will contain counts of other elements, such as `All (22)`
   - do not include the count in the locator, unless following an action that would change the count to an expected number 