// Playwright reporter used only by scripts/journey-coverage-discovery.mjs with
// `playwright test --list`: writes Playwright's own test registry -- every
// test it would run, per project, with its declared expected status and
// annotations, plus the project facts (name, browserName, isMobile) that
// runtime skip/fail conditions are evaluated against. Nothing is executed.
//
// Output path comes from JOURNEY_COVERAGE_LIST_OUTPUT (a JSON file).
import { writeFileSync } from "node:fs";

export default class JourneyCoverageListReporter {
  onBegin(config, suite) {
    this.rootDir = config.rootDir;
    this.suite = suite;
  }

  onEnd() {
    const output = process.env.JOURNEY_COVERAGE_LIST_OUTPUT;
    if (!output) throw new Error("JOURNEY_COVERAGE_LIST_OUTPUT is required");
    const projects = new Map();
    const tests = [];
    for (const test of this.suite.allTests()) {
      const project = test.parent.project();
      if (!projects.has(project.name)) {
        const use = project.use ?? {};
        projects.set(project.name, {
          name: project.name,
          testDir: project.testDir,
          browserName: use.browserName ?? use.defaultBrowserType ?? "chromium",
          isMobile: use.isMobile === true,
        });
      }
      tests.push({
        project: project.name,
        file: test.location.file,
        line: test.location.line,
        column: test.location.column,
        // titlePath(): ["", projectName, fileName, ...describes, title]
        titlePath: test.titlePath().slice(3),
        expectedStatus: test.expectedStatus,
        annotations: test.annotations.map(({ type }) => type),
      });
    }
    writeFileSync(output, JSON.stringify({ rootDir: this.rootDir, projects: [...projects.values()], tests }));
  }

  printsToStdio() {
    return false;
  }
}
