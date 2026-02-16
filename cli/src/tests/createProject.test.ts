import { describe, expect, test } from "bun:test"
import { createProject } from "../helpers/createProject"

describe("createProject", () => {
	test("returns an object with a projectId string", async () => {
		const result = await createProject()
		expect(result).toHaveProperty("projectId")
		expect(typeof result.projectId).toBe("string")
		expect(result.projectId.length).toBeGreaterThan(0)
	})

	test("generates unique project IDs", async () => {
		const a = await createProject()
		const b = await createProject()
		expect(a.projectId).not.toBe(b.projectId)
	})
})
