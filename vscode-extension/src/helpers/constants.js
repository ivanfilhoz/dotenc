const DOTENC_SCHEME = "dotenc"
const OPEN_NATIVE_COMMAND = "dotenc.openNative"
const OPEN_ENCRYPTED_SOURCE_COMMAND = "dotenc.openEncryptedSource"
const AUTO_OPEN_NATIVE_SETTING = "autoOpenNative"
const UPDATE_ACTION_LABEL = "Update CLI"
const SHOW_LOGS_ACTION_LABEL = "Show Logs"
const NPM_LATEST_URL = "https://registry.npmjs.org/@dotenc%2fcli/latest"
const UPDATE_CHECK_TIMEOUT_MS = 1500
const GRANTED_USERS_HEADER_START =
	"# dotenc-meta:start granted-users (ignored on save)"
const GRANTED_USERS_HEADER_END = "# dotenc-meta:end granted-users"

module.exports = {
	AUTO_OPEN_NATIVE_SETTING,
	DOTENC_SCHEME,
	GRANTED_USERS_HEADER_END,
	GRANTED_USERS_HEADER_START,
	NPM_LATEST_URL,
	OPEN_ENCRYPTED_SOURCE_COMMAND,
	OPEN_NATIVE_COMMAND,
	SHOW_LOGS_ACTION_LABEL,
	UPDATE_ACTION_LABEL,
	UPDATE_CHECK_TIMEOUT_MS,
}
