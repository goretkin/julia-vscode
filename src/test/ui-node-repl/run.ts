import * as path from 'path'
import { ExTester, ReleaseQuality } from 'vscode-extension-tester'
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
const testFilesPattern = 'out/src/test/ui/*.js'
const runOptions = { // `: RunOptions` , but that is not exported.
    vscodeVersion: undefined,
    settings: undefined,
    cleanup: undefined,
    config: undefined,
    logLevel: undefined
}

async function doit() {
    // body of `runTests` function in `vscode-extension-tester/src/util/codeUtil.ts`
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
    return runner.runTests(testFilesPattern, this_, runOptions.logLevel)
}

doit() // top-level await is supported in node in e.g. `.mjs` files, but just wrap it here, because typescript etc.
