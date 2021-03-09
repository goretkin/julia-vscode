import * as path from 'path'
import { BottomBarPanel, ExTester, ReleaseQuality, StatusBar, VSBrowser, Workbench } from 'vscode-extension-tester'
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
// TODO use `vscode --extensionDevelopmentPath` instead of requiring the extension to be packaged and installed
const extensions_dir = './ui-test-resources/dot-vscode/extensions'
const extest = new ExTester(storage_dir, vscode_release, extensions_dir)
const runOptions = { // `: RunOptions` , but that is not exported.
    vscodeVersion: undefined,
    settings: undefined,
    cleanup: undefined,
    config: undefined,
    logLevel: undefined
}

/*
TODO all selenium interactions should catch
`ElementNotVisibleError: element not interactable`
and try again after doing e.g. this
*/
async function clear_notifications() {
    //await new Promise(r => setTimeout(r, 500)) // hack.
    const notifications_center = await new StatusBar().openNotificationsCenter()
    // prevent `ElementNotVisibleError: element not interactable` while clearing
    await notifications_center.clearAllNotifications()
    await new StatusBar().closeNotificationsCenter()
}

async function doit() {
    // body of `CodeUtil.runTests` in `vscode-extension-tester/src/util/codeUtil.ts`
    const this_ = (<any>extest).code // escape hatch to access private member

    await this_.checkCodeVersion(runOptions.vscodeVersion ?? DEFAULT_RUN_OPTIONS.vscodeVersion)
    const literalVersion = runOptions.vscodeVersion === undefined || runOptions.vscodeVersion === 'latest' ? this_.availableVersions[0] : runOptions.vscodeVersion
    const vsc_available_versions = this_.availableVersions
    console.log({ vsc_available_versions })
    console.log(`VSCode Version: ${literalVersion}`)
    console.log(`VSCode / Chrome executable: ${this_.executablePath}`)

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
    // TODO any exceptions here will leave the VSCode-under-test open, and not generate Selenium logs.
    const workbench = new Workbench()
    browser.takeScreenshot('initialized')
    const notifications_center = await workbench.openNotificationsCenter()
    await notifications_center.clearAllNotifications()
    await browser.takeScreenshot('clear-notifications-1')

    //view = new ActivityBar().getViewControl('Extensions')
    //sideBar = await view.openView()
    //quickBox = await new Workbench().openCommandPrompt()

    await new Promise(r => setTimeout(r, 1000))
    await workbench.executeCommand('Julia Start REPL') // TODO command should be found

    await browser.takeScreenshot('start-repl-1')
    await new Promise(r => setTimeout(r, 1000))
    await browser.takeScreenshot('start-repl-2')
    await new Promise(r => setTimeout(r, 4000))
    await browser.takeScreenshot('start-repl-3')
    await new Promise(r => setTimeout(r, 16000))
    await browser.takeScreenshot('start-repl-4')

    // prevent `ElementNotVisibleError: element not interactable`
    await clear_notifications()

    await browser.takeScreenshot('clear-notifications-2')

    // ---------- terminal -------
    const bottom_panel = new BottomBarPanel()
    let terminal = await bottom_panel.openTerminalView() // should already be opened
    await clear_notifications()
    const terminal_channel_names = await terminal.getChannelNames()
    console.log({ terminal_channel_names })

    await clear_notifications()
    const terminal_channel_name = await terminal.getCurrentChannel()
    console.log({ terminal_channel_name }) // should contain `Julia REPL`, but it is undefined?

    await clear_notifications()
    const terminal_contents = await terminal.getText()
    console.log('\n\nContents of terminal: ')
    console.log(terminal_contents)
    console.log('\n\n------------\n\n')

    const julia_prompt = terminal_contents.trim().endsWith('julia>')
    console.log({ julia_prompt }) // should be true, consider blocking if e.g. precompiling

    await clear_notifications()
    // regain focus to avoid `WebDriverError: element not interactable`
    // not sure, it's not working locally.
    // `vscode-extension-tester/test/test-project/src/test/bottomBar/views-test.ts` skips
    // darwin, so maybe this doesn't work well on macOS
    terminal = await bottom_panel.openTerminalView()
    await terminal.executeCommand('1 + 1')
    const terminal_contents2 = (await terminal.getText()).trim()
    //const new_terminal_contents2 = terminal_contents2.substring(terminal_contents.length) // faulty assumption that all previous text is still here
    console.log({ terminal_contents2 })

    // this__.mocha.suite.afterAll
    await browser.quit()

    /*
    causesExtension 'vscode-extension-tester.api-handler' is not installed.

    Error: Command failed: ELECTRON_RUN_AS_NODE=1 "/Users/goretkin/projects/LoggingPlayground/julia-vscode/ui-test-resources/Visual Studio Code.app/Contents/MacOS/Electron" "/Users/goretkin/projects/LoggingPlayground/julia-vscode/ui-test-resources/Visual Studio Code.app/Contents/Resources/app/out/cli.js" --uninstall-extension "vscode-extension-tester.api-handler"
    */
    //code.uninstallExtension(self.cleanup)
}

doit() // top-level await is supported in node in e.g. `.mjs` files, but just wrap it here, because typescript etc.
