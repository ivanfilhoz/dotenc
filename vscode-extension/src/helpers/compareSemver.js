function compareSemver(left, right) {
	for (let i = 0; i < 3; i++) {
		if (left[i] > right[i]) return 1
		if (left[i] < right[i]) return -1
	}
	return 0
}

module.exports = {
	compareSemver,
}
