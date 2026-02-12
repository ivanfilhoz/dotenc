import { createId } from "@paralleldrive/cuid2"

export const createProject = async () => {
	return {
		projectId: createId(),
	}
}
