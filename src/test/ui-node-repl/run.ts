import { ExTester, ReleaseQuality } from 'vscode-extension-tester'

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
const testFiles = 'out/src/test/ui/*.js'
const run_options = { // `: RunOptions` , but that is not exported.
    vscodeVersion: undefined,
    settings: undefined,
};

// escape hatch to access private member
(<any>extest).code.runTests(testFiles, run_options)
