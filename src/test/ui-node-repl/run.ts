import * as fs from 'fs-extra'
import * as glob from 'glob'
import * as path from 'path'
import { ExTester, ReleaseQuality, VSBrowser } from 'vscode-extension-tester'
import { VSRunner } from 'vscode-extension-tester/out/suite/runner'
import { DEFAULT_RUN_OPTIONS } from 'vscode-extension-tester/out/util/codeUtil'
import sanitize = require('sanitize-filename');

// copied from vscode-extension-tester/src/cli.ts
function codeStream(stream: string) {
    const envType = process.env.CODE_TYPE
    let type = stream

    if (!type && envType) {
        type = envType
    }
    if (type && type.toLowerCase() === 'insider') {
        return ReleaseQuality.Insider
    }
    return ReleaseQuality.Stable
}

const vscode_release = codeStream(undefined)
const storage_dir = './ui-test-resources'
const extensions_dir = undefined
const extest = new ExTester(storage_dir, vscode_release, extensions_dir)
const testFilesPattern = 'out/src/test/ui/*.js'
const runOptions = { // `: RunOptions` , but that is not exported.
    vscodeVersion: undefined,
    settings: undefined,
    cleanup: undefined,
    config: undefined,
    logLevel: undefined
}

async function doit() {
    // body of `CodeUtil.runTests` in `vscode-extension-tester/src/util/codeUtil.ts`
    const this_ = (<any>extest).code // escape hatch to access private member

    await this_.checkCodeVersion(runOptions.vscodeVersion ?? DEFAULT_RUN_OPTIONS.vscodeVersion)
    const literalVersion = runOptions.vscodeVersion === undefined || runOptions.vscodeVersion === 'latest' ? this_.availableVersions[0] : runOptions.vscodeVersion
    console.log(`VSCode Version: ${literalVersion}`)

    // add chromedriver to process' path
    const finalEnv: NodeJS.ProcessEnv = {}
    Object.assign(finalEnv, process.env)
    const key = 'PATH'
    finalEnv[key] = [this_.downloadFolder, process.env[key]].join(path.delimiter)

    process.env = finalEnv
    process.env.TEST_RESOURCES = this_.downloadFolder
    process.env.EXTENSIONS_FOLDER = this_.extensionsFolder
    const runner = new VSRunner(this_.executablePath, literalVersion, this_.parseSettings(runOptions.settings ?? DEFAULT_RUN_OPTIONS.settings), runOptions.cleanup, runOptions.config)
    const code = this_
    const logLevel = runOptions.logLevel // The logging level for the Webdriver
    // body of `VSRunner.runTests` in `src/suite/runner.ts`
    const this__ = (<any>runner) // escape hatch to access private members
    return new Promise(resolve => {
        const self = this__
        const browser: VSBrowser = new VSBrowser(this__.codeVersion, this__.customSettings, logLevel)
        const universalPattern = testFilesPattern.replace(/'/g, '')
        const testFiles = glob.sync(universalPattern)

        testFiles.forEach((file) => {
            if (fs.existsSync(file) && file.substr(-3) === '.js') {
                this__.mocha.addFile(file)
            }
        })

        this__.mocha.suite.afterEach(async function () {
            if (this__.currentTest && this__.currentTest.state !== 'passed') {
                try {
                    const filename = sanitize(this__.currentTest.fullTitle())
                    await browser.takeScreenshot(filename)
                } catch (err) {
                    console.log('Screenshot capture failed.', err)
                }
            }
        })

        this__.mocha.suite.beforeAll(async function () {
            this.timeout(45000)
            const start = Date.now()
            await browser.start(self.chromeBin)
            await browser.waitForWorkbench()
            await new Promise((res) => { setTimeout(res, 2000) })
            console.log(`Browser ready in ${Date.now() - start} ms`)
            console.log('Launching tests...')
        })

        this__.mocha.suite.afterAll(async function () {
            this.timeout(15000)
            await browser.quit()

            code.uninstallExtension(self.cleanup)
        })

        this__.mocha.run((failures) => {
            process.exitCode = failures ? 1 : 0
            resolve(process.exitCode)
        })
    })

}

doit() // top-level await is supported in node in e.g. `.mjs` files, but just wrap it here, because typescript etc.
