import { readFileSync } from "fs";
import { resolve } from "path";

const packageJson = JSON.parse(readFileSync(resolve(__dirname, './package.json')).toString())
const extn_id = packageJson.name;

export default {
    EXTN: {
        ID: extn_id,
        DISPLAY_NAME: packageJson.displayName,
        AUTHOR: `${packageJson.author.name}<${packageJson.author.url}>`,
        VERSION: packageJson.version,
        HOMEPAGE: packageJson.homepage
    },
    CONTEXTS: {
        IS_SERVER_RUNNING: `${extn_id}.isRunning`
    },
    COMMANDS: {
        START : `${extn_id}.start`
    }
} as const;