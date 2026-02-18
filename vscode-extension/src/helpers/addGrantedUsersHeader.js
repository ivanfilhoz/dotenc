const {
	GRANTED_USERS_HEADER_END,
	GRANTED_USERS_HEADER_START,
} = require("./constants")
const { normalizeCommentValue } = require("./normalizeCommentValue")
const { removeGrantedUsersHeader } = require("./removeGrantedUsersHeader")

function addGrantedUsersHeader(content, environmentName, grantedUsers) {
	const users = Array.from(
		new Set(
			(Array.isArray(grantedUsers) ? grantedUsers : [])
				.map((value) => normalizeCommentValue(value))
				.filter((value) => value.length > 0),
		),
	)

	const lines = [
		GRANTED_USERS_HEADER_START,
		`# environment: ${normalizeCommentValue(environmentName)}`,
		"# granted users:",
	]

	if (users.length === 0) {
		lines.push("# - (none)")
	} else {
		for (const user of users) {
			lines.push(`# - ${user}`)
		}
	}

	lines.push(GRANTED_USERS_HEADER_END)
	const sanitizedContent = removeGrantedUsersHeader(content)
	return `${lines.join("\n")}\n\n${sanitizedContent}`
}

module.exports = {
	addGrantedUsersHeader,
}
