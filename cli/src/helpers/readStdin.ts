export const readStdin = () =>
	new Promise<string>((resolve, reject) => {
		let input = ""
		process.stdin.setEncoding("utf-8")
		process.stdin.on("data", (chunk) => {
			input += chunk
		})
		process.stdin.on("end", () => {
			resolve(input)
		})
		process.stdin.on("error", reject)
	})
