const {
	GRANTED_USERS_HEADER_END,
	GRANTED_USERS_HEADER_START,
} = require("./constants")
const { escapeRegExp } = require("./escapeRegExp")

function getGrantedUsersHeaderPattern() {
	return new RegExp(
		`^${escapeRegExp(GRANTED_USERS_HEADER_START)}\\r?\\n[\\s\\S]*?${escapeRegExp(GRANTED_USERS_HEADER_END)}\\r?\\n(?:\\r?\\n)?`,
	)
}

module.exports = {
	getGrantedUsersHeaderPattern,
}
