const { getGrantedUsersHeaderPattern } = require("./getGrantedUsersHeaderPattern")

const grantedUsersHeaderPattern = getGrantedUsersHeaderPattern()

function removeGrantedUsersHeader(content) {
	if (typeof content !== "string") {
		return ""
	}
	return content.replace(grantedUsersHeaderPattern, "")
}

module.exports = {
	removeGrantedUsersHeader,
}
