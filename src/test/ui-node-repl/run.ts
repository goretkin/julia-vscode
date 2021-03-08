import * as path from 'path'
import { ExTester, ReleaseQuality, VSBrowser, Workbench } from 'vscode-extension-tester'
import { VSRunner } from 'vscode-extension-tester/out/suite/runner'
import { DEFAULT_RUN_OPTIONS } from 'vscode-extension-tester/out/util/codeUtil'

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

    const logLevel = runOptions.logLevel // The logging level for the Webdriver
    // body of `VSRunner.runTests` in `src/suite/runner.ts`
    const this__ = (<any>runner) // escape hatch to access private members

    const self = this__
    const browser: VSBrowser = new VSBrowser(this__.codeVersion, this__.customSettings, logLevel)

    // this__.mocha.suite.beforeAll
    const start = Date.now()
    await browser.start(self.chromeBin)
    await browser.waitForWorkbench()
    await new Promise((res) => { setTimeout(res, 2000) })
    console.log(`Browser ready in ${Date.now() - start} ms`)
    console.log('Launching tests...')

    // testing code here
    //browser = VSBrowser.instance

    browser.takeScreenshot('initialized')

    //view = new ActivityBar().getViewControl('Extensions')
    //sideBar = await view.openView()
    //quickBox = await new Workbench().openCommandPrompt()
    const workbench = new Workbench()
    await workbench.executeCommand('Julia Start REPL')
    await browser.takeScreenshot('start-repl-1')
    await new Promise(r => setTimeout(r, 1000))
    await browser.takeScreenshot('start-repl-2')
    await new Promise(r => setTimeout(r, 4000))
    await browser.takeScreenshot('start-repl-3')
    await new Promise(r => setTimeout(r, 4000))
    await browser.takeScreenshot('start-repl-4')

    // this__.mocha.suite.afterAll
    await browser.quit()

    /*
    causesExtension 'vscode-extension-tester.api-handler' is not installed.

    Error: Command failed: ELECTRON_RUN_AS_NODE=1 "/Users/goretkin/projects/LoggingPlayground/julia-vscode/ui-test-resources/Visual Studio Code.app/Contents/MacOS/Electron" "/Users/goretkin/projects/LoggingPlayground/julia-vscode/ui-test-resources/Visual Studio Code.app/Contents/Resources/app/out/cli.js" --uninstall-extension "vscode-extension-tester.api-handler"
    */
    //code.uninstallExtension(self.cleanup)
}

doit() // top-level await is supported in node in e.g. `.mjs` files, but just wrap it here, because typescript etc.
