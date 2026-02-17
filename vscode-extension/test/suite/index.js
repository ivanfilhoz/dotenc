const fs = require("node:fs")
const path = require("node:path")
const Mocha = require("mocha")

function run() {
	const mocha = new Mocha({
		ui: "tdd",
		color: true,
		timeout: 30000,
	})

	const testsRoot = __dirname
	for (const file of fs.readdirSync(testsRoot)) {
		if (file.endsWith(".test.js")) {
			mocha.addFile(path.resolve(testsRoot, file))
		}
	}

	return new Promise((resolve, reject) => {
		mocha.run((failures) => {
			if (failures > 0) {
				reject(new Error(`${failures} integration test(s) failed.`))
				return
			}

			resolve()
		})
	})
}

module.exports = { run }
