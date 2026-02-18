const https = require("node:https")
const { NPM_LATEST_URL, UPDATE_CHECK_TIMEOUT_MS } = require("./constants")

function fetchLatestCliVersion(timeoutMs = UPDATE_CHECK_TIMEOUT_MS) {
	return new Promise((resolve) => {
		let settled = false
		const request = https.request(
			NPM_LATEST_URL,
			{
				method: "GET",
				headers: {
					accept: "application/json",
				},
			},
			(response) => {
				let body = ""
				response.setEncoding("utf8")
				response.on("data", (chunk) => {
					body += chunk
				})
				response.on("end", () => {
					if (settled) {
						return
					}
					settled = true
					if (response.statusCode !== 200) {
						resolve(undefined)
						return
					}

					try {
						const payload = JSON.parse(body)
						resolve(
							typeof payload.version === "string" ? payload.version : undefined,
						)
					} catch {
						resolve(undefined)
					}
				})
			},
		)

		request.on("error", () => {
			if (settled) {
				return
			}
			settled = true
			resolve(undefined)
		})

		request.setTimeout(timeoutMs, () => {
			request.destroy(new Error("timeout"))
		})
		request.end()
	})
}

module.exports = {
	fetchLatestCliVersion,
}
